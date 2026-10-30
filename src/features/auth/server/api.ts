import "server-only";

import { createHmac } from "node:crypto";
import type { LoginInput, CurrentSession, SessionActivity } from "../types";
import { parseAuthTokens, parseCurrentSession, parseSessionActivity, type AuthTokens } from "./contracts";
import { backendRequest } from "@/lib/server/backend-client";
import { getAuthCookieKey } from "@/lib/server/env";
import type { BrowserRequestProof } from "./browser-proof";

/** 같은 쿠키를 가진 여러 탭·BFF 인스턴스는 같은 갱신 식별자를 만든다. 브라우저에는 노출하지 않는다. */
function refreshRequestId(refreshToken: string): string {
  return createHmac("sha256", getAuthCookieKey())
    .update("playground:refresh:v1:").update(refreshToken).digest("hex");
}

/** 검증한 IP·브라우저 User-Agent와 기존 쿠키의 교체 증명만 Spring에 전달하며 토큰 원문은 서버 내부에서만 사용한다. */
export async function loginWithBackend(
  input: LoginInput,
  proof: BrowserRequestProof,
  client: Readonly<{ clientIp?: string; userAgent?: string; loginAttemptId?: string }>,
  previousRefreshToken?: string,
): Promise<AuthTokens> {
  return parseAuthTokens(await backendRequest("/api/auth/login", {
    // 로그인 직전에 다른 요청이 갱신했어도 기존의 짧은 중복 갱신 증명으로 교체할 수 있다.
    method: "POST", body: { ...input, ...(previousRefreshToken && {
      previousRefreshToken, previousRefreshRequestId: refreshRequestId(previousRefreshToken),
    }) }, ...client, proof,
  }));
}

export async function refreshWithBackend(refreshToken: string, proof: BrowserRequestProof): Promise<AuthTokens> {
  // 로그인 교체와 갱신 모두 동일한 서버 전용 식별 규칙을 사용한다.
  const requestId = refreshRequestId(refreshToken);
  return parseAuthTokens(await backendRequest("/api/auth/refresh", {
    method: "POST", body: { refreshToken, requestId }, proof,
  }));
}

export async function getSessionFromBackend(accessToken: string, proof: BrowserRequestProof): Promise<CurrentSession> {
  return parseCurrentSession(await backendRequest("/api/auth/session", { accessToken, proof }));
}

export async function reportActivityToBackend(accessToken: string, proof: BrowserRequestProof): Promise<SessionActivity> {
  return parseSessionActivity(await backendRequest("/api/auth/activity", { method: "POST", accessToken, proof }));
}

export async function logoutFromBackend(accessToken: string, proof: BrowserRequestProof): Promise<void> {
  await backendRequest("/api/auth/logout", { method: "POST", accessToken, proof });
}
