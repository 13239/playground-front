import { connectChat, type AuthenticatedChatConnection } from "@/features/chat/client/connection";
import { requestAuthenticatedApi, AuthRequestError } from "@/features/auth/client/api";
import { notifyAuthChanged } from "@/features/auth/client/session-events";
import { createUuidV4 } from "@/lib/client/uuid";
import {respondGameInvitation} from "@/features/game-invitations/registry";
import type {InvitationGame} from "@/features/game-invitations/contracts";
import { object, isSnapshot, isRoom, isPerson, isResponse, isSummary, isMessage, isHistory, type Snapshot, type Room, type Person, type Summary, type SocialMessage, type Operation, type History, type Notification } from "./contracts";

type Pending = Readonly<{ id: string; roomId: string; content: string; state: "queued"|"uncertain" }>;
type View = "list"|"requests"|"conversation"|"create"|"members"|"invite";
type Control = {type: string; conversationId?: string; page?: number; clientMessageId?: string; messageId?: string; content?: string};
type ReadControl = {frame: Control; attempts: number};
export type SocialState = Readonly<{
  sessionId: string|null; authorized: boolean; status: "login"|"connecting"|"connected"|"reconnecting"; data: Snapshot|null;
  surface: "closed"|"friends"|"home"|"notifications"|"minimized"; tab: "friends"|"conversations"; view: View;
  // 홈 탭은 전역 팝업의 열림·닫힘 및 팝업 안의 탭 전환과 독립적으로 유지한다.
  homeTab: "all"|"friends"|"conversations"; readingNotifications: boolean;
  // 초대 응답 잠금·오류는 채팅 전송과 분리하고 해당 초대에만 표시한다.
  snapshotAt: number; gameInvitationBusy: string|null; gameInvitationError: {id:string;message:string}|null;
  room: Room|null; messages: readonly SocialMessage[]; pending: readonly Pending[]; drafts: Readonly<Record<string,string>>;
  summaries: Readonly<Record<string,Summary>>; history: Pick<History,"page"|"pageSize"|"total"|"writable">;
  busy: string|null; error: string; loading: boolean; profile: {person: Person; anchor: HTMLElement}|null;
  // 실시간 안내는 원본 알림을 보관해 확인 시 해당 요청의 수락 화면으로 연결한다.
  highlight: string|null; toast: {id: string; message: string; notification?: Notification}|null; document: Document|null; peerReadAt: number;
  pages: {friendPage: number; requestPage: number; sentPage: number; roomPage: number; notificationPage: number; search: string};
}>;
const initial: SocialState={sessionId:null,authorized:false,status:"login",data:null,surface:"closed",tab:"friends",homeTab:"all",readingNotifications:false,snapshotAt:0,gameInvitationBusy:null,gameInvitationError:null,view:"list",room:null,messages:[],pending:[],drafts:{},summaries:{},peerReadAt:0,
  history:{page:1,pageSize:30,total:0,writable:false},busy:null,error:"",loading:false,profile:null,highlight:null,toast:null,document:null,
  pages:{friendPage:1,requestPage:1,sentPage:1,roomPage:1,notificationPage:1,search:""}};
