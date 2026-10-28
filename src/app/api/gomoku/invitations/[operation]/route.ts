import {readBrowserProof} from "@/features/auth/server/browser-proof";
import {withAuthenticatedSession} from "@/features/auth/server/refresh";
import {isSessionId} from "@/features/auth/session-id";
import {isGomokuInvitationDecision} from "@/features/gomoku/invitation-contracts";
import {isGomokuInvitation,object,uuid} from "@/features/social/contracts";
import {publicGomokuInvitation} from "@/features/social/server/public-response";
import {ApiError,apiErrorResponse} from "@/lib/server/api-error";
import {backendRequest} from "@/lib/server/backend-client";
import {readJsonBody} from "@/lib/server/request-body";
import {assertSameOrigin} from "@/lib/server/request-security";

/** 고정 동작·본인 세션·서명된 필수 입력만 받는다. 수신자·기한·방 권한은 원본 서버가 결정한다. */
export const runtime="nodejs";
export async function POST(request: Request,context:{params:Promise<{operation:string}>}) {
  try {
    assertSameOrigin(request);
    const {operation}=await context.params;
    if(!["send","accept","reject","cancel"].includes(operation))throw new ApiError("INVALID_REQUEST_BODY");
    const proof=await readBrowserProof(request.clone());
    const input=await readJsonBody(request,1024);
    if(!object(input)||!isSessionId(input.sessionId))throw new ApiError("INVALID_REQUEST_BODY");
    const allowed=operation==="send"?["roomId","pageId","targetId","requestId"]:["invitationId"];
    if(Object.keys(input).some(key=>key!=="sessionId"&&!allowed.includes(key)))throw new ApiError("INVALID_REQUEST_BODY");
    const body:Record<string,unknown>={};
    for(const key of allowed){
      const value=input[key];
      if(key==="roomId"?typeof value!=="number"||!Number.isSafeInteger(value)||value<1:typeof value!=="string"||!uuid.test(value))throw new ApiError("INVALID_REQUEST_BODY");
      body[key]=value;
    }
    const value=await withAuthenticatedSession(proof,(accessToken,proof)=>backendRequest(`/api/gomoku/invitations/${operation}`,{method:"POST",body,accessToken,proof}),input.sessionId);
    if(operation==="send"){
      if(!isGomokuInvitation(value))throw new ApiError("INVALID_BACKEND_RESPONSE");
      return Response.json({...publicGomokuInvitation(value),sessionId:input.sessionId},{headers:{"Cache-Control":"private, no-store"}});
    }
    if(!isGomokuInvitationDecision(value))throw new ApiError("INVALID_BACKEND_RESPONSE");
    return Response.json({state:value.state,roomId:value.roomId,sessionId:input.sessionId},{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){return apiErrorResponse(error);}
}
