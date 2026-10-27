import { readBrowserProof } from "@/features/auth/server/browser-proof";
import { withAuthenticatedSession } from "@/features/auth/server/refresh";
import { isSessionId } from "@/features/auth/session-id";
import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { backendRequest } from "@/lib/server/backend-client";
import { readJsonBody } from "@/lib/server/request-body";
import { assertSameOrigin } from "@/lib/server/request-security";
import { object, operations, isResponse, uuid, type Operation } from "@/features/social/contracts";
import { publicSocialResponse } from "@/features/social/server/public-response";
/** 본인 세션과 브라우저 서명으로만 호출하며 경로·본문을 허용 목록으로 제한한다. */
export const runtime="nodejs";
export async function POST(request: Request, context: {params: Promise<{operation: string}>}) {
  try {
    assertSameOrigin(request);
    const action=(await context.params).operation;
    if(!Object.hasOwn(operations,action))throw new ApiError("INVALID_REQUEST_BODY");
    const operation=action as Operation;
    const proof=await readBrowserProof(request.clone());
    const input=await readJsonBody(request,4096);
    const allowed: readonly string[]=operations[operation];
    if(!object(input)||!isSessionId(input.sessionId)||Object.keys(input).some(key=>key!=="sessionId"&&!allowed.includes(key)))throw new ApiError("INVALID_REQUEST_BODY");
    const body: Record<string,unknown>={};
    for(const key of allowed) {
      const value=input[key];if(value===undefined)continue;
      if(key.endsWith("Page")&&(typeof value!=="number"||!Number.isSafeInteger(value)||value<1||value>10000)
        ||["targetId","requestId","roomId","invitationId","notificationId","beforeId"].includes(key)&&value!==null&&(typeof value!=="string"||!uuid.test(value))
        ||["name","search"].includes(key)&&(typeof value!=="string"||[...value].length>50)
        ||key==="muted"&&typeof value!=="boolean"
        ||key==="userIds"&&(!Array.isArray(value)||value.length>9||!value.every(id=>typeof id==="string"&&uuid.test(id))))throw new ApiError("INVALID_REQUEST_BODY");
      body[key]=value;
    }
    const sessionId=input.sessionId;
    const value=await withAuthenticatedSession(proof,(accessToken,proof)=>backendRequest(`/api/social/${operation}`,{method:"POST",body,accessToken,proof}),sessionId);
    if(!isResponse(operation,value)||!object(value))throw new ApiError("INVALID_BACKEND_RESPONSE");
    // 검증된 DTO라도 내부 회원 번호 등 향후 추가 필드를 그대로 브라우저에 노출하지 않는다.
    return Response.json({...publicSocialResponse(value),sessionId},{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){return apiErrorResponse(error);}
}

