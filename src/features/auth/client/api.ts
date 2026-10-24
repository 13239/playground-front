import type { CurrentSession, LoginInput, SessionMutationInput } from "../types";
import type { PasswordChangeInput } from "../password-validation";
import { signedAuthRequest, clearProofNonces } from "./browser-proof";
import { AuthRequestError } from "./error";
import { isDevHttpAuth } from "./environment";
import { withDevAuthLock } from "./dev-auth-lock";
import { withAuthRequestContext, type AuthRequestContext } from "./request-context";
import { createSharedRequest } from "./shared-request";
import { notifyAuthChanged } from "./session-events";
import { isSessionId } from "../session-id";
import { clearAccessNotice } from "./access-notice";
import { reportConnectionIssue } from "@/lib/client/connection-diagnostics";
export { AuthRequestError } from "./error";

/** BFF가 공개한 오류만 화면에 표시하고 네트워크 장애에는 고정 안내를 제공한다. */
// 오류 계약은 키 저장소·증명 모듈도 공유하며 순환 참조를 피하기 위해 error.ts에서 관리한다.
// 프로필은 인증과 같은 브라우저 증명·한 번의 토큰 갱신 절차를 공유하며 쿠키 갱신에만 탭 잠금을 사용한다.
// 방 검색·생성·닫기도 기능별로 인증을 복제하지 않고 이 증명·쿠키 잠금·갱신을 재사용한다.
// 채팅의 일회용 접속 증명도 같은 로그인·토큰 갱신 경계를 통과한다.
// 대기실도 공통 쿠키 변경 잠금·브라우저 증명·토큰 갱신을 재사용하고 별도 인증 쿠키를 만들지 않는다.
type FeaturePath = "/api/auth/profile" | "/api/auth/profile/nickname" | "/api/gomoku/rooms" | "/api/gomoku/rooms/search" | "/api/gomoku/rooms/close"
  | "/api/gomoku/rooms/join" | "/api/gomoku/rooms/state" | "/api/gomoku/rooms/ready" | "/api/gomoku/rooms/leave" | "/api/chat/tickets"
  // 대국 명령·이벤트 연결도 기존 쿠키 갱신 잠금과 경로별 요청 증명을 재사용한다.
  | "/api/gomoku/rooms/game" | "/api/gomoku/rooms/game/events" | "/api/gomoku/rooms/lifecycle"
  // 공통 게임 시작도 별도 토큰 없이 기존 잠금·갱신·브라우저 키로 확인한다.
  | `/api/games/${string}/modes/${string}/admission`;
type AuthPath = "/api/auth/login" | "/api/auth/logout" | "/api/auth/refresh" | "/api/auth/session" | "/api/auth/activity" | "/api/auth/password" | FeaturePath;

async function authRequest(path: AuthPath, context: AuthRequestContext, input?: LoginInput | SessionMutationInput): Promise<Response> {
  // 잠금 대기부터 갱신·원래 요청의 재실행까지 같은 취소 신호와 전체 기한을 사용한다.
  context.assertActive();
  const response = await signedAuthRequest(path, input, true, context.signal);
  context.assertActive();
  return response;
}

async function authMutation(path: "/api/auth/login" | "/api/auth/logout" | "/api/auth/refresh" | "/api/auth/activity", context: AuthRequestContext, input?: LoginInput): Promise<void> {
  if ((await authRequest(path, context, input)).status !== 204) {
    throw new AuthRequestError("서비스 응답을 처리할 수 없습니다.", 502);
  }
}

/** 지원 브라우저에서는 탭 사이의 로그인·갱신·로그아웃 쿠키 변경도 순서대로 처리한다. */
async function withAuthLock<T>(operation: (context: AuthRequestContext) => Promise<T>, signal?: AbortSignal): Promise<T> {
  signal?.throwIfAborted();
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request("playground:auth-mutation", { signal }, () => operation({ signal, assertActive: () => signal?.throwIfAborted() }));
  }
  // 사용자가 승인한 dev HTTP만 브라우저 키 없이 동작하며 탭 사이 변경 순서는 IndexedDB로 유지한다.
  if (isDevHttpAuth()) return withDevAuthLock(operation, signal);
  // Web Locks 미지원 환경은 쿠키 갱신·활동 연장의 순서를 보장할 수 없으므로 안전하게 로그인을 거절한다.
  throw new AuthRequestError("최신 브라우저에서 다시 로그인해 주세요.", 401, undefined, "BROWSER_KEY_REQUIRED");
}

