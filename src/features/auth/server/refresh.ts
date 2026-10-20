import "server-only";

import { refreshWithBackend } from "./api";
import { readAuthCookie, writeAuthCookie, type AuthCookieSession } from "./cookies";
import { ApiError } from "@/lib/server/api-error";
import type { BrowserRequestProof } from "./browser-proof";

/** 쿠키 변경이 가능한 Route Handler에서만 호출하며 회전 직후 새 토큰을 먼저 보존한다. */
export async function refreshSessionCookie(session: AuthCookieSession, proof: BrowserRequestProof): Promise<string> {
  const tokens = await refreshWithBackend(session.refreshToken, proof);
  // 뒤따르는 API가 장애로 실패해도 이미 회전한 Refresh Token을 잃지 않게 쿠키에 저장한다.
  await writeAuthCookie(tokens);
  return tokens.accessToken;
}

/** 인증 필터가 거절한 요청의 갱신·재실행은 브라우저가 새 경로의 증명으로 한 번 수행한다. 서버에서 증명을 다른 API에 재사용하지 않는다. */
export async function withAuthenticatedSession<T>(proof: BrowserRequestProof, operation: (accessToken: string, proof: BrowserRequestProof) => Promise<T>, expectedSessionId: string): Promise<T> {
  const session = await readAuthCookie();
  if (!session) throw new ApiError("AUTHENTICATION_REQUIRED");
  // 탭 알림을 놓쳤거나 브라우저가 복원한 이전 화면이어도 새 계정의 활동·로그아웃을 대신 실행하지 않는다.
  if (session.sessionId !== expectedSessionId) throw new ApiError("LOGIN_SESSION_CHANGED");
  if (session.accessTokenExpiresAt <= Date.now()) {
    throw new ApiError("SESSION_REFRESH_REQUIRED");
  }
  return operation(session.accessToken, proof);
}
