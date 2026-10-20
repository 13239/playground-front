import { readAuthCookie } from "@/features/auth/server/cookies";
import { backendRequest } from "@/lib/server/backend-client";
import { getTrustedClientIp } from "@/lib/server/client-ip";
import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { readJsonBody } from "@/lib/server/request-body";
import { assertSameOrigin } from "@/lib/server/request-security";

/** nonce와 서버 시각만 공개한다. 쿠키의 토큰은 BFF→Spring 내부 통신에만 사용한다. */
export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const value = await readJsonBody(request, 512);
    if (typeof value !== "object" || value === null || !("keyThumbprint" in value)
      || typeof value.keyThumbprint !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value.keyThumbprint)
      || !("purpose" in value) || value.purpose !== "login" && value.purpose !== "session") throw new ApiError("INVALID_REQUEST_BODY");
    const session = value.purpose === "session" ? await readAuthCookie() : null;
    if (value.purpose === "session" && !session) throw new ApiError("AUTHENTICATION_REQUIRED");
    const result = await backendRequest("/api/auth/proof-challenge", {
      method: "POST", body: { keyThumbprint: value.keyThumbprint, ...(session && { refreshToken: session.refreshToken }) },
      clientIp: getTrustedClientIp(request),
    });
    // 백엔드의 임의 필드가 추가되어도 토큰·사용자 정보가 공개 응답으로 흘러가지 않게 필드를 지정한다.
    if (typeof result !== "object" || result === null || !("nonce" in result) || typeof result.nonce !== "string"
      || result.nonce.length > 2048 || !("serverTime" in result) || typeof result.serverTime !== "string"
      || !("expiresAt" in result) || typeof result.expiresAt !== "string") throw new ApiError("INVALID_BACKEND_RESPONSE");
    return Response.json({ nonce: result.nonce, serverTime: result.serverTime, expiresAt: result.expiresAt }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}
