"use client";

import { useSyncExternalStore } from "react";
import type { CurrentSession } from "../types";
import { AuthRequestError, getSession } from "./api";
import { clearProofNonces } from "./browser-proof";
import { readAuthRevision, subscribeAuthChanges } from "./session-events";
import { authRetryDelay } from "./request-cooldown";
import { accessNoticeEvent, clearAccessNotice, readAccessNotice } from "./access-notice";

type SessionState = Readonly<
  | { status: "checking" }
  | { status: "anonymous"; message?: string }
  | { status: "authenticated"; session: CurrentSession; verificationError?: string }
  | { status: "error"; message: string }
>;
const checking: SessionState = { status: "checking" };
let snapshot: SessionState = checking;
const listeners = new Set<() => void>();
let revision = 0;
let running = false;
let queued = false;
let stopObserving: (() => void) | undefined;
const checkInterval = 30_000;
const staleGrace = 60_000;
let nextCheckAt = 0;
let retryNotBefore = 0;
let lastVerifiedAt = 0;
let failures = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

function update(value: SessionState): void {
  if (snapshot === value) return;
  snapshot = value;
  for (const listener of listeners) listener();
}

/** 이전 사용자 정보를 즉시 비우고 현재 쿠키·키·Redis로 재확인한다. 늦은 이전 응답은 화면에 반영하지 않는다. */
function invalidate(): void {
  revision++;
  clearProofNonces();
  update(checking);
  queued = true;
  nextCheckAt = 0;
}

/** 로그인·로그아웃·인증 거절은 일반 복귀와 구분해 이전 화면을 즉시 숨긴다. 서버의 제한 대기는 우회하지 않는다. */
export function revalidateAuthSession(): void {
  invalidate();
  checkSession(true);
}

/** 사용자의 재시도는 같은 계정 화면을 유지한다. 진행 중인 확인과 429 대기 시간은 공유한다. */
export function retryAuthSession(): void { checkSession(true); }

function scheduleCheck(): void {
  clearTimeout(timer);
  timer = undefined;
  if (listeners.size === 0 || document.visibilityState !== "visible" || running || snapshot.status === "anonymous") return;
  let at = Math.max(nextCheckAt, retryNotBefore);
  // 확인 장애가 길어지면 이전 계정 표시를 무한히 신뢰하지 않고 복구 화면으로 전환한다.
  if (snapshot.status === "authenticated" && snapshot.verificationError) at = Math.min(at, lastVerifiedAt + staleGrace);
  timer = setTimeout(() => checkSession(), Math.max(0, at - Date.now()));
}

function checkSession(force = false): void {
  if (listeners.size === 0 || document.visibilityState !== "visible") return;
  if (snapshot.status === "authenticated" && snapshot.verificationError && Date.now() >= lastVerifiedAt + staleGrace) {
    update({ status: "error", message: snapshot.verificationError });
  }
  // focus와 visibilitychange가 겹쳐도 현재 요청을 무효화하거나 후속 요청을 추가하지 않는다.
  if (running) return;
  if (Date.now() < Math.max(force ? 0 : nextCheckAt, retryNotBefore)) { scheduleCheck(); return; }
  clearTimeout(timer);
  timer = undefined;
  void drainChecks();
}