// 일반 API는 병렬 실행하고 갱신이 필요할 때만 하나의 작업과 쿠키 변경 잠금을 공유한다.
const refreshRequest = createSharedRequest<void>(signal => withAuthRequestContext(async boundary => {
  await withAuthLock(async locked => {
    const context: AuthRequestContext = {
      signal: locked.signal,
      assertActive: () => { boundary.assertActive(); locked.assertActive(); },
    };
    // 다른 탭이 이미 쿠키를 갱신했다면 현재 Redis 세션만 확인하고 다시 회전하지 않는다.
    try { await authRequest("/api/auth/session", context); return; }
    catch (error) { if (!requiresRefresh(error)) throw error; }
    await authMutation("/api/auth/refresh", context);
  }, boundary.signal);
}, signal).catch(error => {
  // 공유 갱신 실패는 한 작업에서만 기록하며 정상적인 취소·로그인 만료는 경고를 남기지 않는다.
  if (!signal.aborted && error instanceof AuthRequestError && error.status !== 401 && error.code !== "LOGIN_SESSION_CHANGED") {
    reportConnectionIssue("token-refresh", error.code, error.status);
  }
  throw error;
}));

/** 한 문서 안의 요청은 진행 중인 Promise를 공유하며 완료·실패 후 다시 시도할 수 있다. */
export function refreshSession(signal?: AbortSignal): Promise<void> {
  return refreshRequest(signal);
}

export async function login(input: LoginInput): Promise<void> {
  let changed = false;
  await withAuthLock(async context => {
    // 오래 열린 로그인 폼도 잠금을 얻은 뒤 현재 세션을 확인해 다른 탭의 정상 로그인을 덮어쓰지 않는다.
    try { await readSession(context, true, true); return; }
    catch (error) { if (!(error instanceof AuthRequestError && error.status === 401 && !requiresRefresh(error))) throw error; }
    await authMutation("/api/auth/login", context, input);
    // 새 인증 성공은 이전에 종료된 세션의 운영 안내를 해제한다.
    clearAccessNotice();
    clearProofNonces();
    changed = true;
  });
  // 병렬 세션 조회가 로그인 폼을 이동시키기 전에 쿠키 변경 잠금의 해제를 끝낸다.
  if (changed) notifyAuthChanged();
}

export async function logout(sessionId: string): Promise<void> {
  await withAuthLock(async context => {
    try {
      const response = await authenticatedRequest("/api/auth/logout", context, true, { sessionId }, true);
      if (response.status !== 204) throw new AuthRequestError("서비스 응답을 처리할 수 없습니다.", 502);
    } catch (error) { if (!(error instanceof AuthRequestError && error.status === 401 && !requiresRefresh(error))) throw error; }
    clearProofNonces();
  });
  // 다른 화면의 재조회·자동 이동은 잠금 정리가 끝난 뒤 시작한다.
  notifyAuthChanged();
}

/** 비밀번호 변경도 로그인 변경과 같은 탭 잠금을 사용한다. 현재 로그인과 쿠키는 유지하고 업무 오류에서 재전송하지 않는다. */
export async function changePassword(sessionId: string, input: PasswordChangeInput): Promise<void> {
  await withAuthRequestContext(boundary => withAuthLock(async locked => {
    const context: AuthRequestContext = {
      signal: locked.signal,
      assertActive: () => { boundary.assertActive(); locked.assertActive(); },
    };
    const response = await authenticatedRequest("/api/auth/password", context, true, { sessionId, ...input }, true);
    if (response.status !== 204) throw new AuthRequestError("서비스 응답을 처리할 수 없습니다.", 502);
    clearProofNonces();
  }, boundary.signal));
}

function requiresRefresh(error: unknown): boolean {
  return error instanceof AuthRequestError && ["SESSION_REFRESH_REQUIRED", "INVALID_ACCESS_TOKEN"].includes(error.code ?? "");
}

/** 인증 필터가 실행 전에 거절한 경우만 한 번 갱신한다. 업무 오류·네트워크 장애로 변경 명령을 재전송하지 않는다. */
async function withTokenRefresh(send: () => Promise<Response>, context: AuthRequestContext,
  refresh: () => Promise<void>, retry = true): Promise<Response> {
  context.assertActive();
  try { return await send(); }
  catch (error) {
    // 취소·계정 변경으로 끝난 이전 요청의 오류는 새 계정의 갱신·알림을 시작하지 않는다.
    context.assertActive();
    // 이전 화면의 요청은 새 세션으로 재실행하지 않고 화면을 먼저 재검증한다.
    if (error instanceof AuthRequestError && error.code === "LOGIN_SESSION_CHANGED") { clearProofNonces(); notifyAuthChanged(); }
    if (!retry || !requiresRefresh(error)) throw error;
    context.assertActive();
    await refresh();
    context.assertActive();
    return withTokenRefresh(send, context, refresh, false);
  }
}

