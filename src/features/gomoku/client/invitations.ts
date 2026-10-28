import {AuthRequestError,requestAuthenticatedApi} from "@/features/auth/client/api";
import {isGomokuInvitation,object,type GomokuInvitation} from "@/features/social/contracts";
import {isGomokuInvitationDecision,type GomokuInvitationDecision} from "../invitation-contracts";

/** 기존 서명·토큰 갱신 경계로 호출하며 이전 로그인에서 끝난 초대 응답은 재사용하지 않는다. */
async function call(sessionId:string,action:"send"|"accept"|"reject"|"cancel",body:object,signal?:AbortSignal):Promise<unknown>{
  const response=await requestAuthenticatedApi(`/api/gomoku/invitations/${action}`,{sessionId,...body},signal);
  const value:unknown=await response.json();
  if(!object(value)||value.sessionId!==sessionId)throw new AuthRequestError("로그인 상태가 변경되었습니다. 다시 확인해 주세요.",409,undefined,"LOGIN_SESSION_CHANGED");
  return value;
}
export async function sendGomokuInvitation(sessionId:string,roomId:number,pageId:string,targetId:string,requestId:string,signal?:AbortSignal):Promise<GomokuInvitation>{
  const value=await call(sessionId,"send",{roomId,pageId,targetId,requestId},signal);
  if(!isGomokuInvitation(value))throw new AuthRequestError("초대 정보를 확인하지 못했습니다.",502);
  return value;
}
export async function respondGomokuInvitation(sessionId:string,action:"accept"|"reject"|"cancel",invitationId:string,signal?:AbortSignal):Promise<GomokuInvitationDecision>{
  const value=await call(sessionId,action,{invitationId},signal);
  if(!isGomokuInvitationDecision(value))throw new AuthRequestError("초대 응답을 확인하지 못했습니다.",502);
  return value;
}