/** 페이지/팝업이 공유하는 메모리 상태다. 메시지와 초안은 브라우저 영속 저장소에 기록하지 않는다. */
export class SocialStore {
  private state: SocialState=initial;
  private listeners=new Set<()=>void>();
  private controller: AbortController|null=null;
  private connection: AuthenticatedChatConnection|null=null;
  private reconnect: ReturnType<typeof setTimeout>|undefined;
  private heartbeat: ReturnType<typeof setInterval>|undefined;
  private refreshTimer: ReturnType<typeof setTimeout>|undefined;
  private toastTimer: ReturnType<typeof setTimeout>|undefined;
  private pendingTimers=new Map<string,ReturnType<typeof setTimeout>>();
  private retries=new Set<string>();
  private version=0;
  private refreshVersion=0;
  private attempt=0;
  private lastNotification: string|null=null;
  private notificationInitialized=false;
  private initialSocialSnapshot=false;
  private scroll=new Map<string,number>();
  // 조회만 합쳐서 순차 전송한다. 메시지 전송·PING·닫기는 지연하거나 자동 재전송하지 않는다.
  private readQueue=new Map<string,ReadControl>();
  private sentReads=new Map<string,ReadControl>();
  private controlTimer: ReturnType<typeof setTimeout>|undefined;
  private nextReadAt=0;
  private wantedHistory: {roomId:string;page:number}|null=null;
  private notificationRead: Promise<void>|null=null;
  private profileVersion=0;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  getSnapshot=()=>this.state;
  getServerSnapshot=()=>initial;
  private set(patch: Partial<SocialState>){
    // 닫기·탭 이동 뒤 도착하는 프로필 요청도 같은 해제 경계를 따른다.
    if(patch.profile===null)this.profileVersion++;
    this.state={...this.state,...patch};this.listeners.forEach(listener=>listener());
  }
  private readKey(frame: Control){return frame.type==="SOCIAL_OPEN"||frame.type==="SOCIAL_HISTORY"?"history":frame.type==="SOCIAL_READ"?`read:${frame.conversationId}`:frame.type==="SOCIAL_STATUS"?`status:${frame.clientMessageId}`:frame.type;}
  private emit(frame: Control){
    if(this.connection?.socket.readyState!==WebSocket.OPEN)return false;
    if(["SOCIAL_SYNC","SOCIAL_OPEN","SOCIAL_HISTORY","SOCIAL_READ","SOCIAL_STATUS"].includes(frame.type)){
      if(frame.type==="SOCIAL_OPEN"||frame.type==="SOCIAL_HISTORY")this.wantedHistory={roomId:frame.conversationId!,page:frame.page??1};
      this.readQueue.set(this.readKey(frame),{frame,attempts:0});this.flushReads();return true;
    }
    if(frame.type==="SOCIAL_CLOSE"){
      this.wantedHistory=null;
      for(const [key,read] of this.readQueue)if(key==="history"||read.frame.type==="SOCIAL_READ"){this.readQueue.delete(key);if(read.frame.conversationId)this.lastRead.delete(read.frame.conversationId);}
      for(const [key,read] of this.sentReads)if(key==="history"||read.frame.type==="SOCIAL_READ")this.sentReads.delete(key);
    }
    this.connection.socket.send(JSON.stringify({version:1,...frame}));return true;
  }
  private flushReads(){
    if(this.controlTimer||!this.readQueue.size||this.connection?.socket.readyState!==WebSocket.OPEN)return;
    this.controlTimer=setTimeout(()=>{
      this.controlTimer=undefined;
      if(this.connection?.socket.readyState!==WebSocket.OPEN)return;
      const entry=this.readQueue.entries().next().value;if(!entry)return;
      const [key,read]=entry;this.readQueue.delete(key);this.sentReads.set(key,read);
      this.connection.socket.send(JSON.stringify({version:1,...read.frame}));
      this.nextReadAt=Date.now()+600;this.flushReads();
    },Math.max(0,this.nextReadAt-Date.now()));
  }
  private clearReads(){clearTimeout(this.controlTimer);this.controlTimer=undefined;this.readQueue.clear();this.sentReads.clear();this.wantedHistory=null;this.nextReadAt=0;this.lastRead.clear();this.initialSocialSnapshot=false;}
  /** 서버의 대기 시간을 지키고 조회만 두 번 복구한다. 다른 방·페이지로 이동한 요청은 버린다. */
  private retryRead(frame: Record<string,unknown>,payload: Record<string,unknown>|null){
    const operation=frame.operation;if(typeof operation!=="string")return false;
    const key=this.readKey({type:operation,conversationId:typeof payload?.conversationId==="string"?payload.conversationId:undefined,clientMessageId:typeof frame.clientMessageId==="string"?frame.clientMessageId:undefined});
    const read=this.sentReads.get(key);if(!read)return false;
    if((operation==="SOCIAL_OPEN"||operation==="SOCIAL_HISTORY")&&(!this.wantedHistory||payload&&(payload.conversationId!==this.wantedHistory.roomId||payload.page!==this.wantedHistory.page)))return true;
    if(read.attempts>=2)return false;
    this.sentReads.delete(key);
    // 더 최신 요청이 이미 대기 중이면 실패한 예전 요청으로 덮어쓰지 않는다.
    if(!this.readQueue.has(key))this.readQueue.set(key,{frame:read.frame,attempts:read.attempts+1});
    const wait=typeof frame.retryAfterMillis==="number"?Math.min(30_000,Math.max(600,frame.retryAfterMillis)):1200;
    this.nextReadAt=Math.max(this.nextReadAt,Date.now()+wait);clearTimeout(this.controlTimer);this.controlTimer=undefined;this.flushReads();return true;
  }
  async request(operation: Operation, body: object={}, signal?: AbortSignal): Promise<unknown> {
    const session=this.state.sessionId;if(!session||!this.state.authorized)throw new AuthRequestError("로그인 후 이용해 주세요.",401);
    const response=await requestAuthenticatedApi(`/api/social/${operation}`,{sessionId:session,...body},signal);
    const data: unknown=await response.json();
    if(this.state.sessionId!==session||!object(data)||data.sessionId!==session||!isResponse(operation,data))throw new AuthRequestError("친구 정보를 확인하지 못했습니다.",502);
    return data;
  }
  start(sessionId: string){if(this.state.sessionId===sessionId&&this.state.authorized)return;if(this.state.sessionId!==sessionId)this.stop();this.controller=new AbortController();this.set({sessionId,authorized:true,status:"connecting"});void this.connect(this.version);}
  suspend(){if(!this.state.authorized)return;this.version++;this.profileVersion++;this.refreshVersion++;this.controller?.abort();this.connection?.close();this.connection=null;clearTimeout(this.reconnect);this.reconnect=undefined;clearInterval(this.heartbeat);clearTimeout(this.refreshTimer);this.clearReads();this.notificationRead=null;this.set({authorized:false,status:"connecting",busy:null,loading:false,readingNotifications:false,gameInvitationBusy:null,gameInvitationError:null,profile:null});}
  stop(){
    this.version++;this.profileVersion++;this.refreshVersion++;this.controller?.abort();this.connection?.close();this.connection=null;
    clearTimeout(this.reconnect);this.reconnect=undefined;clearTimeout(this.refreshTimer);clearTimeout(this.toastTimer);clearInterval(this.heartbeat);
    this.pendingTimers.forEach(clearTimeout);this.pendingTimers.clear();this.retries.clear();this.scroll.clear();this.clearReads();this.notificationRead=null;this.lastNotification=null;this.notificationInitialized=false;this.attempt=0;this.set(initial);
  }
  private async connect(version: number){
    const session=this.state.sessionId;if(!session||version!==this.version)return;
    try{
      await this.refresh(false);
      if(version!==this.version)return;
      const connection=await connectChat(session,this.controller?.signal,{scope:"SOCIAL"});
      if(version!==this.version){connection.close();return;}
      this.connection=connection;this.attempt=0;this.set({status:"connected",error:""});
      connection.socket.addEventListener("message",event=>{if(version===this.version&&this.connection===connection&&typeof event.data==="string")this.receive(event.data);});
      connection.socket.addEventListener("close",event=>{if(version!==this.version||this.connection!==connection)return;if(event.code===4401){this.suspend();notifyAuthChanged();}else this.lost(version);},{once:true});
      connection.socket.addEventListener("error",()=>{if(version===this.version&&this.connection===connection)this.lost(version);},{once:true});
      this.initialSocialSnapshot=true;
      connection.takeBufferedFrames().forEach(raw=>this.receive(raw));
      this.heartbeat=setInterval(()=>this.emit({type:"PING"}),20_000);
      if(["friends","home"].includes(this.state.surface)&&this.state.view==="conversation"&&this.state.room)this.emit({type:"SOCIAL_OPEN",conversationId:this.state.room.id,page:this.state.history.page});
      for(const pending of this.state.pending)this.emit({type:"SOCIAL_STATUS",conversationId:pending.roomId,clientMessageId:pending.id});
    }catch(error){
      if(version!==this.version||this.controller?.signal.aborted)return;
      if(error instanceof AuthRequestError&&error.status===401)notifyAuthChanged();
      this.set({error:this.message(error)});this.lost(version);
    }
  }
  private lost(version: number){
    if(version!==this.version||this.reconnect)return;
    this.connection?.close();this.connection=null;clearInterval(this.heartbeat);
    this.clearReads();
    this.set({status:"reconnecting",pending:this.state.pending.map(p=>({...p,state:"uncertain"}))});
    this.reconnect=setTimeout(()=>{this.reconnect=undefined;void this.connect(version);},Math.min(30_000,1000*2**Math.min(this.attempt++,5)));
  }
  async refresh(toast=true){
    const version=++this.refreshVersion;const session=this.state.sessionId;if(!session)return;
    // 왕복 시간도 차감해 느린 응답이 15초 초대의 화면 기한을 연장하지 못하게 한다.
    const snapshotAt=performance.now();
    try{
      const data=await this.request("snapshot",this.state.pages,this.controller?.signal);
      if(version!==this.refreshVersion||session!==this.state.sessionId||!isSnapshot(data))return;
      const newest=data.notifications.items[0];
      // 빈 수신함에 처음 도착한 알림도 안내한다. 목록 페이지 이동을 새 알림으로 오인하지 않는다.
      if(toast&&this.state.surface!=="notifications"&&this.notificationInitialized&&data.notificationBoundary!==this.lastNotification&&data.unreadNotifications>0)
        this.showToast(newest?.id===data.notificationBoundary?this.notificationText(newest):"새 친구 활동 알림이 도착했어요.",newest?.id===data.notificationBoundary?newest:undefined);
      this.lastNotification=data.notificationBoundary;this.notificationInitialized=true;
      let room=this.state.room;
      const updated=room&&data.rooms.items.find(r=>r.id===room?.id);
      if(updated)room=updated;
      // 목록 응답은 진행 중인 대화 이력 조회의 로딩·페이지 선택을 끝내지 않는다.
      this.set({data,room,snapshotAt,loading:!!this.wantedHistory&&(this.readQueue.has("history")||this.sentReads.has("history"))});
      if(this.notificationsVisible())void this.markNotificationsRead();
      if(room&&!updated)void this.verifyRoom(room.id,session);
    }catch(error){if(version===this.refreshVersion&&!this.controller?.signal.aborted)this.set({loading:false,error:this.message(error)});}
  }
  private scheduleRefresh(){clearTimeout(this.refreshTimer);const version=this.version;this.refreshTimer=setTimeout(()=>{void this.refresh().then(()=>{if(version!==this.version)return;this.emit({type:"SOCIAL_SYNC"});this.resyncConversation();});},200);}
  private receive(raw: string){
    if(raw.length>131_072)return;
    let f: unknown;try{f=JSON.parse(raw);}catch{return;}if(!object(f)||f.version!==1||typeof f.type!=="string")return;
    const payload=object(f.social)?f.social:null;
    if(payload&&Array.isArray(payload.summaries)&&payload.summaries.length<=100&&payload.summaries.every(isSummary)){
      const summaries=f.type==="SOCIAL_SNAPSHOT"?{}:{...this.state.summaries};
      for(const item of payload.summaries)summaries[item.conversationId]=item;
      const room=this.state.room;
      const latest=room&&summaries[room.id];
      this.set({summaries,...(room&&latest?{room:{...room,writable:latest.writable}}:{})});
      if(f.type==="SOCIAL_SNAPSHOT"&&room&&!latest&&this.state.sessionId)void this.verifyRoom(room.id,this.state.sessionId);
    }
    if(f.type==="SOCIAL_CHANGED"){this.scheduleRefresh();return;}
    if(f.type==="SOCIAL_RECEIPT"&&payload&&payload.conversationId===this.state.room?.id&&typeof payload.peerReadAt==="number"&&Number.isSafeInteger(payload.peerReadAt))this.set({peerReadAt:payload.peerReadAt});
    if(f.type==="SOCIAL_SNAPSHOT"){
      this.sentReads.delete("SOCIAL_SYNC");
      // HTTP 첫 조회와 소켓 구독 사이에 도착한 짧은 초대도 최초 구독 확정 직후 한 번 복구한다.
      if(this.initialSocialSnapshot){this.initialSocialSnapshot=false;void this.refresh(false);}
    }
    if(f.type==="SOCIAL_SUMMARY"&&payload&&Array.isArray(payload.summaries))for(const summary of payload.summaries)if(isSummary(summary))this.sentReads.delete(`read:${summary.conversationId}`);
    if(f.type==="SOCIAL_HISTORY"&&isHistory(payload)&&payload.conversationId===this.wantedHistory?.roomId&&payload.page===this.wantedHistory.page){
      this.sentReads.delete("history");
      const confirmed=new Set(payload.messages.map(m=>m.clientMessageId));
      this.set({messages:payload.messages,pending:this.state.pending.filter(p=>!confirmed.has(p.id)),peerReadAt:payload.peerReadAt??0,history:{page:payload.page,pageSize:payload.pageSize,total:payload.total,writable:payload.writable},loading:false});
      return;
    }
    if((f.type==="CHAT_MESSAGE"||f.type==="CHAT_STATUS_RESULT")&&isMessage(f.message)){
      const m=f.message;
      const isNew=f.type==="CHAT_MESSAGE"&&m.conversationId===this.state.room?.id&&!this.state.messages.some(message=>message.id===m.id);
      const messages=m.conversationId===this.state.room?.id&&this.state.history.page===1?this.merge(this.state.messages,m):this.state.messages;
      if(m.clientMessageId){clearTimeout(this.pendingTimers.get(m.clientMessageId));this.pendingTimers.delete(m.clientMessageId);this.retries.delete(m.clientMessageId);this.sentReads.delete(`status:${m.clientMessageId}`);}
      this.set({messages,pending:this.state.pending.filter(p=>p.id!==m.clientMessageId),...(isNew?{history:{...this.state.history,total:this.state.history.total+1}}:{})});
      return;
    }
    if(f.type==="CHAT_STATUS_RESULT"&&f.stored===false&&typeof f.clientMessageId==="string"){
      this.sentReads.delete(`status:${f.clientMessageId}`);
      const pending=this.state.pending.find(p=>p.id===f.clientMessageId);
      if(pending&&this.retries.delete(pending.id)){
        this.emit({type:"SOCIAL_SEND",conversationId:pending.roomId,clientMessageId:pending.id,content:pending.content});this.watchPending(pending.id);
      }else this.set({pending:this.state.pending.map(p=>p.id===f.clientMessageId?{...p,state:"uncertain"}:p)});
    }
    if(f.type==="CHAT_ERROR"){
      if((f.code==="CHAT_REQUEST_RATE_LIMIT_EXCEEDED"||f.code==="CHAT_SERVICE_UNAVAILABLE")&&this.retryRead(f,payload))return;
      // 화면을 떠난 뒤 도착한 이력 오류가 새 화면에 배너를 남기지 않게 한다.
      if((f.operation==="SOCIAL_OPEN"||f.operation==="SOCIAL_HISTORY")&&(!this.wantedHistory||payload&&(payload.conversationId!==this.wantedHistory.roomId||payload.page!==this.wantedHistory.page)))return;
      if(f.operation==="SOCIAL_READ"&&(this.state.view!=="conversation"||!["friends","home"].includes(this.state.surface)||payload&&payload.conversationId!==this.state.room?.id))return;
      // 실패한 조회는 로딩에서 제거한다. 읽음 오류도 무한 재시도하지 않고 명시적으로 복구한다.
      if(typeof f.operation==="string")this.sentReads.delete(this.readKey({type:f.operation,conversationId:typeof payload?.conversationId==="string"?payload.conversationId:undefined,clientMessageId:typeof f.clientMessageId==="string"?f.clientMessageId:undefined}));
      const id=f.clientMessageId;
      this.set({loading:f.operation==="SOCIAL_OPEN"||f.operation==="SOCIAL_HISTORY"?false:this.state.loading,pending:this.state.pending.map(p=>p.id===id?{...p,state:"uncertain"}:p),
        error:f.code==="SOCIAL_ACCESS_DENIED"?"친구 또는 그룹 참가 상태가 변경되었어요. 새로 확인해 주세요.":f.code==="CHAT_REQUEST_RATE_LIMIT_EXCEEDED"?"잠시 후 다시 시도해 주세요.":"메시지를 처리하지 못했어요. 다시 시도해 주세요."});
      if(f.code==="SOCIAL_ACCESS_DENIED")this.scheduleRefresh();
    }
  }
  private merge(messages: readonly SocialMessage[],message: SocialMessage){return [...messages.filter(m=>m.id!==message.id),message].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id)).slice(-30);}
  // 최초 열기가 실패했어도 복구할 수 있도록 서버의 활성 방을 다시 확립한다. 과거 페이지 경계는 서버가 유지한다.
  private resyncConversation(){const s=this.state;if(!s.loading&&s.room&&s.view==="conversation"&&["friends","home"].includes(s.surface))this.emit({type:"SOCIAL_OPEN",conversationId:s.room.id,page:s.history.page});}
  private async verifyRoom(id:string,session:string){try{const room=await this.request("room",{roomId:id});if(this.state.sessionId===session&&this.state.room?.id===id&&isRoom(room))this.set({room});}catch(error){if(this.state.sessionId===session&&this.state.room?.id===id&&error instanceof AuthRequestError&&[403,404].includes(error.status))this.exitRoom();}}
  private message(error: unknown){return error instanceof AuthRequestError?error.message:"친구 기능을 일시적으로 이용할 수 없어요. 다시 시도해 주세요.";}
  /** 다시 확인은 안내를 지우고 현재 목록과 실제 열려 있는 대화 이력을 함께 복구한다. */
  async recover(){const version=this.version;this.set({error:""});await this.refresh(false);if(version!==this.version)return;this.lastRead.clear();this.resyncConversation();}
  async command(action: Operation, body: object={}, key: string=action){
    if(this.state.busy)return;
    const session=this.state.sessionId;const version=this.version;
    this.set({busy:key,error:""});
    try{const result=await this.request(action,body);if(session!==this.state.sessionId||version!==this.version)return;if(isPerson(result)&&this.state.profile?.person.publicId===result.publicId)this.set({profile:{...this.state.profile,person:result}});await this.refresh(false);if(session!==this.state.sessionId||version!==this.version)return;
      // 알림 읽음은 방 상태를 바꾸지 않는다. 다른 명령도 읽음/목록 조회와 함께 순서대로 보낸다.
      if(action!=="notification-read"&&action!=="notifications-read"){this.emit({type:"SOCIAL_SYNC"});if(action!=="direct"&&action!=="group-create")this.resyncConversation();}return result;}
    catch(error){if(session===this.state.sessionId&&version===this.version)this.set({error:this.message(error)});}
    finally{if(session===this.state.sessionId&&version===this.version)this.set({busy:null});}
  }
  launch(surface: "friends"|"notifications",document?: Document){
    if(!this.state.sessionId)return;
    const showing=this.state.surface===surface;
    this.set({surface:showing?"closed":surface,document:document??this.state.document,profile:null,error:""});
    if(!showing&&surface==="notifications")this.dismissToast();
    if(showing||surface==="notifications")this.emit({type:"SOCIAL_CLOSE"});
    else if(this.state.view==="conversation"&&this.state.room)this.emit({type:"SOCIAL_OPEN",conversationId:this.state.room.id,page:this.state.history.page});
    void this.refresh(false);
  }
  openFriends(document?: Document){this.set({surface:"friends",document:document??this.state.document});if(this.state.view==="conversation"&&this.state.room)this.emit({type:"SOCIAL_OPEN",conversationId:this.state.room.id,page:this.state.history.page});}
  close=()=>{this.set({surface:"closed",profile:null});this.emit({type:"SOCIAL_CLOSE"});};
  // 전체 선택만 홈 탭을 초기화한다. 전역 팝업을 닫아도 홈의 선택은 유지한다.
  all=()=>{this.set({homeTab:"all"});if(this.state.surface==="home")this.close();};
  home(tab: "friends"|"conversations",document: Document){this.set({surface:"home",homeTab:tab,tab,view:"list",document,profile:null,error:""});this.emit({type:"SOCIAL_CLOSE"});void this.refresh(false);}
  floatFromHome(){if(this.state.surface==="home")this.set({surface:"friends"});}
  exitRoom(){const room=this.state.room;const drafts={...this.state.drafts};if(room)delete drafts[room.id];this.set({room:null,messages:[],drafts,pending:this.state.pending.filter(p=>p.roomId!==room?.id),peerReadAt:0,view:"list",tab:"conversations"});this.emit({type:"SOCIAL_CLOSE"});}
  minimize=()=>{this.set({surface:"minimized",profile:null});this.emit({type:"SOCIAL_CLOSE"});};
  tab(tab: "friends"|"conversations"){this.set({tab,view:"list",profile:null,error:""});this.emit({type:"SOCIAL_CLOSE"});}
  // 초대·참여자 화면에서 돌아올 때도 현재 대화의 실시간 구독을 다시 연다.
  view(view: View){this.set({view,...(this.state.surface!=="home"?{surface:"friends" as const}:{}),error:"",profile:null});if(view==="conversation"&&this.state.room)this.emit({type:"SOCIAL_OPEN",conversationId:this.state.room.id,page:this.state.history.page});else this.emit({type:"SOCIAL_CLOSE"});}
  requests(highlight: string|null=null){this.set({surface:"friends",tab:"friends",view:"requests",highlight,profile:null});this.emit({type:"SOCIAL_CLOSE"});if(highlight&&!this.state.data?.received.items.some(r=>r.id===highlight))void this.locateRequest(highlight);}
  private async locateRequest(id:string){try{const value=await this.request("request-location",{requestId:id});if(this.state.highlight!==id||this.state.view!=="requests"||!object(value))return;if(value.active===true&&typeof value.page==="number")this.setPage("requestPage",value.page);else this.showToast("이미 처리되었거나 취소된 친구 요청이에요.");}catch(error){this.set({error:this.message(error)});}}
  async openDirect(person: Person){
    const room=await this.command("direct",{targetId:person.publicId},person.publicId);
    if(isRoom(room))this.openRoom(room);
  }
  openRoom(room: Room){this.set({surface:"friends",tab:"conversations",view:"conversation",room,messages:[],peerReadAt:0,history:{page:1,pageSize:30,total:0,writable:room.writable},loading:true,error:"",profile:null});this.emit({type:"SOCIAL_OPEN",conversationId:room.id,page:1});}
  history(page: number){if(!this.state.room)return;this.set({loading:true,error:""});this.emit({type:page===1?"SOCIAL_OPEN":"SOCIAL_HISTORY",conversationId:this.state.room.id,page});}
  setPage(key: keyof SocialState["pages"],value: number|string){this.set({pages:{...this.state.pages,[key]:value},loading:true});void this.refresh(false);}
  search(value:string){this.set({pages:{...this.state.pages,friendPage:1,search:value},loading:true});void this.refresh(false);}
  draft(value: string){if(this.state.room)this.set({drafts:{...this.state.drafts,[this.state.room.id]:value}});}
  send(){
    const room=this.state.room;const content=room?(this.state.drafts[room.id]??"").trim():"";
    if(!room||!room.writable||this.state.status!=="connected"||!content||[...content].length>1000)return;
    const pending: Pending={id:createUuidV4(),roomId:room.id,content,state:"queued"};
    this.set({pending:[...this.state.pending,pending].slice(-20),drafts:{...this.state.drafts,[room.id]:""},error:""});
    this.emit({type:"SOCIAL_SEND",conversationId:room.id,clientMessageId:pending.id,content});this.watchPending(pending.id);
  }
  private watchPending(id: string){clearTimeout(this.pendingTimers.get(id));this.pendingTimers.set(id,setTimeout(()=>{
    const pending=this.state.pending.find(p=>p.id===id);if(pending){this.set({pending:this.state.pending.map(p=>p.id===id?{...p,state:"uncertain"}:p)});this.emit({type:"SOCIAL_STATUS",conversationId:pending.roomId,clientMessageId:id});}
  },10_000));}
  retry(id: string){const pending=this.state.pending.find(p=>p.id===id);if(pending){this.retries.add(id);this.emit({type:"SOCIAL_STATUS",conversationId:pending.roomId,clientMessageId:id});}}
  private lastRead=new Map<string,string>();
  read(message: SocialMessage){if(this.lastRead.get(message.conversationId)!==message.id&&this.emit({type:"SOCIAL_READ",conversationId:message.conversationId,messageId:message.id}))this.lastRead.set(message.conversationId,message.id);}
  rememberScroll(room: string,value: number){this.scroll.set(room,value);}
  scrollTop(room: string){return this.scroll.get(room);}
  async showProfile(publicId: string,anchor: HTMLElement){
    // 늦게 도착한 다른 프로필·이전 로그인 응답이 현재 카드나 새 계정의 화면을 덮지 않게 한다.
    const version=this.version;const profileVersion=++this.profileVersion;
    try{const person=await this.request("profile",{targetId:publicId});if(version===this.version&&profileVersion===this.profileVersion&&isPerson(person)&&anchor.isConnected)this.set({profile:{person,anchor},document:anchor.ownerDocument,error:""});}
    catch(error){if(version===this.version&&profileVersion===this.profileVersion)this.set({error:this.message(error)});}
  }
  dismissProfile=()=>{this.profileVersion++;this.set({profile:null});};
  /** 서버의 확정 수락만 방 이동에 사용하고, 수락·거절 경합과 늦은 계정 응답을 차단한다. */
  async answerGameInvitation(id:string,action:"accept"|"reject"|"cancel",game:InvitationGame="gomoku"):Promise<number|string|null>{
    const session=this.state.sessionId;const version=this.version;
    if(!session||!this.state.authorized||this.state.gameInvitationBusy)return null;
    this.set({gameInvitationBusy:id,gameInvitationError:null});
    try{
      const result=await respondGameInvitation(game,session,action,id,this.controller?.signal);
      if(version!==this.version||session!==this.state.sessionId)return null;
      const data=this.state.data;
      if(data)this.set({data:{...data,...(game==="memory"?{memoryInvitations:data.memoryInvitations?.filter(invite=>invite.id!==id)}:game==="gomoku"?{gomokuInvitations:data.gomokuInvitations?.filter(invite=>invite.id!==id)}:{gameInvitations:data.gameInvitations?.filter(invite=>invite.id!==id)})}});
      void this.refresh(false);
      if(action==="accept"&&result.state==="ACCEPTED"){
        this.close();return result.roomId;
      }
      if(action==="accept")this.showToast("초대 시간이 지났거나 방 상태가 변경되었어요.");
    }catch(error){if(version===this.version){const message=this.message(error);this.set({gameInvitationError:{id,message}});this.showToast(message);}}
    finally{if(version===this.version)this.set({gameInvitationBusy:null});}
    return null;
  }
  notificationText(n: Notification){return n.kind==="FRIEND_REQUEST"?`${n.actor.nickname}님이 친구 요청을 보냈어요.`:n.kind==="FRIEND_ACCEPTED"?`${n.actor.nickname}님과 친구가 됐어요.`:`${n.actor.nickname}님이 그룹에 초대했어요.`;}
  // 열린 상태라도 숨은 브라우저 탭에 도착한 알림은 실제 문서로 돌아올 때 읽는다.
  private notificationsVisible(){const doc=this.state.document;return this.state.surface==="notifications"&&doc?.visibilityState==="visible"&&doc.hasFocus();}
  /** 연 시점의 공개 경계까지만 읽는다. 중복 진입은 공유하고 처리 중 새 알림은 다음 경계로 넘긴다. */
  markNotificationsRead(): Promise<void>{
    if(this.notificationRead)return this.notificationRead;
    const data=this.state.data;const boundary=data?.notificationBoundary;
    if(!boundary||!data.unreadNotifications||!this.state.authorized)return Promise.resolve();
    const version=this.version;this.set({readingNotifications:true});
    const task=this.request("notifications-read",{beforeId:boundary},this.controller?.signal).then(async()=>{
      if(version!==this.version)return;
      const current=this.state.data;
      if(current?.notificationBoundary===boundary)this.set({data:{...current,unreadNotifications:0,notifications:{...current.notifications,items:current.notifications.items.map(n=>({...n,read:true}))}},error:""});
      else await this.refresh(false);
    }).catch(error=>{if(version===this.version)this.set({error:this.message(error)});}).finally(()=>{
      if(this.notificationRead!==task)return;
      this.notificationRead=null;this.set({readingNotifications:false});
      if(version===this.version&&this.notificationsVisible()&&this.state.data?.notificationBoundary!==boundary&&this.state.data?.unreadNotifications)void this.markNotificationsRead();
    });
    this.notificationRead=task;return task;
  }
  async openNotification(n: Notification){
    if(this.state.busy||!this.state.authorized)return;
    const session=this.state.sessionId;const version=this.version;
    this.dismissToast();
    if(!n.read&&!await this.command("notification-read",{notificationId:n.id},n.id))return;
    // 알림을 처리하던 중 로그아웃·계정 교체가 완료되면 이전 화면 이동도 취소한다.
    if(session!==this.state.sessionId||version!==this.version)return;
    if(n.kind==="FRIEND_REQUEST")this.requests(n.targetId);
    // 수락 알림은 친구 목록으로 연결한다. 대화 생성은 사용자가 대화 버튼을 누를 때만 수행한다.
    else if(n.kind==="FRIEND_ACCEPTED"){this.set({surface:"friends",tab:"friends",view:"list",highlight:n.actor.publicId,profile:null,error:""});this.emit({type:"SOCIAL_CLOSE"});}
    else{this.set({surface:"friends",tab:"conversations",view:"list",highlight:n.targetId,profile:null,error:""});this.emit({type:"SOCIAL_CLOSE"});if(!this.state.data?.invitations.some(i=>i.id===n.targetId))this.showToast("이미 처리되었거나 만료된 그룹 초대예요.");}
  }
  dismissToast=(id?:string)=>{if(id&&this.state.toast?.id!==id)return;clearTimeout(this.toastTimer);this.set({toast:null});};
  /** 알림 안내의 확인은 기존 알림 이동·읽음 처리를 재사용하고 일반 안내는 닫기만 한다. */
  async confirmToast(id:string,document:Document){
    const toast=this.state.toast;if(toast?.id!==id)return;
    if(toast.notification){this.set({document});await this.openNotification(toast.notification);}
    else this.dismissToast(id);
  }
  showToast(message: string,notification?:Notification){clearTimeout(this.toastTimer);const id=createUuidV4();this.set({toast:{id,message,notification}});this.toastTimer=setTimeout(()=>this.dismissToast(id),5000);}
}

