import "server-only";

import { refreshWithBackend } from "./api";
import { readAuthCookie, writeAuthCookie, type AuthCookieSession } from "./cookies";
import { ApiError } from "@/lib/server/api-error";

/** 쿠키 변경이 가능한 Route Handler에서만 호출하며 회전 직후 새 토큰을 먼저 보존한다. */
export async function refreshSessionCookie(session: AuthCookieSession): Promise<string> {
  const tokens = await refreshWithBackend(session.refreshToken);
  // 뒤따르는 API가 장애로 실패해도 이미 회전한 Refresh Token을 잃지 않게 쿠키에 저장한다.
  await writeAuthCookie(tokens);
  return tokens.accessToken;
}

/** 인증 필터가 거절한 요청만 갱신 후 한 번 재실행하며 로그인·일반 네트워크 오류는 재시도하지 않는다. */
export async function withAuthenticatedSession<T>(operation: (accessToken: string) => Promise<T>): Promise<T> {
  const session = await readAuthCookie();
  if (!session) throw new ApiError("AUTHENTICATION_REQUIRED");
  let token = session.accessToken;
  let refreshed = false;
  if (session.accessTokenExpiresAt <= Date.now()) {
    token = await refreshSessionCookie(session);
    refreshed = true;
  }
  try {
    return await operation(token);
  } catch (error) {
    if (!refreshed && error instanceof ApiError && error.code === "INVALID_ACCESS_TOKEN") {
      return operation(await refreshSessionCookie(session));
    }
    throw error;
  }
}
