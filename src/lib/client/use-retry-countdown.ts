"use client";

import { useCallback, useSyncExternalStore } from "react";

const serverSnapshot = () => 0;

/** 서버가 정한 대기 종료 시각을 표시한다. 숨긴 탭에서는 시계만 멈추고 복귀 시 실제 시각으로 다시 계산한다. */
export function useRetryCountdown(retryAt?: number): number {
  const snapshot = useCallback(() => retryAt && Number.isFinite(retryAt)
    ? Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)) : 0, [retryAt]);
  const subscribe = useCallback((listener: () => void) => {
    if (!retryAt || !Number.isFinite(retryAt) || retryAt <= Date.now()) return () => {};
    let timer: ReturnType<typeof setInterval> | undefined;
    const stop = () => { clearInterval(timer); timer = undefined; };
    const tick = () => { listener(); if (Date.now() >= retryAt) stop(); };
    const resume = () => {
      stop();
      listener();
      if (document.visibilityState === "visible" && Date.now() < retryAt) timer = setInterval(tick, 1000);
    };
    resume();
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => { stop(); window.removeEventListener("focus", resume); document.removeEventListener("visibilitychange", resume); };
  }, [retryAt]);
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
