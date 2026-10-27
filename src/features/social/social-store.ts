import { connectChat, type AuthenticatedChatConnection } from "@/features/chat/client/connection";
import { requestAuthenticatedApi, AuthRequestError } from "@/features/auth/client/api";
import { notifyAuthChanged } from "@/features/auth/client/session-events";
import { createUuidV4 } from "@/lib/client/uuid";
import { object, isSnapshot, isRoom, isPerson, isResponse, isSummary, isMessage, isHistory, type Snapshot, type Room, type Person, type Summary, type SocialMessage, type Operation, type History, type Notification } from "./contracts";

type Pending = Readonly<{ id: string; roomId: string; content: string; state: "queued"|"uncertain" }>;
type View = "list"|"requests"|"conversation"|"create"|"members"|"invite";
export type SocialState = Readonly<{
  sessionId: string|null; authorized: boolean; status: "login"|"connecting"|"connected"|"reconnecting"; data: Snapshot|null;
  surface: "closed"|"friends"|"home"|"notifications"|"minimized"; tab: "friends"|"conversations"; view: View;
  room: Room|null; messages: readonly SocialMessage[]; pending: readonly Pending[]; drafts: Readonly<Record<string,string>>;
  summaries: Readonly<Record<string,Summary>>; history: Pick<History,"page"|"pageSize"|"total"|"writable">;
  busy: string|null; error: string; loading: boolean; profile: {person: Person; anchor: HTMLElement}|null;
  highlight: string|null; toast: {id: string; message: string}|null; document: Document|null; peerReadAt: number;
  pages: {friendPage: number; requestPage: number; sentPage: number; roomPage: number; notificationPage: number; search: string};
}>;
const initial: SocialState={sessionId:null,authorized:false,status:"login",data:null,surface:"closed",tab:"friends",view:"list",room:null,messages:[],pending:[],drafts:{},summaries:{},peerReadAt:0,
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
  private readRetry: ReturnType<typeof setTimeout>|undefined;
  private pendingTimers=new Map<string,ReturnType<typeof setTimeout>>();
  private retries=new Set<string>();
  private version=0;
  private refreshVersion=0;
  private attempt=0;
  private lastNotification: string|null=null;
  private notificationInitialized=false;
  private scroll=new Map<string,number>();
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  getSnapshot=()=>this.state;
  getServerSnapshot=()=>initial;
  private set(patch: Partial<SocialState>){this.state={...this.state,...patch};this.listeners.forEach(listener=>listener());}
  private emit(frame: object){if(this.connection?.socket.readyState!==WebSocket.OPEN)return false;this.connection.socket.send(JSON.stringify({version:1,...frame}));return true;}
  async request(operation: Operation, body: object={}, signal?: AbortSignal): Promise<unknown> {
    const session=this.state.sessionId;if(!session||!this.state.authorized)throw new AuthRequestError("로그인 후 이용해 주세요.",401);
    const response=await requestAuthenticatedApi(`/api/social/${operation}`,{sessionId:session,...body},signal);
    const data: unknown=await response.json();
    if(this.state.sessionId!==session||!object(data)||data.sessionId!==session||!isResponse(operation,data))throw new AuthRequestError("친구 정보를 확인하지 못했습니다.",502);
    return data;
  }
  start(sessionId: string){if(this.state.sessionId===sessionId&&this.state.authorized)return;if(this.state.sessionId!==sessionId)this.stop();this.controller=new AbortController();this.set({sessionId,authorized:true,status:"connecting"});void this.connect(this.version);}
  suspend(){if(!this.state.authorized)return;this.version++;this.refreshVersion++;this.controller?.abort();this.connection?.close();this.connection=null;clearTimeout(this.reconnect);this.reconnect=undefined;clearInterval(this.heartbeat);clearTimeout(this.refreshTimer);clearTimeout(this.readRetry);this.lastRead.clear();this.set({authorized:false,status:"connecting",busy:null,loading:false,profile:null});}
  stop(){
    this.version++;this.refreshVersion++;this.controller?.abort();this.connection?.close();this.connection=null;
    clearTimeout(this.reconnect);this.reconnect=undefined;clearTimeout(this.refreshTimer);clearTimeout(this.toastTimer);clearTimeout(this.readRetry);clearInterval(this.heartbeat);
    this.pendingTimers.forEach(clearTimeout);this.pendingTimers.clear();this.retries.clear();this.scroll.clear();this.lastRead.clear();this.lastNotification=null;this.notificationInitialized=false;this.attempt=0;this.set(initial);
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
    this.set({status:"reconnecting",pending:this.state.pending.map(p=>({...p,state:"uncertain"}))});
    this.reconnect=setTimeout(()=>{this.reconnect=undefined;void this.connect(version);},Math.min(30_000,1000*2**Math.min(this.attempt++,5)));
  }
  async refresh(toast=true){
    const version=++this.refreshVersion;const session=this.state.sessionId;if(!session)return;
    try{
      const data=await this.request("snapshot",this.state.pages,this.controller?.signal);
      if(version!==this.refreshVersion||session!==this.state.sessionId||!isSnapshot(data))return;
      const newest=data.notifications.items[0];
      // 빈 수신함에 처음 도착한 알림도 안내한다. 목록 페이지 이동을 새 알림으로 오인하지 않는다.
      if(toast&&this.notificationInitialized&&data.notificationBoundary!==this.lastNotification&&data.unreadNotifications>0)
        this.showToast(newest?.id===data.notificationBoundary?this.notificationText(newest):"새 친구 활동 알림이 도착했어요.");
      this.lastNotification=data.notificationBoundary;this.notificationInitialized=true;
      let room=this.state.room;
      const updated=room&&data.rooms.items.find(r=>r.id===room?.id);
      if(updated)room=updated;
      this.set({data,room,loading:false});
      if(room&&!updated)void this.verifyRoom(room.id,session);
    }catch(error){if(version===this.refreshVersion&&!this.controller?.signal.aborted)this.set({loading:false,error:this.message(error)});}
  }
  private scheduleRefresh(){clearTimeout(this.refreshTimer);this.refreshTimer=setTimeout(()=>{void this.refresh().then(()=>{this.emit({type:"SOCIAL_SYNC"});this.resyncConversation();});},200);}
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
    if(f.type==="SOCIAL_HISTORY"&&isHistory(payload)&&payload.conversationId===this.state.room?.id){
      const confirmed=new Set(payload.messages.map(m=>m.clientMessageId));
      this.set({messages:payload.messages,pending:this.state.pending.filter(p=>!confirmed.has(p.id)),peerReadAt:payload.peerReadAt??0,history:{page:payload.page,pageSize:payload.pageSize,total:payload.total,writable:payload.writable},loading:false});
      return;
    }
    if((f.type==="CHAT_MESSAGE"||f.type==="CHAT_STATUS_RESULT")&&isMessage(f.message)){
      const m=f.message;
      const isNew=f.type==="CHAT_MESSAGE"&&m.conversationId===this.state.room?.id&&!this.state.messages.some(message=>message.id===m.id);
      const messages=m.conversationId===this.state.room?.id&&this.state.history.page===1?this.merge(this.state.messages,m):this.state.messages;
      if(m.clientMessageId){clearTimeout(this.pendingTimers.get(m.clientMessageId));this.pendingTimers.delete(m.clientMessageId);this.retries.delete(m.clientMessageId);}
      this.set({messages,pending:this.state.pending.filter(p=>p.id!==m.clientMessageId),...(isNew?{history:{...this.state.history,total:this.state.history.total+1}}:{})});
      return;
    }
    if(f.type==="CHAT_STATUS_RESULT"&&f.stored===false&&typeof f.clientMessageId==="string"){
      const pending=this.state.pending.find(p=>p.id===f.clientMessageId);
      if(pending&&this.retries.delete(pending.id)){
        this.emit({type:"SOCIAL_SEND",conversationId:pending.roomId,clientMessageId:pending.id,content:pending.content});this.watchPending(pending.id);
      }else this.set({pending:this.state.pending.map(p=>p.id===f.clientMessageId?{...p,state:"uncertain"}:p)});
    }
    if(f.type==="CHAT_ERROR"){
      if(f.operation==="SOCIAL_READ"){
        const room=this.state.room;this.lastRead.delete(room?.id??"");clearTimeout(this.readRetry);
        this.readRetry=setTimeout(()=>{const doc=this.state.document;const last=this.state.messages.at(-1);if(last&&this.state.view==="conversation"&&["friends","home"].includes(this.state.surface)&&doc?.hasFocus()&&doc.visibilityState==="visible")this.read(last);},1200);
        return;
      }
      const id=f.clientMessageId;
      this.set({loading:false,pending:this.state.pending.map(p=>p.id===id?{...p,state:"uncertain"}:p),
        error:f.code==="SOCIAL_ACCESS_DENIED"?"친구 또는 그룹 참가 상태가 변경되었어요. 새로 확인해 주세요.":f.code==="CHAT_REQUEST_RATE_LIMIT_EXCEEDED"?"잠시 후 다시 시도해 주세요.":"메시지를 처리하지 못했어요. 다시 시도해 주세요."});
      if(f.code==="SOCIAL_ACCESS_DENIED")this.scheduleRefresh();
    }
  }
  private merge(messages: readonly SocialMessage[],message: SocialMessage){return [...messages.filter(m=>m.id!==message.id),message].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id)).slice(-30);}
  private resyncConversation(){const s=this.state;if(s.room&&s.view==="conversation"&&["friends","home"].includes(s.surface))this.emit({type:"SOCIAL_HISTORY",conversationId:s.room.id,page:s.history.page});}
  private async verifyRoom(id:string,session:string){try{const room=await this.request("room",{roomId:id});if(this.state.sessionId===session&&this.state.room?.id===id&&isRoom(room))this.set({room});}catch(error){if(this.state.sessionId===session&&this.state.room?.id===id&&error instanceof AuthRequestError&&[403,404].includes(error.status))this.exitRoom();}}
  private message(error: unknown){return error instanceof AuthRequestError?error.message:"친구 기능을 일시적으로 이용할 수 없어요. 다시 시도해 주세요.";}
  async command(action: Operation, body: object={}, key: string=action){
    if(this.state.busy)return;
    const session=this.state.sessionId;const version=this.version;
    this.set({busy:key,error:""});
    try{const result=await this.request(action,body);if(session!==this.state.sessionId||version!==this.version)return;if(isPerson(result)&&this.state.profile?.person.publicId===result.publicId)this.set({profile:{...this.state.profile,person:result}});await this.refresh(false);if(session!==this.state.sessionId||version!==this.version)return;this.emit({type:"SOCIAL_SYNC"});this.resyncConversation();return result;}
    catch(error){if(session===this.state.sessionId&&version===this.version)this.set({error:this.message(error)});}
    finally{if(session===this.state.sessionId&&version===this.version)this.set({busy:null});}
  }
  launch(surface: "friends"|"notifications",document?: Document){
    if(!this.state.sessionId)return;
    const showing=this.state.surface===surface;
    this.set({surface:showing?"closed":surface,document:document??this.state.document,profile:null,error:""});
    if(showing||surface==="notifications")this.emit({type:"SOCIAL_CLOSE"});
    else if(this.state.view==="conversation"&&this.state.room)this.emit({type:"SOCIAL_OPEN",conversationId:this.state.room.id,page:this.state.history.page});
    void this.refresh(false);
  }
  openFriends(document?: Document){this.set({surface:"friends",document:document??this.state.document});if(this.state.view==="conversation"&&this.state.room)this.emit({type:"SOCIAL_OPEN",conversationId:this.state.room.id,page:this.state.history.page});}
  close=()=>{this.set({surface:"closed",profile:null});this.emit({type:"SOCIAL_CLOSE"});};
  home(tab: "friends"|"conversations",document: Document){this.set({surface:"home",tab,view:"list",document,profile:null});this.emit({type:"SOCIAL_CLOSE"});void this.refresh(false);}
  floatFromHome(){if(this.state.surface==="home")this.set({surface:"friends"});}
  exitRoom(){const room=this.state.room;const drafts={...this.state.drafts};if(room)delete drafts[room.id];this.set({room:null,messages:[],drafts,pending:this.state.pending.filter(p=>p.roomId!==room?.id),peerReadAt:0,view:"list",tab:"conversations"});this.emit({type:"SOCIAL_CLOSE"});}
  minimize=()=>{this.set({surface:"minimized",profile:null});this.emit({type:"SOCIAL_CLOSE"});};
  tab(tab: "friends"|"conversations"){this.set({tab,view:"list",profile:null,error:""});this.emit({type:"SOCIAL_CLOSE"});}
  // 초대·참여자 화면에서 돌아올 때도 현재 대화의 실시간 구독을 다시 연다.
  view(view: View){this.set({view,error:"",profile:null});if(view==="conversation"&&this.state.room)this.emit({type:"SOCIAL_OPEN",conversationId:this.state.room.id,page:this.state.history.page});else this.emit({type:"SOCIAL_CLOSE"});}
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
    try{const person=await this.request("profile",{targetId:publicId});if(isPerson(person)&&anchor.isConnected)this.set({profile:{person,anchor},document:anchor.ownerDocument,error:""});}
    catch(error){this.set({error:this.message(error)});}
  }
  dismissProfile=()=>this.set({profile:null});
  notificationText(n: Notification){return n.kind==="FRIEND_REQUEST"?`${n.actor.nickname}님이 친구 요청을 보냈어요.`:n.kind==="FRIEND_ACCEPTED"?`${n.actor.nickname}님과 친구가 됐어요.`:`${n.actor.nickname}님이 그룹에 초대했어요.`;}
  async openNotification(n: Notification){
    const session=this.state.sessionId;const version=this.version;
    await this.command("notification-read",{notificationId:n.id},n.id);
    // 알림을 처리하던 중 로그아웃·계정 교체가 완료되면 이전 화면 이동도 취소한다.
    if(session!==this.state.sessionId||version!==this.version)return;
    if(n.kind==="FRIEND_REQUEST")this.requests(n.targetId);
    else if(n.kind==="FRIEND_ACCEPTED")await this.openDirect({...n.actor,relation:"FRIEND"});
    else{this.set({surface:"friends",tab:"conversations",view:"list",highlight:n.targetId});if(!this.state.data?.invitations.some(i=>i.id===n.targetId))this.showToast("이미 처리되었거나 만료된 그룹 초대예요.");}
  }
  showToast(message: string){clearTimeout(this.toastTimer);this.set({toast:{id:createUuidV4(),message}});this.toastTimer=setTimeout(()=>this.set({toast:null}),5000);}
}

