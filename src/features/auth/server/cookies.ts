import "server-only";

import { EncryptJWT, errors, jwtDecrypt } from "jose";
import { cookies } from "next/headers";
import type { SessionActivity } from "../types";
import { isAccessToken, isRefreshToken, isSessionExpiry, isBrowserKeyBinding, readTokenSessionId, parseAuthTokens, type AuthTokens } from "./contracts";
import { ApiError } from "@/lib/server/api-error";
import { getAppOrigin, getAuthCookieKey } from "@/lib/server/env";

/** 쿠키는 토큰 운반용이며 사용자 인증 여부는 Spring의 최신 Redis 검증으로 판단한다. */
export type AuthCookieSession = Readonly<{
  sessionId: string;
  accessToken: string;
  refreshToken: string;
  browserKeyThumbprint: string;
  accessTokenExpiresAt: number;
  keepLoggedIn: boolean;
  sessionExpiresAt: string;
}>;

const issuer = "playground-bff";
const maxCookieBytes = 3800;

function cookieOptions() {
  // dev는 원격 HTTP를 지원한다. HTTPS로 접속하는 local/dev도 Secure 쿠키를 사용한다.
  const secure = getAppOrigin().startsWith("https://");
  return {
    name: secure ? "__Host-playground.session" : "playground.session",
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
  };
}

/** 쿠키 변경은 Route Handler·Server Action에서만 호출한다. */
async function saveSession(session: AuthCookieSession): Promise<void> {
  const expires = new Date(session.sessionExpiresAt);
  const expiration = Math.floor(expires.getTime() / 1000);
  if (!Number.isFinite(expiration) || expiration <= Math.floor(Date.now() / 1000)) {
    throw new ApiError("INVALID_BACKEND_RESPONSE");
  }

  // 라이브러리의 무작위 IV와 인증 암호화를 사용하여 토큰 원문과 변조를 모두 보호한다.
  const value = await new EncryptJWT({ version: 2, ...session })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM", typ: "JWT" })
    .setIssuer(issuer)
    .setAudience(getAppOrigin())
    .setIssuedAt()
    .setExpirationTime(expiration)
    .encrypt(getAuthCookieKey());
  if (new TextEncoder().encode(value).length > maxCookieBytes) {
    throw new ApiError("INVALID_BACKEND_RESPONSE");
  }

  const jar = await cookies();
  // OFF에는 Expires·Max-Age를 넣지 않으며, ON만 Redis 만료 시각까지 영속 저장한다.
  jar.set({ ...cookieOptions(), value, ...(session.keepLoggedIn && { expires }) });
}

/** 로그인·갱신 모두 백엔드의 세션 만료를 그대로 적용하며 임의로 14일·3시간을 더하지 않는다. */
export async function writeAuthCookie(input: AuthTokens): Promise<void> {
  const tokens = parseAuthTokens(input);
  const sessionId = readTokenSessionId(tokens.accessToken);
  if (!sessionId) throw new ApiError("INVALID_BACKEND_RESPONSE");
  await saveSession({
    sessionId,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    browserKeyThumbprint: tokens.browserKeyThumbprint,
    // 같은 갱신 결과를 늦게 수신해도 실제 Access Token의 만료 시각을 그대로 유지한다.
    accessTokenExpiresAt: Date.parse(tokens.accessTokenExpiresAt),
    keepLoggedIn: tokens.keepLoggedIn,
    sessionExpiresAt: tokens.sessionExpiresAt,
  });
}

/** Server Component에서도 읽을 수 있지만 복호화 성공을 로그인 판별로 사용하지 않는다. */
export async function readAuthCookie(): Promise<AuthCookieSession | null> {
  const value = (await cookies()).get(cookieOptions().name)?.value;
  if (!value) return null;

  // 설정 오류는 만료·변조와 구분하여 조용히 로그아웃시키지 않는다.
  const key = getAuthCookieKey();
  const audience = getAppOrigin();
  try {
    const { payload } = await jwtDecrypt(value, key, {
      issuer, audience,
      keyManagementAlgorithms: ["dir"],
      contentEncryptionAlgorithms: ["A256GCM"],
      requiredClaims: ["exp", "iat"],
    });
    if (payload.version !== 2 || !isAccessToken(payload.accessToken) || !isRefreshToken(payload.refreshToken)
      || !isBrowserKeyBinding(payload.browserKeyThumbprint)
      || typeof payload.accessTokenExpiresAt !== "number" || !Number.isSafeInteger(payload.accessTokenExpiresAt)
      || payload.accessTokenExpiresAt <= 0 || typeof payload.keepLoggedIn !== "boolean"
      || !isSessionExpiry(payload.sessionExpiresAt)
      || payload.exp !== Math.floor(Date.parse(payload.sessionExpiresAt) / 1000)) return null;

    // 기존 v2 쿠키도 암호화 검증 뒤 같은 토큰의 sid를 사용해 강제 로그아웃 없이 새 요청 계약에 연결한다.
    const sessionId = readTokenSessionId(payload.accessToken);
    if (!sessionId) return null;
    return {
      sessionId,
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      browserKeyThumbprint: payload.browserKeyThumbprint,
      accessTokenExpiresAt: payload.accessTokenExpiresAt,
      keepLoggedIn: payload.keepLoggedIn,
      sessionExpiresAt: payload.sessionExpiresAt,
    };
  } catch (error) {
    if (error instanceof errors.JOSEError) return null;
    throw error;
  }
}

/** 실제 활동을 백엔드가 승인한 경우에만 브라우저 쿠키의 만료도 맞춘다. */
export async function updateAuthCookieExpiry(activity: SessionActivity): Promise<void> {
  const session = await readAuthCookie();
  if (!session) throw new ApiError("AUTHENTICATION_REQUIRED");
  if (typeof activity.keepLoggedIn !== "boolean" || !isSessionExpiry(activity.expiresAt)) {
    throw new ApiError("INVALID_BACKEND_RESPONSE");
  }
  await saveSession({ ...session, keepLoggedIn: activity.keepLoggedIn, sessionExpiresAt: activity.expiresAt });
}

/** 인증 쿠키와 동일한 범위·보안 속성으로 만료시킨다. */
export async function clearAuthCookie(): Promise<void> {
  (await cookies()).set({ ...cookieOptions(), value: "", expires: new Date(0), maxAge: 0 });
}
