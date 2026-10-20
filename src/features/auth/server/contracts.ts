import "server-only";

import type { CurrentSession, SessionActivity } from "../types";
import { ApiError } from "@/lib/server/api-error";
import { getAppEnvironment } from "@/lib/server/env";
import { decodeJwt } from "jose";
import { isSessionId } from "../session-id";

/** dev의 미등록 표시를 공개키로 위장하지 않으며 local/prod에서는 실제 공개키 지문만 받는다. */
export function isBrowserKeyBinding(value: unknown): value is string {
  return typeof value === "string" && (/^[A-Za-z0-9_-]{43}$/.test(value) || value === "dev-http" && getAppEnvironment() === "dev");
}

/** Spring에서 받은 토큰은 서버 내부에서만 사용하며 공개 응답 타입과 분리한다. */
export type AuthTokens = Readonly<{
  accessToken: string;
  refreshToken: string;
  browserKeyThumbprint: string;
  tokenType: "Bearer";
  expiresIn: number;
  accessTokenExpiresAt: string;
  keepLoggedIn: boolean;
  sessionExpiresAt: string;
}>;

const jwtPattern = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
// 서명된 세션 ID·세대를 담는 HS256 갱신 토큰. 진위·용도·재사용 판단은 Spring에서 수행한다.
const refreshPattern = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/;

/** 인증 암호화 쿠키 안의 토큰에서 요청 결합용 ID만 읽는다. JWT 서명 검증이나 사용자 인증을 대신하지 않는다. */
export function readTokenSessionId(accessToken: string): string | undefined {
  try {
    const value = decodeJwt(accessToken).sid;
    return isSessionId(value) ? value : undefined;
  } catch { return undefined; }
}

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
  return typeof value === "string" && value.length <= 1024 && refreshPattern.test(value);
}

/** 외부 JSON은 타입 단언만으로 신뢰하지 않고 필요한 필드와 형식을 검증한다. */
export function parseAuthTokens(value: unknown): AuthTokens {
  if (!isObject(value) || !isAccessToken(value.accessToken) || !isRefreshToken(value.refreshToken)
    || !isBrowserKeyBinding(value.browserKeyThumbprint)
    || value.tokenType !== "Bearer" || typeof value.expiresIn !== "number"
    || !Number.isSafeInteger(value.expiresIn) || value.expiresIn <= 0 || value.expiresIn > 31_536_000
    || !isSessionExpiry(value.accessTokenExpiresAt)
    || typeof value.keepLoggedIn !== "boolean" || !isSessionExpiry(value.sessionExpiresAt)) {
    throw new ApiError("INVALID_BACKEND_RESPONSE");
  }
  return {
    accessToken: value.accessToken,
    refreshToken: value.refreshToken,
    browserKeyThumbprint: value.browserKeyThumbprint,
    tokenType: value.tokenType,
    expiresIn: value.expiresIn,
    // 공유 응답 수신 시점부터 expiresIn을 다시 더하지 않도록 실제 JWT 만료를 사용한다.
    accessTokenExpiresAt: value.accessTokenExpiresAt,
    keepLoggedIn: value.keepLoggedIn,
    sessionExpiresAt: value.sessionExpiresAt,
  };
}

/** 현재 사용자 판별은 Spring의 JWT·Redis 검증 결과만 사용한다. */
export function parseCurrentSession(value: unknown): CurrentSession {
  if (!isObject(value) || typeof value.id !== "number" || !Number.isSafeInteger(value.id) || value.id <= 0
    // Spring의 StringValid는 Unicode 코드 포인트로 길이를 계산한다.
    || typeof value.username !== "string" || !value.username || [...value.username].length > 50
    || !isSessionId(value.sessionId) || typeof value.keepLoggedIn !== "boolean" || !isSessionExpiry(value.sessionExpiresAt)) {
    throw new ApiError("INVALID_BACKEND_RESPONSE");
  }
  return {
    id: value.id,
    username: value.username,
    sessionId: value.sessionId,
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
