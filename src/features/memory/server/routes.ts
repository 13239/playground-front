import "server-only";
import { readBrowserProof } from "@/features/auth/server/browser-proof";
import { withAuthenticatedSession } from "@/features/auth/server/refresh";
import { isSessionId } from "@/features/auth/session-id";
import { ApiError,apiErrorResponse } from "@/lib/server/api-error";
import { backendRequest } from "@/lib/server/backend-client";
import { readJsonBody } from "@/lib/server/request-body";
import { assertSameOrigin } from "@/lib/server/request-security";
import { object,uuid } from "@/features/social/contracts";
import { publicMemoryInvitation } from "@/features/social/server/public-response";
import { isMemoryState,isMemoryOverview,isMemoryInvitation,isDecision,publicMemoryState,publicMemoryOverview } from "../contracts";

const fields:Readonly<Record<string,readonly string[]>>={
  overview:["page","roomPage"],start:["requestId","tabId"],create:["requestId","tabId","title","privateRoom","password"],
  join:["roomId","code","password","tabId"],state:["roomId","tabId"],events:["roomId","tabId"],
  ready:["roomId","tabId","requestId","revision","ready"],flip:["roomId","tabId","requestId","revision","matchId","position"],
  leave:["roomId","tabId","requestId","revision","matchId"],rematch:["roomId","tabId","requestId","revision","matchId"],
  "invitations/send":["roomId","tabId","requestId","targetId"],"invitations/accept":["invitationId","tabId"],"invitations/reject":["invitationId"],"invitations/cancel":["invitationId"],
};
/** 임의 프록시 경로와 추가 입력을 거절하고 기존 Origin·세션·본문 증명을 유지한다. */
export async function handleMemory(request:Request,operation:string):Promise<Response>{
  try{
    if(!Object.hasOwn(fields,operation))throw new ApiError("INVALID_REQUEST_BODY");
    assertSameOrigin(request);const proof=await readBrowserProof(request.clone());const input=await readJsonBody(request,4096);
    if(!object(input)||!isSessionId(input.sessionId)||Object.keys(input).some(k=>k!=="sessionId"&&!fields[operation].includes(k)))throw new ApiError("INVALID_REQUEST_BODY");
    for(const [key,value] of Object.entries(input)){
      if(["tabId","requestId","matchId","targetId","invitationId"].includes(key)&&!(key==="matchId"&&value===null)
        &&(typeof value!=="string"||!uuid.test(value)))throw new ApiError("INVALID_REQUEST_BODY");
      if(["roomId","page","roomPage","revision","position"].includes(key)&&(!Number.isSafeInteger(value)||Number(value)<(["revision","position"].includes(key)?0:1)
        ||Number(value)>(key==="position"?29:["page","roomPage"].includes(key)?10000:Number.MAX_SAFE_INTEGER)))throw new ApiError("INVALID_REQUEST_BODY");
    }
    if((input.password!==undefined&&(typeof input.password!=="string"||input.password.length>64))
      ||(input.title!==undefined&&(typeof input.title!=="string"||[...input.title].length>30))
      ||(input.code!==undefined&&(typeof input.code!=="string"||!/^[A-Z0-9]{6}$/.test(input.code)))
      ||["privateRoom","ready"].some(k=>input[k]!==undefined&&typeof input[k]!=="boolean"))throw new ApiError("INVALID_REQUEST_BODY");
    const {sessionId,...body}=input;const stream=operation==="events";
    const result=await withAuthenticatedSession(proof,(accessToken,signedProof)=>backendRequest(`/api/memory/${operation}`,{
      method:"POST",accessToken,proof:signedProof,body,...(stream?{responseType:"stream" as const,signal:request.signal}:{}),
    }),sessionId);
    if(stream){if(!(result instanceof Response)||!result.body)throw new ApiError("INVALID_BACKEND_RESPONSE");
      return new Response(result.body,{headers:{"Content-Type":"text/event-stream","Cache-Control":"private, no-store, no-transform","X-Accel-Buffering":"no"}});}
    const output=operation==="overview"?(isMemoryOverview(result)?publicMemoryOverview(result):undefined)
      :operation==="invitations/send"?(isMemoryInvitation(result)?publicMemoryInvitation(result):undefined)
      :operation.startsWith("invitations/")?(isDecision(result)?{state:result.state,roomId:result.roomId}:undefined)
      :isMemoryState(result)?publicMemoryState(result):undefined;
    if(!output)throw new ApiError("INVALID_BACKEND_RESPONSE");
    return Response.json({...output,sessionId},{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){return apiErrorResponse(error);}
}
