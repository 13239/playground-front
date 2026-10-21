import "server-only";

import { Buffer } from "node:buffer";
import { ApiError } from "./api-error";

/** next build/start의 NODE_ENV와 배포 환경을 구분한다. dev 배포도 Next의 production 빌드를 사용한다. */
export function getAppEnvironment(): "local" | "dev" | "prod" {
  const value = process.env.APP_ENV ?? (process.env.NODE_ENV === "production" ? "prod" : "local");
  if (value !== "local" && value !== "dev" && value !== "prod") throw new ApiError("SERVER_CONFIGURATION_ERROR");
  return value;
}

/** 운영은 신뢰 프록시의 단일 IP 전달이 필수다. 서버 주소로 전체 사용자를 합치는 누락 설정을 거절한다. */
export function getTrustedClientIpHeaderName(): string | undefined {
  const environment = getAppEnvironment();
  const name = process.env.TRUSTED_CLIENT_IP_HEADER;
  if (!name && environment !== "prod") return undefined;
  if (!name || !/^[a-z][a-z0-9-]{0,63}$/.test(name)) throw new ApiError("SERVER_CONFIGURATION_ERROR");
  return name;
}

/** dev의 Docker 내부 HTTP에만 전용 공유 키를 사용한다. 브라우저에는 노출하지 않는다. */
export function getDevBffSecret(): string {
  const value = process.env.BFF_DEV_SHARED_SECRET;
  const bytes = value ? Buffer.from(value, "base64") : undefined;
  if (typeof value !== "string" || !bytes || bytes.length !== 32 || bytes.toString("base64") !== value) throw new ApiError("SERVER_CONFIGURATION_ERROR");
  return value;
}

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
  // prod 인증 쿠키는 HTTPS를 요구한다. 원격 HTTP는 명시적 APP_ENV=dev에서만 사용하는 개발 예외다.
  if (getAppEnvironment() === "prod" && !origin.startsWith("https://")) {
    throw new ApiError("SERVER_CONFIGURATION_ERROR");
  }
  return origin;
}

/** 최적화한 local 빌드도 별도 chat 포트에 연결하되 CSP에는 검증한 정확한 WebSocket Origin만 허용한다. */
export function getChatWebSocketOrigin(): string {
  const origin = getAppOrigin();
  const environment = getAppEnvironment();
  try {
    const value = process.env.CHAT_WEBSOCKET_URL ?? (environment === "local"
      ? "ws://localhost:8081/ws/chat" : `${origin.replace(/^http/, "ws")}/ws/chat`);
    const url = new URL(value);
    if (!["ws:", "wss:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/ws/chat" || url.search || url.hash
      || origin.startsWith("https:") && url.protocol !== "wss:"
      || environment === "local" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      || environment !== "local" && url.host !== new URL(origin).host) throw new Error();
    return url.origin;
  } catch { throw new ApiError("SERVER_CONFIGURATION_ERROR"); }
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
