import { readBrowserProof } from "@/features/auth/server/browser-proof";
import { withAuthenticatedSession } from "@/features/auth/server/refresh";
import { isSessionId } from "@/features/auth/session-id";
import { gameCodePattern, isCatalogMode, publicMode } from "@/features/games/contracts";
import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { backendRequest } from "@/lib/server/backend-client";
import { readJsonBody } from "@/lib/server/request-body";
import { assertSameOrigin } from "@/lib/server/request-security";

/** 직접 주소의 로컬 게임 시작도 Origin·현재 세션·경로/본문에 결합된 브라우저 증명을 확인한다. */
export async function POST(request: Request, context: { params: Promise<{ code: string; mode: string }> }): Promise<Response> {
  try {
    assertSameOrigin(request);
    const { code, mode } = await context.params;
    if (!gameCodePattern.test(code) || !gameCodePattern.test(mode)) throw new ApiError("INVALID_REQUEST_BODY");
    const proof = await readBrowserProof(request.clone());
    const input = await readJsonBody(request, 512);
    if (typeof input !== "object" || input === null || !("sessionId" in input) || !isSessionId(input.sessionId)
      || Object.keys(input).length !== 1) throw new ApiError("INVALID_REQUEST_BODY");
    const result = await withAuthenticatedSession(proof, (accessToken, signedProof) => backendRequest(`/api/games/${code}/modes/${mode}/admission`,
      { method: "POST", accessToken, proof: signedProof, body: {} }), input.sessionId);
    if (!isCatalogMode(result) || result.code !== mode || !result.published || !result.supported || result.availability !== "AVAILABLE") throw new ApiError("INVALID_BACKEND_RESPONSE");
    return Response.json(publicMode(result), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}
