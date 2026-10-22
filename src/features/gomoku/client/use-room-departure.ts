"use client";

import { useEffect, useRef, type RefObject } from "react";
import { newRoomRequestId } from "./api";
import { RoomDeparture } from "./room-departure";

/** 대기실·대국이 같은 문서 수명과 퇴장 경로를 공유한다. 탭 숨김·기기 회전은 종료로 취급하지 않는다. */
export function useRoomDeparture({ sessionId, roomId, membershipId, stopped: stoppedRef, onRestore }: {
  sessionId: string; roomId: number; membershipId?: string; stopped: RefObject<boolean>; onRestore: () => void;
}) {
  const current = useRef<{ membershipId: string; controller: RoomDeparture } | undefined>(undefined);
  useEffect(() => {
    if (membershipId && current.current?.membershipId !== membershipId) {
      current.current = { membershipId, controller: new RoomDeparture({ sessionId, roomId, membershipId, pageId: newRoomRequestId() }) };
    }
    const controller = current.current?.controller;
    const roomPath = `/games/gomoku/rooms/${roomId}`;
    let disposed = false;
    let reloading = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const prepare = async () => {
      if (!controller) return;
      try {
        const validUntil = await controller.prepare();
        if (!disposed && !controller.hasDeparted) timer = setTimeout(() => void prepare(), Math.max(1000, validUntil - performance.now() - 5000));
      } catch {
        // 준비 실패는 퇴장으로 오인하지 않는다. 페이지가 살아 있을 때만 다시 준비하고 서버 만료 정리도 유지한다.
        if (!disposed && !controller.hasDeparted) timer = setTimeout(() => void prepare(), 5000);
      }
    };
    const exit = (closing: boolean) => { stoppedRef.current = true; clearTimeout(timer); controller?.exit(closing); };
    const pop = () => {
      if (window.location.pathname !== roomPath) exit(false);
      else if (controller?.hasDeparted || stoppedRef.current) onRestore();
    };
    // 최신 브라우저는 새로고침을 명시적으로 구분해 느린 재로딩도 종료 알림을 보내지 않는다.
    // Navigation API가 없는 브라우저는 서버의 짧은 종료 유예와 새 문서 OPEN으로 복구한다.
    const navigation = (window as Window & { navigation?: EventTarget }).navigation;
    const navigate = (event: Event) => {
      const transition = event as Event & { navigationType?: string; signal?: AbortSignal; destination?: { url: string } };
      reloading = transition.navigationType === "reload";
      if (reloading) transition.signal?.addEventListener("abort", () => { reloading = false; }, { once: true });
      // 문서 자체가 바뀌는 뒤로가기는 이전 문서에 popstate가 오지 않아도 즉시 퇴장한다.
      if (transition.navigationType === "traverse" && transition.destination
        && new URL(transition.destination.url, window.location.origin).pathname !== roomPath) exit(false);
    };
    const hide = () => {
      if (reloading) { stoppedRef.current = true; clearTimeout(timer); }
      else exit(true);
    };
    const show = (event: PageTransitionEvent) => { if (event.persisted && stoppedRef.current) onRestore(); };
    window.addEventListener("popstate", pop);
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", show);
    navigation?.addEventListener("navigate", navigate);
    void prepare();
    return () => {
      disposed = true; clearTimeout(timer);
      window.removeEventListener("popstate", pop); window.removeEventListener("pagehide", hide); window.removeEventListener("pageshow", show);
      navigation?.removeEventListener("navigate", navigate);
      // Link·router 이동도 처리하되 개발 Strict Mode, 새로고침 중 같은 경로의 효과 정리는 퇴장시키지 않는다.
      if (window.location.pathname !== roomPath) exit(false);
    };
  }, [sessionId, roomId, membershipId, stoppedRef, onRestore]);
  return { complete: () => { stoppedRef.current = true; current.current?.controller.complete(); } };
}
