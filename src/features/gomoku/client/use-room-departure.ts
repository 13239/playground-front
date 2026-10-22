"use client";

import { useEffect, useRef, type RefObject } from "react";
import { newRoomRequestId } from "./api";
import { RoomDeparture } from "./room-departure";

/** 대기실·대국이 같은 문서 수명과 퇴장 경로를 공유한다. 탭 숨김·기기 회전은 종료로 취급하지 않는다. */
export function useRoomDeparture({ sessionId, roomId, membershipId, stopped: stoppedRef, onRestore, onOpened, onDenied, onError }: {
  sessionId?: string; roomId: number; membershipId?: string; stopped: RefObject<boolean>; onRestore: () => void;
  onOpened: (pageId: string) => void; onDenied: (error: unknown) => void;
  onError: (error: unknown) => void;
}) {
  const current = useRef<{ sessionId: string; roomId: number; membershipId: string; controller: RoomDeparture } | undefined>(undefined);
  const retryRef = useRef<(() => void) | undefined>(undefined);
  useEffect(() => {
    if (current.current && (current.current.sessionId !== sessionId || current.current.roomId !== roomId
      || membershipId !== undefined && current.current.membershipId !== membershipId)) {
      // 참가 이력이 바뀐 경우 오래된 문서가 새 참가자의 Web Lock을 점유하지 않게 정리한다.
      // 로그아웃·계정 전환도 즉시 해제하며 일시적인 인증 재확인은 상위 화면이 기존 세션을 유지한다.
      current.current.controller.complete();
      current.current = undefined;
    }
    if (sessionId && membershipId && !current.current) {
      stoppedRef.current = false;
      // sessionStorage는 탭 단위이며 리로드 시 유지된다. 문서 식별자는 항상 새로 생성한다.
      const key = `playground:gomoku:tab:${sessionId}`;
      let tabId = newRoomRequestId();
      try {
        const existing = sessionStorage.getItem(key);
        if (existing && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(existing)) tabId = existing;
        else sessionStorage.setItem(key, tabId);
      } catch { /* 세션 저장소가 차단되면 서버는 새 탭으로 판단해 다른 활성 문서를 보호한다. */ }
      current.current = { sessionId, roomId, membershipId, controller: new RoomDeparture({ sessionId, roomId, membershipId, pageId: newRoomRequestId(), tabId }) };
    }
    const controller = current.current?.controller;
    const roomPath = `/games/gomoku/rooms/${roomId}`;
    let disposed = false;
    let reloading = false;
    let preparing = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const prepare = async () => {
      if (!controller || preparing || disposed || controller.hasDeparted) return;
      preparing = true;
      let opened = false;
      clearTimeout(timer);
      try {
        if (!await controller.open()) return;
        opened = true;
        // 준비 버튼은 OPEN 응답 직후 활성화한다. 종료용 키·nonce 준비를 추가로 기다리지 않는다.
        if (!disposed && !controller.hasDeparted) onOpened(controller.pageId);
        const validUntil = await controller.prepare();
        if (!disposed && !controller.hasDeparted) timer = setTimeout(() => void prepare(), Math.max(1000, validUntil - performance.now() - 5000));
      } catch (error) {
        if (error instanceof Error && "code" in error
          && ["ROOM_PAGE_IN_USE", "ROOM_NOT_JOINED", "ROOM_CLOSED", "ROOM_NOT_FOUND"].includes(String(error.code))) {
          controller.complete();
          if (!disposed) { stoppedRef.current = true; onDenied(error); }
          return;
        }
        // 준비 실패는 퇴장으로 오인하지 않는다. 페이지가 살아 있을 때만 다시 준비하고 서버 만료 정리도 유지한다.
        // 네트워크 장애는 입장 권한 거절과 구분하고 페이지가 살아 있을 때만 다시 시도한다.
        if (!disposed && !controller.hasDeparted) {
          // 입장 실패는 주기 조회 성공에 지워지지 않는 별도 안내로 전달하고, 종료 준비만 실패하면 입장은 유지한다.
          if (!opened) onError(error);
          timer = setTimeout(() => void prepare(), 5000);
        }
      } finally { preparing = false; }
    };
    const retry = () => void prepare();
    retryRef.current = retry;
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
      if (retryRef.current === retry) retryRef.current = undefined;
      window.removeEventListener("popstate", pop); window.removeEventListener("pagehide", hide); window.removeEventListener("pageshow", show);
      navigation?.removeEventListener("navigate", navigate);
      // Link·router 이동도 처리하되 개발 Strict Mode, 새로고침 중 같은 경로의 효과 정리는 퇴장시키지 않는다.
      if (window.location.pathname !== roomPath) exit(false);
    };
  }, [sessionId, roomId, membershipId, stoppedRef, onRestore, onOpened, onDenied, onError]);
  // 늦은 이전 화면의 나가기 성공이 현재 계정·참가의 잠금을 풀지 않도록 호출 당시 신원도 대조한다.
  return { retry: () => retryRef.current?.(), complete: (sessionId: string, membershipId: string) => {
    if (current.current?.sessionId !== sessionId || current.current.roomId !== roomId || current.current.membershipId !== membershipId) return;
    stoppedRef.current = true;
    current.current.controller.complete();
  } };
}
