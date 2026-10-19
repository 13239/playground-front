import "server-only";

import { isIP } from "node:net";
import { ApiError, parseBackendError } from "./api-error";
import { getBackendOrigin, getBackendTimeout } from "./env";

type BackendRequest = Readonly<{
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: object;
  accessToken?: string;
  clientIp?: string;
}>;

/** BFF와 Server Component가 공유하는 서버 전용 Spring API 통신 경계다. */
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
  const headers = new Headers({ Accept: "application/json" });
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (options.accessToken) headers.set("Authorization", `Bearer ${options.accessToken}`);
  // 브라우저 헤더는 복사하지 않고 신뢰 프록시에서 검증한 IP 하나만 Spring에 전달한다.
  if (options.clientIp !== undefined) {
    if (options.clientIp.includes("%") || !isIP(options.clientIp)) throw new ApiError("INVALID_REQUEST_BODY");
    headers.set("X-Real-IP", options.clientIp);
  }
  const body = options.body === undefined ? undefined : JSON.stringify(options.body);
  const deadline = AbortSignal.timeout(getBackendTimeout());

  // 토큰 회전·상태 변경 중복을 방지하기 위해 자동 재시도하지 않는다.
  try {
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      body,
      signal: deadline,
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
    });
    if (response.status === 204) return undefined;

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      if (deadline.aborted) throw new ApiError("BACKEND_TIMEOUT");
      if (response.ok) throw new ApiError("INVALID_BACKEND_RESPONSE");
    }
    if (!response.ok) {
      throw parseBackendError(response.status, data, response.headers.get("Retry-After"));
    }
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(deadline.aborted ? "BACKEND_TIMEOUT" : "BACKEND_UNAVAILABLE");
  }
}
