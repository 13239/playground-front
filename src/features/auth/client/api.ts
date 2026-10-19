import type { CurrentSession, LoginInput } from "../types";

/** BFF가 공개한 오류만 화면에 표시하고 네트워크 장애에는 고정 안내를 제공한다. */
export class AuthRequestError extends Error {
  readonly status: number;
  readonly retryAfterSeconds?: number;
  readonly code?: string;

  constructor(message: string, status: number, retryAfterSeconds?: number, code?: string) {
    super(message);
    this.name = "AuthRequestError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
    this.code = code;
  }
}

type AuthPath = "/api/auth/login" | "/api/auth/logout" | "/api/auth/refresh" | "/api/auth/session";

async function authRequest(path: AuthPath, input?: LoginInput): Promise<Response> {
  let response: Response;
  try {
    // 동일 Origin의 BFF만 호출하며 인증 토큰을 읽거나 브라우저 저장소에 보관하지 않는다.
    response = await fetch(path, {
      method: path === "/api/auth/session" ? "GET" : "POST",
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      headers: input ? { "Content-Type": "application/json" } : undefined,
      body: input ? JSON.stringify(input) : undefined,
    });
  } catch {
    throw new AuthRequestError("서비스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.", 0);
  }
  if (response.ok) return response;

  let problem: unknown;
  try { problem = await response.json(); } catch { /* 프록시의 HTML 오류 응답은 화면에 노출하지 않는다. */ }
  if (!response.ok && typeof problem === "object" && problem !== null
    && "detail" in problem && typeof problem.detail === "string" && problem.detail.length <= 300) {
    const seconds = "retryAfterSeconds" in problem ? problem.retryAfterSeconds : undefined;
    const code = "code" in problem && typeof problem.code === "string" && /^[A-Z_]{1,64}$/.test(problem.code)
      ? problem.code : undefined;
    throw new AuthRequestError(problem.detail, response.status,
      typeof seconds === "number" && Number.isSafeInteger(seconds) && seconds > 0 && seconds <= 86_400 ? seconds : undefined, code);
  }
  throw new AuthRequestError("요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.", response.status);
}

async function authMutation(path: Exclude<AuthPath, "/api/auth/session">, input?: LoginInput): Promise<void> {
  if ((await authRequest(path, input)).status !== 204) {
    throw new AuthRequestError("서비스 응답을 처리할 수 없습니다.", 502);
  }
}

/** 지원 브라우저에서는 탭 사이의 로그인·갱신·로그아웃 쿠키 변경도 순서대로 처리한다. */
async function withAuthLock<T>(operation: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request("playground:auth-mutation", operation);
  }
  // Web Locks 미지원 환경도 서버의 Redis 원자 회전·동일 결과 공유로 보호한다.
  return operation();
}

let refreshInFlight: Promise<void> | undefined;

/** 한 문서 안의 요청은 진행 중인 Promise를 공유하며 완료·실패 후 다시 시도할 수 있다. */
export function refreshSession(): Promise<void> {
  refreshInFlight ??= withAuthLock(() => authMutation("/api/auth/refresh"))
    .finally(() => { refreshInFlight = undefined; });
  return refreshInFlight;
}

export async function login(input: LoginInput): Promise<void> {
  await withAuthLock(() => authMutation("/api/auth/login", input));
}

export async function logout(): Promise<void> {
  await withAuthLock(() => authMutation("/api/auth/logout"));
}

/** 세션 조회가 갱신 필요를 명시했을 때만 복구하고 원래 조회는 한 번 재실행한다. */
export async function getSession(retry = true): Promise<CurrentSession> {
  let response: Response;
  try {
    response = await authRequest("/api/auth/session");
  } catch (error) {
    if (retry && error instanceof AuthRequestError && error.code === "SESSION_REFRESH_REQUIRED") {
      await refreshSession();
      return getSession(false);
    }
    throw error;
  }
  let value: unknown;
  try { value = await response.json(); } catch { /* 공개 세션 계약 외의 응답은 사용하지 않는다. */ }
  if (typeof value !== "object" || value === null || !("id" in value) || typeof value.id !== "number"
    || !Number.isSafeInteger(value.id) || value.id <= 0 || !("username" in value) || typeof value.username !== "string"
    || !value.username || [...value.username].length > 50 || !("keepLoggedIn" in value) || typeof value.keepLoggedIn !== "boolean"
    || !("sessionExpiresAt" in value) || typeof value.sessionExpiresAt !== "string" || !Number.isFinite(Date.parse(value.sessionExpiresAt))) {
    throw new AuthRequestError("서비스 응답을 처리할 수 없습니다.", 502);
  }
  return { id: value.id, username: value.username, keepLoggedIn: value.keepLoggedIn, sessionExpiresAt: value.sessionExpiresAt };
}
