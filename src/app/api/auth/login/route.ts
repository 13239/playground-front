import { loginWithBackend } from "@/features/auth/server/api";
import { writeAuthCookie } from "@/features/auth/server/cookies";
import { parseLoginInput } from "@/features/auth/server/login-input";
import { apiErrorResponse } from "@/lib/server/api-error";
import { getTrustedClientIp } from "@/lib/server/client-ip";
import { getAuthCookieKey } from "@/lib/server/env";
import { readJsonBody } from "@/lib/server/request-body";
import { assertSameOrigin } from "@/lib/server/request-security";

/** 로그인 토큰은 암호화 HttpOnly 쿠키에만 저장하고 응답 본문으로 반환하지 않는다. */
export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const input = parseLoginInput(await readJsonBody(request));
    const clientIp = getTrustedClientIp(request);
    // 설정 실패로 쿠키를 저장할 수 없는 상태에서 Spring 세션부터 생성하지 않는다.
    getAuthCookieKey();
    await writeAuthCookie(await loginWithBackend(input, clientIp));
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