async function drainChecks(): Promise<void> {
  running = true;
  queued = false;
  const current = revision;
  try {
    const session = await getSession();
    if (current !== revision) return;
    // 다른 세션으로 바뀐 경우 nonce도 버린다. 같은 세션의 백그라운드 확인은 연결·화면을 유지한다.
    if (snapshot.status === "authenticated" && snapshot.session.sessionId !== session.sessionId) clearProofNonces();
    lastVerifiedAt = Date.now();
    nextCheckAt = lastVerifiedAt + checkInterval;
    retryNotBefore = 0;
    failures = 0;
    clearAccessNotice();
    update({ status: "authenticated", session });
  } catch (error) {
    if (current !== revision) return;
    if (error instanceof AuthRequestError && error.status === 401) {
      clearProofNonces();
      update({ status: "anonymous", message: readAccessNotice() });
      nextCheckAt = Date.now() + checkInterval;
      retryNotBefore = 0;
      failures = 0;
    } else {
      // 인증 서비스 장애를 로그인 만료로 처리하지 않고 쿠키를 보존한 채 재시도를 안내한다.
      const message = error instanceof AuthRequestError ? error.message : "로그인 상태를 확인하지 못했습니다. 다시 시도해 주세요.";
      const delay = authRetryDelay(error, Math.min(checkInterval, 5000 * 2 ** Math.min(failures++, 3)));
      retryNotBefore = Date.now() + delay;
      nextCheckAt = retryNotBefore;
      // 403은 키 검증 거절이므로 기존 사용자 정보를 숨긴다. 일시 장애만 짧은 유예 안에서 화면을 유지한다.
      if (snapshot.status === "authenticated" && !(error instanceof AuthRequestError && error.status === 403)
        && Date.now() < lastVerifiedAt + staleGrace) update({ ...snapshot, verificationError: message });
      else update({ status: "error", message });
    }
  } finally {
    running = false;
    if (queued && listeners.size > 0) checkSession(true);
    else scheduleCheck();
  }
}

function observe(): () => void {
  const onRestricted = () => {
    // 뒤늦은 진행 중 조회 응답으로 제한된 계정 표시가 다시 살아나지 않게 한다.
    revision++;
    queued = false;
    clearProofNonces();
    update({ status: "anonymous", message: readAccessNotice() });
  };
  window.addEventListener(accessNoticeEvent, onRestricted);
  let observedRevision = readAuthRevision();
  const unsubscribe = subscribeAuthChanges(() => {
    observedRevision = readAuthRevision();
    revalidateAuthSession();
  });
  const onResume = () => {
    if (document.visibilityState !== "visible") return;
    const latest = readAuthRevision();
    // 절전·동결 중 놓친 계정 변경은 30초 확인 간격과 관계없이 먼저 이전 화면을 숨긴다.
    if (latest && latest !== observedRevision) { observedRevision = latest; revalidateAuthSession(); }
    else checkSession();
  };
  // pagehide에서 이미 무효화했으므로 pageshow·focus가 겹쳐도 새 확인을 다시 무효화하지 않는다.
  const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) onResume(); };
  // 일반 탭 숨김은 화면·연결을 유지한다. bfcache에 보관되는 문서는 이전 사용자 정보를 비우고 복귀 시 다시 확인한다.
  const onSuspend = () => { clearTimeout(timer); timer = undefined; invalidate(); };
  const onVisibility = () => {
    if (document.visibilityState === "visible") onResume();
    else { clearTimeout(timer); timer = undefined; }
  };
  window.addEventListener("focus", onResume);
  window.addEventListener("pageshow", onPageShow);
  window.addEventListener("pagehide", onSuspend);
  window.addEventListener("online", onResume);
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    unsubscribe();
    window.removeEventListener(accessNoticeEvent, onRestricted);
    window.removeEventListener("focus", onResume);
    window.removeEventListener("pageshow", onPageShow);
    window.removeEventListener("pagehide", onSuspend);
    window.removeEventListener("online", onResume);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) { stopObserving = observe(); revalidateAuthSession(); }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stopObserving?.();
      stopObserving = undefined;
      revision++;
      queued = false;
      clearTimeout(timer);
      timer = undefined;
      snapshot = checking;
    }
  };
}

/** 로그인 페이지와 보호 화면이 같은 최신 상태를 구독한다. SSR에는 사용자 정보가 없는 고정 상태만 제공한다. */
export function useAuthSession(): SessionState {
  return useSyncExternalStore(subscribe, () => snapshot, () => checking);
}