// 쿠키 변경 호출자는 이미 브라우저 잠금을 보유한다. 그 안에서는 직접 갱신하고 일반 요청은 공유 갱신을 기다린다.
// 경로가 바뀔 때마다 새로운 증명으로 한 번만 복구하며 잠금을 중첩 획득하지 않는다.
async function authenticatedRequest(path: AuthPath, context: AuthRequestContext, retry = true,
  input?: SessionMutationInput, locked = false): Promise<Response> {
  return withTokenRefresh(() => authRequest(path, context, input), context,
    () => locked ? authMutation("/api/auth/refresh", context) : refreshSession(context.signal), retry);
}

/** 실제 입력 이벤트만 호출하며 브라우저 잠금으로 로그인·갱신·로그아웃과 쿠키 변경 순서를 공유한다. */
export async function reportActivity(sessionId: string): Promise<void> {
  await withAuthLock(async context => {
    if ((await authenticatedRequest("/api/auth/activity", context, true, { sessionId }, true)).status !== 204) throw new AuthRequestError("서비스 응답을 처리할 수 없습니다.", 502);
  });
}

/** 세션 조회가 갱신 필요를 명시했을 때만 복구하고 원래 조회는 한 번 재실행한다. */
export async function getSession(retry = true, signal?: AbortSignal): Promise<CurrentSession> {
  return withAuthRequestContext(context => readSession(context, retry), signal);
}

/** 쿠키를 쓰지 않는 기능 API는 병렬 실행한다. 변경 요청은 화면의 세션 ID를 포함하고 갱신에만 공통 잠금을 사용한다. */
export async function requestAuthenticatedApi(
  path: FeaturePath,
  input?: SessionMutationInput & Readonly<Record<string, unknown>>,
  signal?: AbortSignal,
): Promise<Response> {
  return withAuthRequestContext(context => authenticatedRequest(path, context, true, input), signal);
}

/** 관리자 REST 요청도 쿠키 갱신에만 기존 탭 잠금을 공유한다. 실패한 변경 명령을 임의 재전송하지 않는다. */
export async function requestAdminApi(path: `/api/admin/${string}`, sessionId: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET", input?: object, signal?: AbortSignal): Promise<Response> {
  return withAuthRequestContext(async context => {
    // 관리자 요청도 갱신 전후에 같은 기한을 확인해 취소된 화면의 명령을 뒤늦게 실행하지 않는다.
    const send = async () => {
      context.assertActive();
      const response = await signedAuthRequest(path, input, true, context.signal, { method, sessionId });
      context.assertActive();
      return response;
    };
    return withTokenRefresh(send, context, () => refreshSession(context.signal));
  }, signal);
}

// 응답 본문 검증까지 같은 요청 수명·계정 변경 검사를 적용해 다른 탭의 쿠키 변경과 사용자 정보 복원이 뒤섞이지 않게 한다.
async function readSession(context: AuthRequestContext, retry = true, locked = false): Promise<CurrentSession> {
  const response = await authenticatedRequest("/api/auth/session", context, retry, undefined, locked);
  let value: unknown;
  try { value = await response.json(); } catch { /* 공개 세션 계약 외의 응답은 사용하지 않는다. */ }
  // 본문을 읽는 사이 취소되거나 기한이 지나도 이전 사용자 정보를 복원하지 않는다.
  context.assertActive();
  if (typeof value !== "object" || value === null || !("id" in value) || typeof value.id !== "number"
    || !Number.isSafeInteger(value.id) || value.id <= 0 || !("username" in value) || typeof value.username !== "string"
    || !value.username || [...value.username].length > 50 || !("sessionId" in value) || !isSessionId(value.sessionId)
    || !("keepLoggedIn" in value) || typeof value.keepLoggedIn !== "boolean"
    || !("sessionExpiresAt" in value) || typeof value.sessionExpiresAt !== "string" || !Number.isFinite(Date.parse(value.sessionExpiresAt))) {
    throw new AuthRequestError("서비스 응답을 처리할 수 없습니다.", 502);
  }
  return { id: value.id, username: value.username, sessionId: value.sessionId, keepLoggedIn: value.keepLoggedIn, sessionExpiresAt: value.sessionExpiresAt };
}
