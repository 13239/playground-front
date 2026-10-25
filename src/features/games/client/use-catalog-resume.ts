"use client";

import { useEffect } from "react";

/** 관리자 화면에서 복귀하거나 뒤로가기로 문서를 복원하면 공개 정보를 다시 읽는다. 같은 프레임의 복귀 이벤트는 합친다. */
export function useCatalogResume(refresh: () => void) {
  useEffect(() => {
    let frame: number | undefined;
    const resume = () => {
      if (document.visibilityState !== "visible" || frame !== undefined) return;
      frame = window.requestAnimationFrame(() => { frame = undefined; refresh(); });
    };
    const restored = (event: PageTransitionEvent) => { if (event.persisted) resume(); };
    window.addEventListener("focus", resume); document.addEventListener("visibilitychange", resume); window.addEventListener("pageshow", restored);
    return () => {
      window.removeEventListener("focus", resume); document.removeEventListener("visibilitychange", resume); window.removeEventListener("pageshow", restored);
      if (frame !== undefined) window.cancelAnimationFrame(frame);
    };
  }, [refresh]);
}
