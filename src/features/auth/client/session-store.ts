"use client";

import { useSyncExternalStore } from "react";
import type { CurrentSession } from "../types";
import { AuthRequestError, getSession } from "./api";
import { clearProofNonces } from "./browser-proof";
import { subscribeAuthChanges } from "./session-events";

type SessionState = Readonly<
  | { status: "checking" }
  | { status: "anonymous" }
  | { status: "authenticated"; session: CurrentSession }
  | { status: "error"; message: string }
>;
const checking: SessionState = { status: "checking" };
let snapshot: SessionState = checking;
const listeners = new Set<() => void>();
let revision = 0;
let running = false;
let queued = false;
let stopObserving: (() => void) | undefined;

function update(value: SessionState): void {
  if (snapshot === value) return;
  snapshot = value;
  for (const listener of listeners) listener();
}

/** 이전 사용자 정보를 즉시 비우고 현재 쿠키·키·Redis로 재확인한다. 늦은 이전 응답은 화면에 반영하지 않는다. */
export function revalidateAuthSession(): void {
  revision++;
  clearProofNonces();
  update(checking);
  queued = true;
  if (!running) void drainChecks();
}

async function drainChecks(): Promise<void> {
  running = true;
  try {
    while (queued && listeners.size > 0) {
      queued = false;
      const current = revision;
      try {
        const session = await getSession();
        if (current === revision) update({ status: "authenticated", session });
      } catch (error) {
        if (current !== revision) continue;
        if (error instanceof AuthRequestError && error.status === 401) update({ status: "anonymous" });
        // 인증 서비스 장애를 로그인 만료로 처리하지 않고 쿠키를 보존한 채 재시도를 안내한다.
        else update({ status: "error", message: error instanceof AuthRequestError ? error.message : "로그인 상태를 확인하지 못했습니다. 다시 시도해 주세요." });
      }
    }
  } finally { running = false; }
}

function observe(): () => void {
  const unsubscribe = subscribeAuthChanges(revalidateAuthSession);
  const onResume = () => { if (document.visibilityState === "visible") revalidateAuthSession(); };
  const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) onResume(); };
  // 숨겨지거나 bfcache에 보관된 화면에는 이전 사용자 정보를 남기지 않고 복귀 시 다시 확인한다.
  const onSuspend = () => { revision++; queued = false; clearProofNonces(); update(checking); };
  const onVisibility = () => { if (document.visibilityState === "visible") onResume(); else onSuspend(); };
  window.addEventListener("focus", onResume);
  window.addEventListener("pageshow", onPageShow);
  window.addEventListener("pagehide", onSuspend);
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    unsubscribe();
    window.removeEventListener("focus", onResume);
    window.removeEventListener("pageshow", onPageShow);
    window.removeEventListener("pagehide", onSuspend);
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
      snapshot = checking;
    }
  };
}

/** 로그인 페이지와 보호 화면이 같은 최신 상태를 구독한다. SSR에는 사용자 정보가 없는 고정 상태만 제공한다. */
export function useAuthSession(): SessionState {
  return useSyncExternalStore(subscribe, () => snapshot, () => checking);
}
