"use client";

import { useEffect, useRef, type RefObject } from "react";
import { newRoomRequestId } from "./api";
import { RoomDeparture } from "./room-departure";

/** 대기실·대국이 같은 문서 수명과 퇴장 경로를 공유한다. 탭 숨김·기기 회전은 종료로 취급하지 않는다. */
export function useRoomDeparture({ sessionId, roomId, membershipId, stopped: stoppedRef, onRestore, onOpened, onDenied }: {
  sessionId: string; roomId: number; membershipId?: string; stopped: RefObject<boolean>; onRestore: () => void;
  onOpened: (pageId: string) => void; onDenied: (error: unknown) => void;
}) {
  const current = useRef<{ membershipId: string; controller: RoomDeparture } | undefined>(undefined);
  useEffect(() => {
    if (membershipId && current.current?.membershipId !== membershipId) {
      // 참가 이력이 바뀐 경우 오래된 문서가 새 참가자의 Web Lock을 점유하지 않게 정리한다.
      current.current?.controller.complete();
      // sessionStorage는 탭 단위이며 리로드 시 유지된다. 문서 식별자는 항상 새로 생성한다.
      const key = `playground:gomoku:tab:${sessionId}`;
      let tabId = newRoomRequestId();
      try {
        const existing = sessionStorage.getItem(key);
        if (existing && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(existing)) tabId = existing;
        else sessionStorage.setItem(key, tabId);
      } catch { /* 세션 저장소가 차단되면 서버는 새 탭으로 판단해 다른 활성 문서를 보호한다. */ }
      current.current = { membershipId, controller: new RoomDeparture({ sessionId, roomId, membershipId, pageId: newRoomRequestId(), tabId }) };
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
        if (!disposed && !controller.hasDeparted) onOpened(controller.pageId);
        if (!disposed && !controller.hasDeparted) timer = setTimeout(() => void prepare(), Math.max(1000, validUntil - performance.now() - 5000));
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ROOM_PAGE_IN_USE") {
          controller.complete();
          if (!disposed) { stoppedRef.current = true; onDenied(error); }
          return;
        }
        // 준비 실패는 퇴장으로 오인하지 않는다. 페이지가 살아 있을 때만 다시 준비하고 서버 만료 정리도 유지한다.
        // 네트워크 장애는 입장 권한 거절과 구분하고 페이지가 살아 있을 때만 다시 시도한다.
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
      if (reloading) { stoppedRef.current = true; clearTimeout(timer); controller?.releaseForReload(); }
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
  }, [sessionId, roomId, membershipId, stoppedRef, onRestore, onOpened, onDenied]);
  return { complete: () => { stoppedRef.current = true; current.current?.controller.complete(); } };
}
