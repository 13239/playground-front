import "server-only";
import { readBrowserProof } from "@/features/auth/server/browser-proof";
import { withAuthenticatedSession } from "@/features/auth/server/refresh";
import { isSessionId } from "@/features/auth/session-id";
import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { backendRequest } from "@/lib/server/backend-client";
import { readJsonBody } from "@/lib/server/request-body";
import { assertSameOrigin } from "@/lib/server/request-security";
const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** 기존 BFF 인증·Origin·브라우저 증명을 통과한 로비 구독만 Spring에 중계한다. */
export async function handleShootingEvents(
  request: Request,
): Promise<Response> {
  try {
    assertSameOrigin(request);
    const proof = await readBrowserProof(request.clone());
    const input = await readJsonBody(request, 256);
    if (
      !isObject(input) ||
      !isSessionId(input.sessionId) ||
      Object.keys(input).some((key) => key !== "sessionId")
    ) {
      throw new ApiError("INVALID_REQUEST_BODY");
    }
    const stream = await withAuthenticatedSession(
      proof,
      (accessToken, signedProof) =>
        backendRequest("/api/shooting/events", {
          method: "POST",
          accessToken,
          proof: signedProof,
          responseType: "stream",
          signal: request.signal,
        }),
      input.sessionId,
    );
    if (!(stream instanceof Response) || !stream.body)
      throw new ApiError("INVALID_BACKEND_RESPONSE");
    // 초대 코드·방 상세 데이터는 스트림으로 중계하지 않는다. 연결 취소도 Spring까지 전달한다.
    return new Response(stream.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "private, no-store, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
