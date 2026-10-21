import { readBrowserProof } from "@/features/auth/server/browser-proof";
import { withAuthenticatedSession } from "@/features/auth/server/refresh";
import { isSessionId } from "@/features/auth/session-id";
import { isChatTicket, publicChatTicket } from "@/features/chat/contracts";
import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { backendRequest } from "@/lib/server/backend-client";
import { getAppEnvironment, getAppOrigin } from "@/lib/server/env";
import { readJsonBody } from "@/lib/server/request-body";
import { assertSameOrigin } from "@/lib/server/request-security";

/** Node의 기존 BFF 전송·쿠키 경계를 재사용하며 이 Route Handler에서 WebSocket 업그레이드는 처리하지 않는다. */
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const proof = await readBrowserProof(request.clone());
    const input = await readJsonBody(request, 128);
    if (typeof input !== "object" || input === null || Array.isArray(input)
      || !("sessionId" in input) || !isSessionId(input.sessionId)
      || Object.keys(input).some((key) => key !== "sessionId")) throw new ApiError("INVALID_REQUEST_BODY");
    const sessionId = input.sessionId;
    const value = await withAuthenticatedSession(proof,
      (accessToken, proof) => backendRequest("/api/chat/tickets", { method: "POST", accessToken, proof }),
      sessionId);
    if (!isChatTicket(value)) throw new ApiError("INVALID_BACKEND_RESPONSE");

    const environment = getAppEnvironment();
    const origin = new URL(getAppOrigin());
    const target = new URL(value.websocketUrl);
    // 원격 환경은 같은 공개 호스트만 허용한다. local의 별도 chat 포트도 실제 루프백 주소만 허용한다.
    if (value.proofRequired !== (environment !== "dev")
      || origin.protocol === "https:" && target.protocol !== "wss:"
      || environment !== "local" && target.host !== origin.host
      || environment === "local" && !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)) {
      throw new ApiError("INVALID_BACKEND_RESPONSE");
    }
    return Response.json({ ...publicChatTicket(value), sessionId },
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}
