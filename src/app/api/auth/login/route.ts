import { loginWithBackend } from "@/features/auth/server/api";
import { readAuthCookie, writeAuthCookie } from "@/features/auth/server/cookies";
import { parseLoginInput } from "@/features/auth/server/login-input";
import { apiErrorResponse } from "@/lib/server/api-error";
import { getTrustedClientIp } from "@/lib/server/client-ip";
import { getClientUserAgent } from "@/lib/server/client-user-agent";
import { getAuthCookieKey } from "@/lib/server/env";
import { readJsonBody } from "@/lib/server/request-body";
import { assertSameOrigin } from "@/lib/server/request-security";
import { readBrowserProof } from "@/features/auth/server/browser-proof";
import { randomUUID } from "node:crypto";
import { ApiError } from "@/lib/server/api-error";
import { newLoginReport, queueLoginFailure, safeLoginUsername } from "@/features/auth/server/login-audit";

/** 로그인 토큰은 암호화 HttpOnly 쿠키에만 저장하고 응답 본문으로 반환하지 않는다. */
export async function POST(request: Request): Promise<Response> {
  const attemptId = randomUUID(), started = Date.now();
  let stage = "BFF_ORIGIN_CHECK", username: string | undefined, clientIp: string | undefined;
  try {
    assertSameOrigin(request);
    stage = "BFF_BROWSER_PROOF";
    const proof = await readBrowserProof(request.clone());
    stage = "BFF_INPUT_VALIDATION";
    const rawInput = await readJsonBody(request);
    if (typeof rawInput === "object" && rawInput !== null && "username" in rawInput) username = safeLoginUsername(rawInput.username);
    const input = parseLoginInput(rawInput);
    username = input.username;
    stage = "BFF_CLIENT_IP";
    clientIp = getTrustedClientIp(request);
    // 설정 실패로 쿠키를 저장할 수 없는 상태에서 Spring 세션부터 생성하지 않는다.
    stage = "BFF_COOKIE_CONFIGURATION";
    getAuthCookieKey();
    // 교체 증명은 브라우저 JSON이 아닌 복호화한 HttpOnly 쿠키에서만 가져온다.
    stage = "BFF_COOKIE_READ";
    const previousSession = await readAuthCookie();
    stage = "BFF_BACKEND_REQUEST";
    const tokens = await loginWithBackend(input, proof, { clientIp, userAgent: getClientUserAgent(request), loginAttemptId: attemptId }, previousSession?.refreshToken);
    stage = "BFF_COOKIE_WRITE";
    await writeAuthCookie(tokens);
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    // 백엔드가 오류 응답을 준 요청은 백엔드 필터가 상세를 저장한다. 앞단·연결·쿠키 실패만 별도 기록한다.
    if (!(error instanceof ApiError && error.loginAuditRecorded)) {
      await queueLoginFailure(newLoginReport({ attemptId, started, stage, error, username, clientIp, userAgent: getClientUserAgent(request) }));
    }
    if (error instanceof ApiError && ["INVALID_CREDENTIALS", "LOGIN_CONFIRMATION_REQUIRED", "ACCESS_RESTRICTED"].includes(error.code)) return apiErrorResponse(error);
    return apiErrorResponse(new ApiError("LOGIN_SERVER_ERROR", { retryAfterSeconds: error instanceof ApiError ? error.retryAfterSeconds : undefined }));
  }
}
