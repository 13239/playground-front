import "server-only";

import { isIP } from "node:net";
import { ApiError, parseBackendError } from "./api-error";
import { getAppEnvironment, getBackendOrigin, getBackendTimeout, getDevBffSecret } from "./env";
import { backendFetch } from "./backend-transport";
import type { BrowserRequestProof } from "@/features/auth/server/browser-proof";

type BackendRequest = Readonly<{
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: object;
  accessToken?: string;
  clientIp?: string;
  // 로그인·회원가입 활동 로그에 남길 브라우저 User-Agent
  userAgent?: string;
  // 회원가입처럼 본문 없는 성공 응답을 JSON 오류로 오인하지 않도록 호출자가 명시한다.
  responseType?: "json" | "empty" | "stream";
  // 이벤트 프록시가 브라우저 취소를 상위 연결까지 전달한다.
  signal?: AbortSignal;
  // BFF가 실제 요청에서 추출한 증명·본문 해시만 전달하며 브라우저 헤더 전체를 복사하지 않는다.
  proof?: BrowserRequestProof;
  loginAttemptId?: string;
}>;

/** BFF의 서버 전용 Spring API 통신 경계다. 보호 데이터는 브라우저의 요청 증명과 함께 호출한다. */
export async function backendRequest(
  path: `/api/${string}`,
  options: BackendRequest = {},
): Promise<unknown> {
  const origin = getBackendOrigin();
  const url = new URL(path, origin);
  // 외부 URL·경로 이탈을 차단하고 브라우저의 Cookie·Authorization 헤더는 전달하지 않는다.
  if (url.origin !== origin || !url.pathname.startsWith("/api/")) {
    throw new ApiError("INVALID_REQUEST_BODY");
  }
  const headers = new Headers({ Accept: options.responseType === "stream" ? "text/event-stream" : "application/json" });
  // Docker 내부 HTTP의 dev에서만 BFF 키를 전달한다. prod나 브라우저 응답에는 이 값을 전달하지 않는다.
  if (getAppEnvironment() === "dev" && url.protocol === "http:") headers.set("X-BFF-Dev-Secret", getDevBffSecret());
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (options.accessToken) headers.set("Authorization", `Bearer ${options.accessToken}`);
  if (options.proof) {
    headers.set("X-Browser-Proof", options.proof.value);
    headers.set("X-Browser-Body-SHA256", options.proof.bodyHash);
  }
  // 브라우저 헤더는 복사하지 않고 신뢰 프록시에서 검증한 IP 하나만 Spring에 전달한다.
  if (options.clientIp !== undefined) {
    if (options.clientIp.includes("%") || !isIP(options.clientIp)) throw new ApiError("INVALID_REQUEST_BODY");
    headers.set("X-Real-IP", options.clientIp);
  }
  // BFF 서버 자신의 User-Agent와 구분되도록 정제한 브라우저 값만 전용 헤더로 전달한다.
  if (options.userAgent) headers.set("X-Client-User-Agent", options.userAgent);
  if (path === "/api/auth/login" && options.loginAttemptId && /^[a-f0-9-]{36}$/.test(options.loginAttemptId)) {
    headers.set("X-Login-Attempt-Id", options.loginAttemptId);
  }
  const body = options.body === undefined ? undefined : JSON.stringify(options.body);
  // SSE는 헤더 수신에만 제한 시간을 적용한다. 열린 스트림은 원본 요청 취소/연결 종료까지 유지한다.
  const timeoutController = new AbortController();
  const timeoutTimer = setTimeout(() => timeoutController.abort(), options.responseType === "stream" ? 25_000 : getBackendTimeout());
  const deadline = options.signal ? AbortSignal.any([timeoutController.signal, options.signal]) : timeoutController.signal;

  // 토큰 회전·상태 변경 중복을 방지하기 위해 자동 재시도하지 않는다.
  try {
    const response = await backendFetch(url, {
      method: options.method ?? "GET",
      headers,
      body,
      signal: deadline,
      stream: options.responseType === "stream",
    });
    if (response.ok && options.responseType === "stream") {
      if (!response.body || !response.headers.get("Content-Type")?.startsWith("text/event-stream")) throw new ApiError("INVALID_BACKEND_RESPONSE");
      return response;
    }
    if (response.status === 204 || response.ok && options.responseType === "empty") return undefined;

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      if (deadline.aborted) throw new ApiError("BACKEND_TIMEOUT");
      if (response.ok) throw new ApiError("INVALID_BACKEND_RESPONSE");
    }
    if (!response.ok) {
      let failure = parseBackendError(response.status, data, response.headers.get("Retry-After"));
      // 새 백엔드가 실제 자격 증명 불일치로 확인한 경우만 공개 불일치 안내를 허용한다.
      if (path === "/api/auth/login" && failure.code === "INVALID_CREDENTIALS"
          && response.headers.get("X-Login-Credentials-Mismatch") !== "1") failure = new ApiError("LOGIN_SERVER_ERROR");
      failure.loginAuditRecorded = path === "/api/auth/login" && !!options.loginAttemptId
        && response.headers.get("X-Login-Attempt-Id") === options.loginAttemptId;
      throw failure;
    }
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(deadline.aborted ? "BACKEND_TIMEOUT" : "BACKEND_UNAVAILABLE");
  } finally {
    clearTimeout(timeoutTimer);
  }
}
