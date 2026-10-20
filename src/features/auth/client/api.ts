import type { CurrentSession, LoginInput, SessionMutationInput } from "../types";
import { signedAuthRequest, clearProofNonces } from "./browser-proof";
import { AuthRequestError } from "./error";
import { isDevHttpAuth } from "./environment";
import { withDevAuthLock } from "./dev-auth-lock";
import { notifyAuthChanged } from "./session-events";
import { isSessionId } from "../session-id";
export { AuthRequestError } from "./error";

/** BFF가 공개한 오류만 화면에 표시하고 네트워크 장애에는 고정 안내를 제공한다. */
// 오류 계약은 키 저장소·증명 모듈도 공유하며 순환 참조를 피하기 위해 error.ts에서 관리한다.
// 프로필은 인증과 같은 브라우저 증명·탭 잠금·한 번의 토큰 갱신 절차를 공유한다.
type AuthPath = "/api/auth/login" | "/api/auth/logout" | "/api/auth/refresh" | "/api/auth/session" | "/api/auth/activity" | "/api/auth/profile";

async function authRequest(path: AuthPath, input?: LoginInput | SessionMutationInput): Promise<Response> {
  return signedAuthRequest(path, input);
}

async function authMutation(path: Exclude<AuthPath, "/api/auth/session" | "/api/auth/profile">, input?: LoginInput): Promise<void> {
  if ((await authRequest(path, input)).status !== 204) {
    throw new AuthRequestError("서비스 응답을 처리할 수 없습니다.", 502);
  }
}

/** 지원 브라우저에서는 탭 사이의 로그인·갱신·로그아웃 쿠키 변경도 순서대로 처리한다. */
async function withAuthLock<T>(operation: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request("playground:auth-mutation", operation);
  }
  // 사용자가 승인한 dev HTTP만 브라우저 키 없이 동작하며 탭 사이 변경 순서는 IndexedDB로 유지한다.
  if (isDevHttpAuth()) return withDevAuthLock(operation);
  // Web Locks 미지원 환경은 쿠키 갱신·활동 연장의 순서를 보장할 수 없으므로 안전하게 로그인을 거절한다.
  throw new AuthRequestError("최신 브라우저에서 다시 로그인해 주세요.", 401, undefined, "BROWSER_KEY_REQUIRED");
}

let refreshInFlight: Promise<void> | undefined;

/** 한 문서 안의 요청은 진행 중인 Promise를 공유하며 완료·실패 후 다시 시도할 수 있다. */
export function refreshSession(): Promise<void> {
  refreshInFlight ??= withAuthLock(async () => {
    // 다른 탭이 이미 쿠키를 갱신했다면 현재 Redis 세션만 확인하고 다시 회전하지 않는다.
    try { await authRequest("/api/auth/session"); return; }
    catch (error) { if (!requiresRefresh(error)) throw error; }
    await authMutation("/api/auth/refresh");
  })
    .finally(() => { refreshInFlight = undefined; });
  return refreshInFlight;
}

export async function login(input: LoginInput): Promise<void> {
  await withAuthLock(async () => {
    // 오래 열린 로그인 폼도 잠금을 얻은 뒤 현재 세션을 확인해 다른 탭의 정상 로그인을 덮어쓰지 않는다.
    try { await readSession(); return; }
    catch (error) { if (!(error instanceof AuthRequestError && error.status === 401 && !requiresRefresh(error))) throw error; }
    await authMutation("/api/auth/login", input);
    clearProofNonces();
    notifyAuthChanged();
  });
}

export async function logout(sessionId: string): Promise<void> {
  await withAuthLock(async () => {
    try {
      const response = await authenticatedRequest("/api/auth/logout", true, { sessionId });
      if (response.status !== 204) throw new AuthRequestError("서비스 응답을 처리할 수 없습니다.", 502);
    } catch (error) { if (!(error instanceof AuthRequestError && error.status === 401 && !requiresRefresh(error))) throw error; }
    clearProofNonces();
    notifyAuthChanged();
  });
}

function requiresRefresh(error: unknown): boolean {
  return error instanceof AuthRequestError && ["SESSION_REFRESH_REQUIRED", "INVALID_ACCESS_TOKEN"].includes(error.code ?? "");
}

// 호출자는 이미 브라우저 잠금을 보유한다. 경로가 바뀔 때마다 새로운 증명으로 한 번만 복구한다.
async function authenticatedRequest(path: AuthPath, retry = true, input?: SessionMutationInput): Promise<Response> {
  try { return await authRequest(path, input); }
  catch (error) {
    // 이전 화면의 요청은 새 세션으로 재실행하지 않고 화면을 먼저 재검증한다.
    if (error instanceof AuthRequestError && error.code === "LOGIN_SESSION_CHANGED") { clearProofNonces(); notifyAuthChanged(); }
    if (!retry || !requiresRefresh(error)) throw error;
    await authMutation("/api/auth/refresh");
    return authenticatedRequest(path, false, input);
  }
}

/** 실제 입력 이벤트만 호출하며 브라우저 잠금으로 로그인·갱신·로그아웃과 쿠키 변경 순서를 공유한다. */
export async function reportActivity(sessionId: string): Promise<void> {
  await withAuthLock(async () => {
    if ((await authenticatedRequest("/api/auth/activity", true, { sessionId })).status !== 204) throw new AuthRequestError("서비스 응답을 처리할 수 없습니다.", 502);
  });
}

/** 세션 조회가 갱신 필요를 명시했을 때만 복구하고 원래 조회는 한 번 재실행한다. */
export async function getSession(retry = true): Promise<CurrentSession> {
  return withAuthLock(() => readSession(retry));
}

/** 기능 API도 인증 잠금 안에서 호출하며 변경 요청은 화면에서 확인한 세션 ID를 반드시 포함한다. */
export async function requestAuthenticatedApi(
  path: "/api/auth/profile",
  input?: SessionMutationInput & Readonly<Record<string, unknown>>,
): Promise<Response> {
  return withAuthLock(() => authenticatedRequest(path, true, input));
}

// 잠금 안에서 응답 검증까지 끝내므로 다른 탭의 쿠키 변경과 사용자 정보 복원이 뒤섞이지 않는다.
async function readSession(retry = true): Promise<CurrentSession> {
  const response = await authenticatedRequest("/api/auth/session", retry);
  let value: unknown;
  try { value = await response.json(); } catch { /* 공개 세션 계약 외의 응답은 사용하지 않는다. */ }
  if (typeof value !== "object" || value === null || !("id" in value) || typeof value.id !== "number"
    || !Number.isSafeInteger(value.id) || value.id <= 0 || !("username" in value) || typeof value.username !== "string"
    || !value.username || [...value.username].length > 50 || !("sessionId" in value) || !isSessionId(value.sessionId)
    || !("keepLoggedIn" in value) || typeof value.keepLoggedIn !== "boolean"
    || !("sessionExpiresAt" in value) || typeof value.sessionExpiresAt !== "string" || !Number.isFinite(Date.parse(value.sessionExpiresAt))) {
    throw new AuthRequestError("서비스 응답을 처리할 수 없습니다.", 502);
  }
  return { id: value.id, username: value.username, sessionId: value.sessionId, keepLoggedIn: value.keepLoggedIn, sessionExpiresAt: value.sessionExpiresAt };
}
