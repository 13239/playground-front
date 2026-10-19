import "server-only";

import { Buffer } from "node:buffer";
import { ApiError } from "./api-error";

/** 서버 설정은 사용할 때 검증하며 NEXT_PUBLIC 환경 변수로 노출하지 않는다. */
function readOrigin(name: "BACKEND_ORIGIN" | "APP_ORIGIN"): string {
  try {
    const value = process.env[name];
    if (!value) throw new Error();
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password
      || url.pathname !== "/" || url.search || url.hash) throw new Error();
    return url.origin;
  } catch {
    throw new ApiError("SERVER_CONFIGURATION_ERROR");
  }
}

export function getBackendOrigin(): string {
  return readOrigin("BACKEND_ORIGIN");
}

export function getAppOrigin(): string {
  const origin = readOrigin("APP_ORIGIN");
  // 운영 인증 쿠키는 HTTPS와 동일한 공개 Origin을 전제로 한다.
  if (process.env.NODE_ENV === "production" && !origin.startsWith("https://")) {
    throw new ApiError("SERVER_CONFIGURATION_ERROR");
  }
  return origin;
}

export function getBackendTimeout(): number {
  const value = process.env.BACKEND_TIMEOUT_MS ?? "10000";
  const timeout = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(timeout) || timeout < 100 || timeout > 30_000) {
    throw new ApiError("SERVER_CONFIGURATION_ERROR");
  }
  return timeout;
}

/** BFF 전용 32바이트 키이며 Spring JWT 서명 키와 별도로 관리한다. */
export function getAuthCookieKey(): Uint8Array {
  const value = process.env.AUTH_COOKIE_SECRET;
  const key = value ? Buffer.from(value, "base64") : undefined;
  if (!key || key.length !== 32 || key.toString("base64") !== value) {
    throw new ApiError("SERVER_CONFIGURATION_ERROR");
  }
  return key;
}
