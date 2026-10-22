import "server-only";
import { readBrowserProof } from "@/features/auth/server/browser-proof";
import { withAuthenticatedSession } from "@/features/auth/server/refresh";
import { isSessionId } from "@/features/auth/session-id";
import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { backendRequest } from "@/lib/server/backend-client";
import { readJsonBody } from "@/lib/server/request-body";
import { assertSameOrigin } from "@/lib/server/request-security";
import { isObject, requestIdPattern } from "../contracts";
import { isGameAction } from "../game-contracts";
import { isWaitingRoom, publicWaitingRoom } from "../waiting-contracts";

/** 명령의 실제 본문과 이벤트 연결도 로그인 세션·Origin·브라우저 증명을 검증한다. */
export async function handleGameRequest(request: Request, stream = false): Promise<Response> {
  try {
    assertSameOrigin(request);
    const proof = await readBrowserProof(request.clone());
    const input = await readJsonBody(request, 2048);
    const allowed = stream ? ["sessionId", "roomId"] : ["sessionId", "roomId", "matchId", "revision", "requestId", "action", "x", "y", "card", "accept"];
    if (!isObject(input) || !isSessionId(input.sessionId) || typeof input.roomId !== "number" || !Number.isSafeInteger(input.roomId)
      || input.roomId < 1 || Object.keys(input).some(key => !allowed.includes(key))) throw new ApiError("INVALID_REQUEST_BODY");
    if (!stream && (typeof input.matchId !== "number" || !Number.isSafeInteger(input.matchId) || input.matchId < 1
      || typeof input.revision !== "number" || !Number.isSafeInteger(input.revision) || input.revision < 0
      || typeof input.requestId !== "string" || !requestIdPattern.test(input.requestId) || !isGameAction(input))) {
      throw new ApiError("INVALID_REQUEST_BODY");
    }
    const { sessionId, ...body } = input;
    const result = await withAuthenticatedSession(proof, (accessToken, signedProof) => backendRequest(
      stream ? "/api/gomoku/rooms/game/events" : "/api/gomoku/rooms/game", {
        method: "POST", accessToken, proof: signedProof, body,
        ...(stream && { responseType: "stream" as const, signal: request.signal }),
      }), sessionId);
    if (stream) {
      if (!(result instanceof Response) || !result.body) throw new ApiError("INVALID_BACKEND_RESPONSE");
      // 고정된 변경 알림만 통과한다. 프록시 버퍼·변환 캐시와 업스트림 내부 헤더는 사용하지 않는다.
      return new Response(result.body, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "private, no-store, no-transform", "X-Accel-Buffering": "no" } });
    }
    if (!isWaitingRoom(result)) throw new ApiError("INVALID_BACKEND_RESPONSE");
    return Response.json({ ...publicWaitingRoom(result), sessionId }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}
