import { AuthRequestError,requestAuthenticatedApi } from "@/features/auth/client/api";
import { object } from "@/features/social/contracts";
import { createUuidV4 } from "@/lib/client/uuid";
import { isMemoryState,isMemoryOverview,isDecision,isMemoryInvitation,type MemoryState } from "../contracts";

export type MemoryOperation="overview"|"start"|"create"|"join"|"state"|"ready"|"flip"|"leave"|"rematch";
/** 새로고침은 같은 탭을 복원한다. 계정 변경 뒤의 늦은 응답은 세션 대조로 버린다. */
let tabId:string|undefined;
export function memoryTabId(){
  if(tabId)return tabId;
  const key="memory:tab:v1";
  try{tabId=sessionStorage.getItem(key)??createUuidV4();sessionStorage.setItem(key,tabId);}
  catch{tabId=createUuidV4();} // 저장소가 차단되어도 현재 문서의 요청 식별자는 일정하게 유지한다.
  return tabId;
}
async function raw(sessionId:string,operation:MemoryOperation|`invitations/${"send"|"accept"|"reject"|"cancel"}`,body:Record<string,unknown>,signal?:AbortSignal){
  const response=await requestAuthenticatedApi(`/api/memory/${operation}`,{sessionId,...body},signal);
  const value:unknown=await response.json();if(!object(value)||value.sessionId!==sessionId)throw new AuthRequestError("게임 응답을 확인하지 못했어요.",502);return value;
}
export async function memoryOverview(sessionId:string,page=1,roomPage=1,signal?:AbortSignal){const v=await raw(sessionId,"overview",{page,roomPage},signal);if(!isMemoryOverview(v))throw new AuthRequestError("랭킹을 확인하지 못했어요.",502);return v;}
export async function memoryRequest(sessionId:string,operation:Exclude<MemoryOperation,"overview">,body:Record<string,unknown>,signal?:AbortSignal):Promise<MemoryState>{
  const v=await raw(sessionId,operation,{tabId:memoryTabId(),...body},signal);if(!isMemoryState(v))throw new AuthRequestError("카드 상태를 확인하지 못했어요.",502);return v;
}
export async function sendMemoryInvitation(sessionId:string,roomId:number,pageId:string,targetId:string,requestId:string){
  const v=await raw(sessionId,"invitations/send",{roomId,tabId:pageId,targetId,requestId});if(!isMemoryInvitation(v))throw new AuthRequestError("초대를 확인하지 못했어요.",502);return v;
}
export async function respondMemoryInvitation(sessionId:string,action:"accept"|"reject"|"cancel",invitationId:string,signal?:AbortSignal){
  const v=await raw(sessionId,`invitations/${action}`,{invitationId,...(action==="accept"?{tabId:memoryTabId()}: {})},signal);
  if(!isDecision(v))throw new AuthRequestError("초대 응답을 확인하지 못했어요.",502);return v;
}
/** SSE는 변경 신호만 수신하고 실제 판은 인증된 state로 복구한다. */
export async function watchMemory(sessionId:string,roomId:number,signal:AbortSignal,changed:()=>void){
  const response=await requestAuthenticatedApi("/api/memory/events",{sessionId,roomId,tabId:memoryTabId()},signal);
  if(!response.body)throw new AuthRequestError("게임 알림에 연결하지 못했어요.",502);
  const reader=response.body.getReader(),decoder=new TextDecoder();let buffer="";
  const cancel=()=>{void reader.cancel().catch(()=>{});};signal.addEventListener("abort",cancel,{once:true});
  try{while(!signal.aborted){const chunk=await reader.read();if(chunk.done)break;
    buffer=(buffer+decoder.decode(chunk.value,{stream:true})).replaceAll("\r\n","\n");if(buffer.length>16384)throw new Error("Invalid stream");
    let end:number;while((end=buffer.indexOf("\n\n"))>=0){const event=buffer.slice(0,end);buffer=buffer.slice(end+2);
      if(/^event:\s*(changed|ready)$/m.test(event))changed();}
  }}finally{signal.removeEventListener("abort",cancel);await reader.cancel().catch(()=>{});reader.releaseLock();}
}
