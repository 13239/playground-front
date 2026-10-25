"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { LobbyIcon } from "@/app/_components/lobby/lobby-icon";
import styles from "./game-room.module.css";
import { getGameDisplayWindow } from "@/features/games/client/game-popup";

// 팝업 전환으로 하위 시계를 다시 만들어도 마지막 서버 응답 이후 경과 시간을 잃지 않는다.
const GameClockContext = createContext<{ serverTime: string; receivedAt: number } | null>(null);

export function GameClockProvider({ serverTime, receivedAt, children }: { serverTime: string; receivedAt: number; children: ReactNode }) {
  const clock = useMemo(() => ({ serverTime, receivedAt }), [serverTime, receivedAt]);
  return <GameClockContext value={clock}>{children}</GameClockContext>;
}

export function useGameClockOrigin(serverTime: string): number | undefined {
  const clock = useContext(GameClockContext);
  return clock?.serverTime === serverTime ? clock.receivedAt : undefined;
}

/** 서버 시각과 문서의 단조 시계를 결합한다. 200ms 전체 화면 갱신 대신 표시 숫자가 변할 때만 갱신한다. */
// 서버와 다른 PC 시계에서도 남은 시간은 수신한 서버 시각과 단조 시계의 경과 시간으로만 표시한다.
function remainingSeconds(serverTime: string, deadline: string | null | undefined, maximum: number, elapsed: number): number {
  return deadline ? Math.max(0, Math.min(maximum, Math.ceil((Date.parse(deadline) - Date.parse(serverTime) - elapsed) / 1000))) : 0;
}

export function useRemainingSeconds(serverTime: string, deadline: string | null | undefined, maximum: number): number {
  const origin = useGameClockOrigin(serverTime);
  const [remaining, setRemaining] = useState(() => remainingSeconds(serverTime, deadline, maximum, origin === undefined ? 0 : performance.now() - origin));

  useEffect(() => {
    // 팝업은 표시 중인 창의 시계를 사용해 원본 탭의 백그라운드 타이머 제한을 피한다.
    const clockWindow = getGameDisplayWindow();
    // 두 Window의 timeOrigin은 다르므로 경과 시간은 원본의 단조 시계로 일관되게 계산한다.
    const started = origin ?? performance.now();
    let timer: number | undefined;
    const tick = () => {
      const elapsed = performance.now() - started;
      const seconds = remainingSeconds(serverTime, deadline, maximum, elapsed);
      setRemaining(previous => previous === seconds ? previous : seconds);
      if (seconds > 0) {
        // 다음 초 경계에서만 렌더링한다. 비활성 탭 타이머가 늦게 실행돼도 시간은 누적 오차가 없다.
        const left = Date.parse(deadline!) - Date.parse(serverTime) - elapsed;
        timer = clockWindow.setTimeout(tick, Math.max(50, Math.min(1000, left - (seconds - 1) * 1000 + 10)));
      }
    };
    const resume = () => { clockWindow.clearTimeout(timer); tick(); };
    timer = clockWindow.setTimeout(tick, 0);
    clockWindow.addEventListener("focus", resume);
    clockWindow.document.addEventListener("visibilitychange", resume);
    return () => {
      clockWindow.clearTimeout(timer);
      clockWindow.removeEventListener("focus", resume);
      clockWindow.document.removeEventListener("visibilitychange", resume);
    };
  }, [serverTime, deadline, maximum, origin]);
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

/** 작은 창에는 현재 차례만 표시하며 초 갱신으로 판과 참가자 정보를 다시 그리지 않는다. */
export function PopupTurn({ ownTurn, serverTime, deadline }: {
  ownTurn: boolean; serverTime: string; deadline: string | null;
}) {
  const remaining = useRemainingSeconds(serverTime, deadline, 30);
  return <div className={styles.popupTurn} data-urgent={remaining <= 10}>
    <div><strong role="status">{ownTurn ? "내 차례예요" : "상대의 차례예요"}</strong>
      <span className={styles.popupClock}>00:{String(remaining).padStart(2, "0")}</span></div>
    <progress max={30} value={remaining} aria-label="현재 차례 남은 시간" />
  </div>;
}
