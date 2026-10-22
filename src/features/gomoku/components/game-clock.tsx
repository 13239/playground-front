"use client";

import { useEffect, useState } from "react";
import { LobbyIcon } from "@/app/_components/lobby/lobby-icon";
import styles from "./game-room.module.css";

/** 서버 시각과 문서의 단조 시계를 결합한다. 200ms 전체 화면 갱신 대신 표시 숫자가 변할 때만 갱신한다. */
// 서버와 다른 PC 시계에서도 남은 시간은 수신한 서버 시각과 단조 시계의 경과 시간으로만 표시한다.
function remainingSeconds(serverTime: string, deadline: string | null | undefined, maximum: number, elapsed: number): number {
  return deadline ? Math.max(0, Math.min(maximum, Math.ceil((Date.parse(deadline) - Date.parse(serverTime) - elapsed) / 1000))) : 0;
}

export function useRemainingSeconds(serverTime: string, deadline: string | null | undefined, maximum: number): number {
  const [remaining, setRemaining] = useState(() => remainingSeconds(serverTime, deadline, maximum, 0));

  useEffect(() => {
    const started = performance.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      const elapsed = performance.now() - started;
      const seconds = remainingSeconds(serverTime, deadline, maximum, elapsed);
      setRemaining(previous => previous === seconds ? previous : seconds);
      if (seconds > 0) {
        // 다음 초 경계에서만 렌더링한다. 비활성 탭 타이머가 늦게 실행돼도 시간은 누적 오차가 없다.
        const left = Date.parse(deadline!) - Date.parse(serverTime) - elapsed;
        timer = setTimeout(tick, Math.max(50, Math.min(1000, left - (seconds - 1) * 1000 + 10)));
      }
    };
    timer = setTimeout(tick, 0);
    return () => clearTimeout(timer);
  }, [serverTime, deadline, maximum]);
  return remaining;
}

/** 참가자 카드의 초 단위 시계만 업데이트하고 오목판은 렌더링하지 않는다. */
export function PlayerTurnTimer({ nickname, playing, active, serverTime, deadline }: {
  nickname: string; playing: boolean; active: boolean; serverTime: string; deadline: string | null;
}) {
  const remaining = useRemainingSeconds(serverTime, active ? deadline : null, 30);
  const value = !playing ? 0 : active ? remaining : 30;
  return <div className={styles.playerTimer} data-active={active}>
    <div><LobbyIcon name="clock" /><strong>00:{String(value).padStart(2, "0")}</strong></div>
    <progress max={30} value={value} aria-label={`${nickname}님 남은 턴 시간`} />
  </div>;
}

export function CountdownSeconds({ serverTime, deadline, maximum }: {
  serverTime: string; deadline: string | null; maximum: number;
}) {
  return useRemainingSeconds(serverTime, deadline, maximum);
}

export function ActiveTurnCountdown({ serverTime, deadline }: { serverTime: string; deadline: string | null }) {
  const remaining = useRemainingSeconds(serverTime, deadline, 30);
  return <span className={styles.timer} data-urgent={remaining <= 10} aria-live="off">{remaining}<small>초</small></span>;
}
