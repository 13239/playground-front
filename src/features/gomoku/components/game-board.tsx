"use client";

import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import type { MatchState } from "../game-contracts";
import styles from "./game-room.module.css";

/** 교차점 선택과 착수를 분리해 작은 터치 화면의 오착을 줄인다. 키보드는 방향키·Enter로 같은 흐름을 사용한다. */
export const GameBoard = memo(function GameBoard({ game, selfSeat, serverTime, disabled, onMove }: {
  game: MatchState; selfSeat: number; serverTime: string; disabled: boolean; onMove: (x: number, y: number) => void;
}) {
  const [selection, setSelection] = useState<{ turn: number; point: number } | null>(null);
  // 턴이 바뀌면 선택만 무효화한다. 확대 배율·키보드 위치는 매 수마다 초기화하지 않는다.
  const selected = selection?.turn === game.turnNumber ? selection.point : null;
  const [cursor, setCursor] = useState(210);
  const [zoom, setZoom] = useState(1);
  const grid = useRef<HTMLDivElement>(null);
  const board = useMemo(() => new Map(game.moves.map((move, index) => [move.y * 20 + move.x, { ...move, index }])), [game.moves]);
  const [expiredDeadline, setExpiredDeadline] = useState<string | null>(null);
  useEffect(() => {
    // 매초 상위 화면을 다시 그리지 않고 서버 턴 마감 시에만 착수 버튼을 한 번 비활성화한다.
    if (game.phase !== "PLAYING" || !game.deadline) return;
    const deadline = game.deadline;
    const delay = Math.max(0, Date.parse(deadline) - Date.parse(serverTime));
    const timer = setTimeout(() => setExpiredDeadline(deadline), delay);
    return () => clearTimeout(timer);
  }, [game.phase, game.deadline, serverTime]);
  const expired = game.deadline !== null && (expiredDeadline === game.deadline || Date.parse(serverTime) >= Date.parse(game.deadline));
  const last = game.moves.at(-1);
  const canMove = !disabled && !expired && game.phase === "PLAYING" && game.turnSeat === selfSeat;
  const selectionValid = selected !== null && !board.has(selected);

  function key(event: KeyboardEvent<HTMLButtonElement>, position: number) {
    const x = position % 20, y = Math.floor(position / 20);
    const next = { ArrowLeft: y * 20 + Math.max(0, x - 1), ArrowRight: y * 20 + Math.min(19, x + 1),
      ArrowUp: Math.max(0, y - 1) * 20 + x, ArrowDown: Math.min(19, y + 1) * 20 + x }[event.key];
    if (next !== undefined) {
      event.preventDefault(); setCursor(next);
      grid.current?.querySelector<HTMLButtonElement>(`[data-position="${next}"]`)?.focus();
    }
  }
  function confirm() {
    if (!canMove || !selectionValid || selected === null) return;
    onMove(selected % 20, Math.floor(selected / 20)); setSelection(null);
  }
  return (
    <section className={styles.boardSection} aria-label="오목판">
      <div className={styles.boardTools}>
        <span>20 × 20 <small>· {game.moves.length}수</small></span>
        <label>판 확대 <select value={zoom} onChange={event => setZoom(Number(event.target.value))}>
          <option value={1}>100%</option><option value={1.5}>150%</option><option value={2}>200%</option>
        </select></label>
      </div>
      <div className={styles.boardScroll}>
        <div className={styles.boardFrame} style={{ "--board-zoom": zoom } as CSSProperties}>
        <div className={styles.columnLabels} aria-hidden="true">{Array.from({ length: 20 }, (_, x) => <span key={x}>{String.fromCharCode(65 + x)}</span>)}</div>
        <div className={styles.boardInner}>
        <div className={styles.rowLabels} aria-hidden="true">{Array.from({ length: 20 }, (_, y) => <span key={y}>{y + 1}</span>)}</div>
        <div className={styles.board} ref={grid} role="grid" aria-label="20줄 오목판" aria-rowcount={20} aria-colcount={20}
          >
          {Array.from({ length: 20 }, (_, y) => <div role="row" key={y} className={styles.boardRow}>
            {Array.from({ length: 20 }, (_, x) => {
              const position = y * 20 + x, move = board.get(position);
              const color = move?.seat === game.blackSeat ? "black" : "white";
              const isLast = last?.x === x && last?.y === y;
              return <button key={x} type="button" role="gridcell" aria-rowindex={y + 1} aria-colindex={x + 1}
                aria-label={`${String.fromCharCode(65 + x)}${y + 1}${move ? ` ${color === "black" ? "흑돌" : "백돌"}${isLast ? " 마지막 수" : ""}` : " 빈 자리"}`}
                aria-selected={selected === position} aria-disabled={!canMove || !!move} tabIndex={cursor === position ? 0 : -1}
                className={styles.intersection} data-position={position} data-x={x} data-y={y}
                onKeyDown={event => key(event, position)} onFocus={() => setCursor(position)}
                onClick={() => { if (canMove && !move) setSelection({ turn: game.turnNumber, point: position }); }}>
                {[3, 9, 16].includes(x) && [3, 9, 16].includes(y) && <span className={styles.starPoint} />}
                {move && <span className={styles.stone} data-color={color}>{isLast && <span className={styles.lastStone} />}</span>}
                {!move && selected === position && <span className={styles.preview} data-color={selfSeat === game.blackSeat ? "black" : "white"} />}
              </button>;
            })}
          </div>)}
        </div>
        <div className={styles.rowLabels} aria-hidden="true">{Array.from({ length: 20 }, (_, y) => <span key={y}>{y + 1}</span>)}</div>
        </div>
        <div className={styles.columnLabels} aria-hidden="true">{Array.from({ length: 20 }, (_, x) => <span key={x}>{String.fromCharCode(65 + x)}</span>)}</div>
        </div>
      </div>
      <div className={styles.moveBar}>
        <p aria-live="polite">{!canMove ? game.phase === "FINISHED" ? "대국이 끝났어요." : "상대의 착수를 기다리고 있어요."
          : selectionValid && selected !== null ? `${String.fromCharCode(65 + selected % 20)}${Math.floor(selected / 20) + 1}에 돌을 놓을까요?` : "교차점을 선택한 뒤 착수하기를 눌러주세요."}</p>
        <button className={styles.primaryButton} type="button" disabled={!canMove || !selectionValid} onClick={confirm}>착수하기</button>
      </div>
    </section>
  );
}, (previous, next) => {
  // 접속 확인 응답의 serverTime/connected 플래그만 달라졌다면 400개 교차점을 다시 그리지 않는다.
  // 되돌리기·재착수는 turnNumber가 증가하므로 같은 개수의 돌이라도 반드시 다시 렌더링한다.
  return previous.selfSeat === next.selfSeat && previous.disabled === next.disabled && previous.onMove === next.onMove
    && previous.game.id === next.game.id && previous.game.phase === next.game.phase
    && previous.game.blackSeat === next.game.blackSeat && previous.game.turnSeat === next.game.turnSeat
    && previous.game.turnNumber === next.game.turnNumber && previous.game.deadline === next.game.deadline
    && previous.game.moves.length === next.game.moves.length;
});
