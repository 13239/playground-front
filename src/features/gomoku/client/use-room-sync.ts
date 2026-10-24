"use client";

import { useEffect, useState, type RefObject } from "react";
import { AuthRequestError } from "@/features/auth/client/api";
import { authRetryDelay } from "@/features/auth/client/request-cooldown";
import type { WaitingRoom } from "../waiting-contracts";
import { readWaitingRoom, watchRoom } from "./api";
import { getGameDisplayWindow, getGamePopup, subscribeToGamePopup } from "./game-popup";

const RETRY_DELAYS = [1000, 2000, 4000, 8000, 10_000] as const;

/** 이벤트로 즉시 동기화하고 주기 조회로 접속·채팅 리스와 유실 알림을 복구한다. 대국 재접속은 5회로 제한한다. */
export function useRoomSync({ sessionId, roomId, pageId, playing, busy, stopped, revision, accept, fail }: {
  sessionId: string; roomId: number; pageId?: string; playing: boolean; busy: RefObject<boolean>;
  revision: RefObject<number>;
  stopped: RefObject<boolean>;
  accept: (room: WaitingRoom) => void; fail: (error: unknown) => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [lost, setLost] = useState(false);
  const [epoch, setEpoch] = useState(0);
  useEffect(() => {
    let disposed = false, fetching = false, terminal = false, rerun = false;
    let failures = 0;
    let retryAt = 0;
    let requestedAt = Number.NEGATIVE_INFINITY;
    let timer: number | undefined;
    let timerWindow: Window = window;
    let timerAt = 0;
    let streamTimer: number | undefined;
    let streamWindow: Window = window;
    let streamAt = 0;
    const stream = new AbortController();
    // 팝업의 열기·닫기는 동기화 훅을 다시 만들지 않는다. 기존 연결과 재접속 예산을 유지한다.
    const schedule = (delay: number) => {
      timerWindow.clearTimeout(timer);
      timerWindow = getGameDisplayWindow();
      timerAt = Date.now() + delay;
      timer = timerWindow.setTimeout(() => { timer = undefined; void refresh(); }, delay);
    };
    const scheduleStream = (delay: number) => {
      streamWindow.clearTimeout(streamTimer);
      streamWindow = getGameDisplayWindow();
      streamAt = Date.now() + delay;
      streamTimer = streamWindow.setTimeout(() => { streamTimer = undefined; void listen(); }, delay);
    };
    const refresh = async () => {
      if (disposed || terminal || stopped.current) return;
      // 데이터 조회·SSE·복귀 이벤트도 같은 429 대기 시간을 지켜 로컬 재시도 루프를 만들지 않는다.
      if (Date.now() < retryAt) { schedule(retryAt - Date.now()); return; }
      if (fetching) { rerun = true; return; }
      if (busy.current) { schedule(300); return; }
      fetching = true;
      requestedAt = Date.now();
      try {
        const result = await readWaitingRoom(sessionId, roomId, pageId);
        // 화면을 떠난 뒤 도착한 첫 참가 정보도 퇴장 정리에 전달하되 동기화는 다시 시작하지 않는다.
        if (disposed || stopped.current) { if (stopped.current) accept(result); return; }
        failures = 0; setAttempt(0); setLost(false); accept(result);
        // SSE가 빠른 변경 알림을 처리하고 조회는 접속·채팅 권한만 유지한다.
        // 숨겨진 페이지는 15초 간격으로 제한하되 포그라운드 복귀는 즉시 확인한다.
        // 원본 탭을 숨겨도 팝업이 보이면 활성 대국의 접속 확인 간격을 유지한다.
        const leaseDelay = document.hidden && getGameDisplayWindow().document.hidden ? 15_000 : playing ? 10_000 : 5000;
        // 무르기 알림이 유실돼도 10초 마감 시점에 한 번 판을 동기화해 만료된 팝업을 방치하지 않는다.
        // 별도 폴링은 만들지 않고 기존 접속 확인 예약을 마감 시각으로 앞당긴다.
        const undoDelay = result.game?.undoDeadline
          ? Math.max(50, Date.parse(result.game.undoDeadline) - Date.parse(result.serverTime) + 100)
          : Number.POSITIVE_INFINITY;
        schedule(Math.min(leaseDelay, undoDelay));
      } catch (error) {
        if (disposed || stopped.current) return;
        fail(error);
        const problem = error instanceof AuthRequestError ? error : null;
        if (problem?.status === 401 || ["LOGIN_SESSION_CHANGED", "ROOM_NOT_FOUND", "ROOM_CLOSED", "ROOM_NOT_JOINED", "ROOM_KICKED", "ROOM_KICKED_REJOIN_ALLOWED", "ROOM_PAGE_IN_USE"].includes(problem?.code ?? "")) {
          terminal = true; stream.abort(); return;
        }
        if (problem?.status === 429) {
          retryAt = Date.now() + authRetryDelay(problem);
          schedule(retryAt - Date.now());
        } else if (playing && (!problem || problem.status === 0 || problem.status >= 500)) {
          // 첫 단절 다음 재접속을 정확히 5번 시도한다. 실패 횟수를 새로고침으로 서버에 주장하지 않는다.
          if (failures >= RETRY_DELAYS.length) { terminal = true; setLost(true); stream.abort(); return; }
          setAttempt(failures + 1); schedule(RETRY_DELAYS[failures++]);
        } else schedule(5000);
      } finally {
        fetching = false;
        if (rerun && failures === 0 && !disposed && !terminal) { rerun = false; schedule(Math.max(250, retryAt - Date.now())); }
      }
    };
    // 스트림 정상 만료는 네트워크 재접속 실패에 포함하지 않는다. 데이터 조회가 연결 상태의 기준이다.
    const listen = async () => {
      // 데이터 연결 복구 중에는 이벤트 연결을 반복해 재접속 예산·인증 잠금을 소모하지 않는다.
      if (disposed || terminal || stopped.current) return;
      if (Date.now() < retryAt) { scheduleStream(retryAt - Date.now()); return; }
      if (failures > 0) { scheduleStream(5000); return; }
      try {
        await watchRoom(sessionId, roomId, pageId!, stream.signal,
          () => { if (failures === 0) void refresh(); },
          // 20초 정상 만료·재연결 사이 이벤트를 놓쳤더라도 버전 차이가 있을 때만 복구한다.
          serverRevision => { if (failures === 0 && serverRevision > revision.current) void refresh(); });
      }
      catch (error) {
        // 소유권을 잃은 탭은 SSE 구독을 1초마다 재시도하지 않고 즉시 접속을 종료한다.
        const problem = error instanceof AuthRequestError ? error : null;
        if (problem?.status === 429) retryAt = Math.max(retryAt, Date.now() + authRetryDelay(problem));
        if (problem?.status === 401 || ["ROOM_PAGE_IN_USE", "ROOM_NOT_JOINED", "ROOM_KICKED", "ROOM_KICKED_REJOIN_ALLOWED", "ROOM_CLOSED", "LOGIN_SESSION_CHANGED"].includes(problem?.code ?? "")) {
          terminal = true;
          if (!disposed) fail(error);
          return;
        }
        // 나머지 알림 장애 중에도 주기 조회가 판을 복구한다.
      }
      if (!disposed && !terminal && !stopped.current) scheduleStream(Math.max(1000, retryAt - Date.now()));
    };
    // 짧은 연속 탭 전환은 정상 조회를 중복시키지 않는다. 실제 대국 변경 이벤트의 후속 조회는 유지한다.
    const resume = () => { if (failures === 0 && !fetching && Date.now() - requestedAt >= 1000) void refresh(); };
    const visible = () => { if (!document.hidden) resume(); };
    const online = resume;
    // 팝업 창의 타이머는 창을 닫으면 사라진다. 닫히기 전에 원본 타이머로 예약을 인계한다.
    let displayedPopup: Window | null = null;
    const changeDisplay = (refreshOnOpen: boolean) => {
      const nextPopup = getGamePopup();
      if (displayedPopup === nextPopup) return;
      displayedPopup?.removeEventListener("focus", resume);
      displayedPopup?.document.removeEventListener("visibilitychange", resume);
      // 팝업 등록 해제 후 호출되므로 예약이 닫히는 창에 다시 만들어지지 않는다.
      if (displayedPopup && !disposed && !terminal && !stopped.current) {
        if (timer !== undefined && timerWindow === displayedPopup) {
          timerWindow.clearTimeout(timer); timerWindow = window;
          // 재접속·429 대기 시간도 창 전환으로 앞당기지 않는다.
          timer = window.setTimeout(() => { timer = undefined; void refresh(); }, Math.max(0, timerAt - Date.now(), retryAt - Date.now()));
        }
        if (streamTimer !== undefined && streamWindow === displayedPopup) {
          streamWindow.clearTimeout(streamTimer); streamWindow = window;
          streamTimer = window.setTimeout(() => { streamTimer = undefined; void listen(); }, Math.max(0, streamAt - Date.now(), retryAt - Date.now()));
        }
      }
      displayedPopup = nextPopup;
      displayedPopup?.addEventListener("focus", resume);
      displayedPopup?.document.addEventListener("visibilitychange", resume);
      if (displayedPopup && refreshOnOpen) resume();
    };
    const unsubscribePopup = subscribeToGamePopup(() => changeDisplay(true));
    changeDisplay(false);
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("online", online);
    void refresh();
    // 최초 신원 확인 조회는 구독을 만들지 않고 OPEN 이후 현재 탭만 SSE에 연결한다.
    // 대기 중에도 구독해 방장 강퇴와 참가 변경을 상대에게 지연 없이 알린다.
    if (pageId) void listen();
    return () => {
      disposed = true; stream.abort(); timerWindow.clearTimeout(timer); streamWindow.clearTimeout(streamTimer);
      unsubscribePopup();
      displayedPopup?.removeEventListener("focus", resume);
      displayedPopup?.document.removeEventListener("visibilitychange", resume);
      document.removeEventListener("visibilitychange", visible); window.removeEventListener("online", online);
    };
  }, [sessionId, roomId, pageId, playing, busy, stopped, revision, accept, fail, epoch]);
  return { attempt, lost, restart: () => { setAttempt(0); setLost(false); setEpoch(value => value + 1); } };
}
