import "server-only";

import type { LoginInput, CurrentSession, SessionActivity } from "../types";
import { parseAuthTokens, parseCurrentSession, parseSessionActivity, type AuthTokens } from "./contracts";
import { backendRequest } from "@/lib/server/backend-client";

/** 이후 BFF Route Handler에서 호출하며 토큰 원문을 브라우저 응답으로 반환하지 않는다. */
export async function loginWithBackend(input: LoginInput): Promise<AuthTokens> {
  return parseAuthTokens(await backendRequest("/api/auth/login", { method: "POST", body: input }));
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
