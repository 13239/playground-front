import { AuthRequestError } from "./error";
import { readAuthChangeVersion, readAuthRevision, subscribeAuthChanges } from "./session-events";

export type AuthRequestContext = Readonly<{ signal?: AbortSignal; assertActive: () => void }>;
const requestMillis = 45_000;
const active = new Map<AbortController, () => boolean>();
let stopObserving: (() => void) | undefined;

function sessionChanged(): AuthRequestError {
  return new AuthRequestError("로그인 상태가 변경되었습니다. 다시 확인해 주세요.", 409, undefined, "LOGIN_SESSION_CHANGED");
}

/** 병렬 요청은 인증 변경 알림 한 개를 공유하고 이전 계정의 응답·갱신·재실행을 함께 중단한다. */
function observe(controller: AbortController, isCurrent: () => boolean): () => void {
  active.set(controller, isCurrent);
  stopObserving ??= subscribeAuthChanges(() => {
    // 상위 세션 구독자가 같은 변경 알림에서 시작한 새 조회는 취소하지 않는다.
    for (const [request, current] of [...active]) if (!current()) request.abort(sessionChanged());
  });
  return () => {
    active.delete(controller);
    if (active.size === 0) { stopObserving?.(); stopObserving = undefined; }
  };
}

/** 저장소·본문 준비가 취소 신호를 즉시 처리하지 않아도 호출자는 종료한다. 늦은 작업의 결과·거절도 회수한다. */
function runRequest<T>(operation: (context: AuthRequestContext) => Promise<T>, context: AuthRequestContext, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve().then(() => { context.assertActive(); return operation(context); }).then(
      value => { signal.removeEventListener("abort", abort); resolve(value); },
      error => { signal.removeEventListener("abort", abort); reject(error); },
    );
  });
}

/** 쿠키를 변경하지 않는 요청의 수명이다. 갱신 대기도 포함한 전체 기한·취소·계정 변경 검사를 유지한다. */
export async function withAuthRequestContext<T>(operation: (context: AuthRequestContext) => Promise<T>, signal?: AbortSignal): Promise<T> {
  signal?.throwIfAborted();
  const controller = new AbortController();
  const requestSignal = signal ? AbortSignal.any([controller.signal, signal]) : controller.signal;
  const revision = readAuthRevision();
  const version = readAuthChangeVersion();
  const isCurrent = () => readAuthChangeVersion() === version && readAuthRevision() === revision;
  const startedAt = Date.now();
  const startedTick = performance.now();
  const timeout = () => controller.abort(new AuthRequestError("서비스 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.", 0, undefined, "AUTH_REQUEST_TIMEOUT"));
  const context: AuthRequestContext = {
    signal: requestSignal,
    assertActive: () => {
      // 절전 중 놓친 변경과 기한 초과도 후속 HTTP 요청·응답 사용 전에 다시 확인한다.
      if (!isCurrent()) controller.abort(sessionChanged());
      if (Date.now() - startedAt >= requestMillis || performance.now() - startedTick >= requestMillis) timeout();
      requestSignal.throwIfAborted();
    },
  };
  const timer = setTimeout(timeout, requestMillis);
  const unsubscribe = observe(controller, isCurrent);
  const suspend = () => controller.abort(new DOMException("문서가 종료되어 요청을 취소했습니다.", "AbortError"));
  const resume = () => { try { context.assertActive(); } catch { /* 중단은 각 요청의 공통 오류 경계에서 처리한다. */ } };
  window.addEventListener("pagehide", suspend);
  window.addEventListener("pageshow", resume);
  document.addEventListener("freeze", suspend);
  document.addEventListener("visibilitychange", resume);
  try {
    context.assertActive();
    const result = await runRequest(operation, context, requestSignal);
    context.assertActive();
    return result;
  } catch (error) {
    // 이전 요청의 늦은 401·성공 응답을 현재 계정의 상태로 해석하지 않는다.
    context.assertActive();
    throw error;
  } finally {
    clearTimeout(timer);
    unsubscribe();
    window.removeEventListener("pagehide", suspend);
    window.removeEventListener("pageshow", resume);
    document.removeEventListener("freeze", suspend);
    document.removeEventListener("visibilitychange", resume);
  }
}
