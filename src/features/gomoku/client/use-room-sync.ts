"use client";

import { useEffect, useState, type RefObject } from "react";
import { AuthRequestError } from "@/features/auth/client/api";
import type { WaitingRoom } from "../waiting-contracts";
import { readWaitingRoom, watchRoom } from "./api";

const RETRY_DELAYS = [1000, 2000, 4000, 8000, 10_000] as const;

/** 이벤트로 즉시 동기화하고 주기 조회로 접속·채팅 리스와 유실 알림을 복구한다. 대국 재접속은 5회로 제한한다. */
export function useRoomSync({ sessionId, roomId, playing, busy, stopped, accept, fail }: {
  sessionId: string; roomId: number; playing: boolean; busy: RefObject<boolean>;
  stopped: RefObject<boolean>;
  accept: (room: WaitingRoom) => void; fail: (error: unknown) => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [lost, setLost] = useState(false);
  const [epoch, setEpoch] = useState(0);
  useEffect(() => {
    let disposed = false, fetching = false, terminal = false, rerun = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let streamTimer: ReturnType<typeof setTimeout> | undefined;
    const stream = new AbortController();
    const schedule = (delay: number) => { clearTimeout(timer); timer = setTimeout(() => void refresh(), delay); };
    const refresh = async () => {
      if (disposed || terminal || stopped.current) return;
      if (fetching) { rerun = true; return; }
      if (busy.current) { schedule(300); return; }
      fetching = true;
      try {
        const result = await readWaitingRoom(sessionId, roomId);
        // 화면을 떠난 뒤 도착한 첫 참가 정보도 퇴장 정리에 전달하되 동기화는 다시 시작하지 않는다.
        if (disposed || stopped.current) { if (stopped.current) accept(result); return; }
        failures = 0; setAttempt(0); setLost(false); accept(result);
        schedule(playing ? 5000 : document.hidden ? 10_000 : 2000);
      } catch (error) {
        if (disposed || stopped.current) return;
        fail(error);
        const problem = error instanceof AuthRequestError ? error : null;
        if (problem?.status === 401 || ["LOGIN_SESSION_CHANGED", "ROOM_NOT_FOUND", "ROOM_CLOSED", "ROOM_NOT_JOINED"].includes(problem?.code ?? "")) {
          terminal = true; stream.abort(); return;
        }
        if (playing && (!problem || problem.status === 0 || problem.status >= 500)) {
          // 첫 단절 다음 재접속을 정확히 5번 시도한다. 실패 횟수를 새로고침으로 서버에 주장하지 않는다.
          if (failures >= RETRY_DELAYS.length) { terminal = true; setLost(true); stream.abort(); return; }
          setAttempt(failures + 1); schedule(RETRY_DELAYS[failures++]);
        } else schedule(5000);
      } finally {
        fetching = false;
        if (rerun && failures === 0 && !disposed && !terminal) { rerun = false; schedule(250); }
      }
    };
    // 스트림 정상 만료는 네트워크 재접속 실패에 포함하지 않는다. 데이터 조회가 연결 상태의 기준이다.
    const listen = async () => {
      // 데이터 연결 복구 중에는 이벤트 연결을 반복해 재접속 예산·인증 잠금을 소모하지 않는다.
      if (disposed || terminal || stopped.current) return;
      if (failures > 0) { streamTimer = setTimeout(() => void listen(), 5000); return; }
      try { await watchRoom(sessionId, roomId, stream.signal, () => { if (failures === 0) void refresh(); }); }
      catch { /* 알림 장애 중에도 주기 조회가 판을 복구한다. */ }
      if (!disposed && !terminal && !stopped.current) streamTimer = setTimeout(() => void listen(), 1000);
    };
    const visible = () => { if (!document.hidden && failures === 0) void refresh(); };
    const online = () => { if (failures === 0) void refresh(); };
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("online", online);
    void refresh();
    if (playing) void listen();
    return () => {
      disposed = true; stream.abort(); clearTimeout(timer); clearTimeout(streamTimer);
      document.removeEventListener("visibilitychange", visible); window.removeEventListener("online", online);
    };
  }, [sessionId, roomId, playing, busy, stopped, accept, fail, epoch]);
  return { attempt, lost, restart: () => { setAttempt(0); setLost(false); setEpoch(value => value + 1); } };
}
