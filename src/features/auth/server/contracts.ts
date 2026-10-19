import "server-only";

import type { CurrentSession, SessionActivity } from "../types";
import { ApiError } from "@/lib/server/api-error";

/** Spring에서 받은 토큰은 서버 내부에서만 사용하며 공개 응답 타입과 분리한다. */
export type AuthTokens = Readonly<{
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  keepLoggedIn: boolean;
  sessionExpiresAt: string;
}>;

const jwtPattern = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const refreshPattern = /^[A-Za-z0-9_-]{64}$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isSessionExpiry(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T.+Z$/.test(value)
    && Number.isFinite(Date.parse(value));
}

export function isAccessToken(value: unknown): value is string {
  return typeof value === "string" && value.length <= 4096 && jwtPattern.test(value);
}

export function isRefreshToken(value: unknown): value is string {
  return typeof value === "string" && refreshPattern.test(value);
}

/** 외부 JSON은 타입 단언만으로 신뢰하지 않고 필요한 필드와 형식을 검증한다. */
export function parseAuthTokens(value: unknown): AuthTokens {
  if (!isObject(value) || !isAccessToken(value.accessToken) || !isRefreshToken(value.refreshToken)
    || value.tokenType !== "Bearer" || typeof value.expiresIn !== "number"
    || !Number.isSafeInteger(value.expiresIn) || value.expiresIn <= 0 || value.expiresIn > 31_536_000
    || typeof value.keepLoggedIn !== "boolean" || !isSessionExpiry(value.sessionExpiresAt)) {
    throw new ApiError("INVALID_BACKEND_RESPONSE");
  }
  return {
    accessToken: value.accessToken,
    refreshToken: value.refreshToken,
    tokenType: value.tokenType,
    expiresIn: value.expiresIn,
    keepLoggedIn: value.keepLoggedIn,
    sessionExpiresAt: value.sessionExpiresAt,
  };
}

/** 현재 사용자 판별은 Spring의 JWT·Redis 검증 결과만 사용한다. */
export function parseCurrentSession(value: unknown): CurrentSession {
  if (!isObject(value) || typeof value.id !== "number" || !Number.isSafeInteger(value.id) || value.id <= 0
    || typeof value.username !== "string" || !value.username || value.username.length > 50
    || typeof value.keepLoggedIn !== "boolean" || !isSessionExpiry(value.sessionExpiresAt)) {
    throw new ApiError("INVALID_BACKEND_RESPONSE");
  }
  return {
    id: value.id,
    username: value.username,
    keepLoggedIn: value.keepLoggedIn,
    sessionExpiresAt: value.sessionExpiresAt,
  };
}

export function parseSessionActivity(value: unknown): SessionActivity {
  if (!isObject(value) || typeof value.keepLoggedIn !== "boolean" || !isSessionExpiry(value.expiresAt)) {
    throw new ApiError("INVALID_BACKEND_RESPONSE");
  }
  return { keepLoggedIn: value.keepLoggedIn, expiresAt: value.expiresAt };
}
