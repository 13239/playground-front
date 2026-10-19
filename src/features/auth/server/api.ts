import "server-only";

import type { LoginInput, CurrentSession, SessionActivity } from "../types";
import { parseAuthTokens, parseCurrentSession, parseSessionActivity, type AuthTokens } from "./contracts";
import { backendRequest } from "@/lib/server/backend-client";

/** 검증한 IP만 Spring에 전달하며 반환된 토큰 원문은 BFF 서버 내부에서만 사용한다. */
export async function loginWithBackend(input: LoginInput, clientIp?: string): Promise<AuthTokens> {
  return parseAuthTokens(await backendRequest("/api/auth/login", { method: "POST", body: input, clientIp }));
}

export async function refreshWithBackend(refreshToken: string): Promise<AuthTokens> {
  return parseAuthTokens(await backendRequest("/api/auth/refresh", {
    method: "POST", body: { refreshToken },
  }));
}

export async function getSessionFromBackend(accessToken: string): Promise<CurrentSession> {
  return parseCurrentSession(await backendRequest("/api/auth/session", { accessToken }));
}

export async function reportActivityToBackend(accessToken: string): Promise<SessionActivity> {
  return parseSessionActivity(await backendRequest("/api/auth/activity", { method: "POST", accessToken }));
}

export async function logoutFromBackend(accessToken: string): Promise<void> {
  await backendRequest("/api/auth/logout", { method: "POST", accessToken });
}
