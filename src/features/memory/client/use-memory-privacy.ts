"use client";

import { useEffect, useRef, useState } from "react";

/** 브라우저가 전달하는 포커스·캡처 단축키 신호로 공개 카드를 가린다. OS 캡처 감지를 보장하지 않는다. */
export function useMemoryPrivacy(active: boolean) {
  const boardRef = useRef<HTMLDivElement>(null);
  const resumeRef = useRef<() => void>(() => {});
  // 이벤트를 연결하고 현재 창 상태를 확인하기 전에는 카드가 먼저 노출되지 않도록 한다.
  const [shielded, setShielded] = useState(true);

  useEffect(() => {
    let disposed = false;
    let capture = false;
    let printing = false;
    let focusTimer: ReturnType<typeof setTimeout> | undefined;
    function apply(hidden: boolean) {
      if (disposed) return;
      // React 갱신을 기다리는 사이에도 같은 이벤트에서 시각적 가림막을 먼저 적용한다.
      boardRef.current?.setAttribute("data-shielded", String(active && hidden));
      setShielded(hidden);
    }
    function sync() { apply(capture || printing || document.hidden || !document.hasFocus()); }
    function blur() { clearTimeout(focusTimer); apply(true); }
    function focus() { clearTimeout(focusTimer); focusTimer = setTimeout(sync, 150); }
    function captureKey(event: KeyboardEvent) {
      if (!active) return;
      const key = event.key.toLowerCase();
      const screenshot = key === "printscreen"
        || (event.metaKey && event.shiftKey && ["s", "3", "4", "5"].includes(key));
      if (!screenshot) return;
      // 전달되는 단축키만 보조 처리한다. OS가 먼저 저장한 화면이나 외부 녹화는 차단할 수 없다.
      capture = true;
      apply(true);
      if (event.cancelable) event.preventDefault();
    }
    function beforePrint() { printing = true; apply(true); }
    function afterPrint() { printing = false; sync(); }
    resumeRef.current = () => {
      if (document.hidden || !document.hasFocus() || printing) return;
      capture = false;
      sync();
    };
    window.addEventListener("blur", blur);
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("keydown", captureKey, true);
    window.addEventListener("keyup", captureKey, true);
    window.addEventListener("beforeprint", beforePrint);
    window.addEventListener("afterprint", afterPrint);
    queueMicrotask(sync);
    return () => {
      disposed = true;
      clearTimeout(focusTimer);
      resumeRef.current = () => {};
      window.removeEventListener("blur", blur);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("keydown", captureKey, true);
      window.removeEventListener("keyup", captureKey, true);
      window.removeEventListener("beforeprint", beforePrint);
      window.removeEventListener("afterprint", afterPrint);
    };
  }, [active]);
  return { boardRef, shielded, resume: () => resumeRef.current() };
}
