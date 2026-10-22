"use client";

import { memo, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import type { MatchState } from "../game-contracts";
import styles from "./game-room.module.css";

/** 마우스는 미리보기 후 클릭, 터치는 같은 교차점을 두 번 눌러 착수한다. 키보드는 방향키·Enter/Space를 사용한다. */
export const GameBoard = memo(function GameBoard({ game, selfSeat, serverTime, disabled, onMove }: {
  game: MatchState; selfSeat: number; serverTime: string; disabled: boolean; onMove: (x: number, y: number) => void;
}) {
  const [selection, setSelection] = useState<{ gameId: number; turn: number; point: number; input: "mouse" | "touch" | "keyboard" } | null>(null);
  // 턴·대국이 바뀌면 선택만 무효화한다. 키보드 위치는 매 수마다 초기화하지 않는다.
  const [cursor, setCursor] = useState(210);
  const grid = useRef<HTMLDivElement>(null);
  const pointerType = useRef("mouse");
  const submitted = useRef(false);
  const board = useMemo(() => new Map(game.moves.map((move, index) => [move.y * 20 + move.x, { ...move, index }])), [game.moves]);
  const [expiredDeadline, setExpiredDeadline] = useState<string | null>(null);
  useEffect(() => {
    // 매초 상위 화면을 다시 그리지 않고 서버 턴 마감 시에만 판의 착수 입력을 비활성화한다.
    if (game.phase !== "PLAYING" || !game.deadline) return;
    const deadline = game.deadline;
    const delay = Math.max(0, Date.parse(deadline) - Date.parse(serverTime));
    const timer = setTimeout(() => setExpiredDeadline(deadline), delay);
    return () => clearTimeout(timer);
  }, [game.phase, game.deadline, serverTime]);
  useEffect(() => {
    // React가 pending을 반영하기 전의 연속 클릭도 한 번만 전송하고, 실패 복구·다음 턴에는 다시 입력을 허용한다.
    if (!disabled) submitted.current = false;
  }, [disabled, game.id, game.turnNumber]);
  useEffect(() => {
    // 다른 창·탭에서 돌아온 뒤 오래된 터치 선택이 두 번째 탭으로 처리되지 않게 미리보기만 지운다.
    const clear = () => setSelection(null);
    const visible = () => { if (document.visibilityState !== "visible") clear(); };
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", visible);
    return () => { window.removeEventListener("blur", clear); document.removeEventListener("visibilitychange", visible); };
  }, []);
  const expired = game.deadline !== null && (expiredDeadline === game.deadline || Date.parse(serverTime) >= Date.parse(game.deadline));
  const last = game.moves.at(-1);
  const canMove = !disabled && !expired && game.phase === "PLAYING" && game.turnSeat === selfSeat;
  const selected = canMove && selection?.gameId === game.id && selection.turn === game.turnNumber && !board.has(selection.point)
    ? selection.point : null;

  function preview(point: number, input: "mouse" | "touch" | "keyboard") {
    if (!canMove || board.has(point) || submitted.current) { setSelection(null); return; }
    setSelection({ gameId: game.id, turn: game.turnNumber, point, input });
  }

  function place(point: number) {
    if (!canMove || board.has(point) || submitted.current) return;
    submitted.current = true;
    setSelection(null);
    onMove(point % 20, Math.floor(point / 20));
  }

  function activate(event: MouseEvent<HTMLButtonElement>, point: number) {
    if (!canMove || board.has(point)) return;
    // 최신 브라우저의 click은 PointerEvent다. 이전 구현은 pointerdown에서 기억한 실제 입력 종류로 보완한다.
    const native = event.nativeEvent;
    const eventPointer = "pointerType" in native && typeof native.pointerType === "string" && native.pointerType ? native.pointerType : undefined;
    const input = eventPointer ?? pointerType.current;
    // 포인터 종류가 없는 detail 0만 키보드·보조기술로 본다. 터치·펜은 detail과 관계없이 두 번째 입력에서 확정한다.
    if (event.detail === 0 && !eventPointer || input === "mouse" || selected === point && selection?.input === "touch") place(point);
    else preview(point, "touch");
  }

  function key(event: KeyboardEvent<HTMLButtonElement>, position: number) {
    const x = position % 20, y = Math.floor(position / 20);
    const next = { ArrowLeft: y * 20 + Math.max(0, x - 1), ArrowRight: y * 20 + Math.min(19, x + 1),
      ArrowUp: Math.max(0, y - 1) * 20 + x, ArrowDown: Math.min(19, y + 1) * 20 + x }[event.key];
    if (next !== undefined) {
      event.preventDefault(); setCursor(next); preview(next, "keyboard");
      grid.current?.querySelector<HTMLButtonElement>(`[data-position="${next}"]`)?.focus();
    }
    if (event.key === "Escape") { event.preventDefault(); setSelection(null); }
    // Enter를 누른 채 서버 오류가 복구되어도 키 반복으로 새 착수를 보내지 않는다.
    if (event.repeat && (event.key === "Enter" || event.key === " ")) event.preventDefault();
  }
  return (
    <section className={styles.boardSection} aria-label="오목판">
      <div className={styles.boardScroll}>
        <div className={styles.boardFrame}>
        <div className={styles.columnLabels} aria-hidden="true">{Array.from({ length: 20 }, (_, x) => <span key={x}>{String.fromCharCode(65 + x)}</span>)}</div>
        <div className={styles.boardInner}>
        <div className={styles.rowLabels} aria-hidden="true">{Array.from({ length: 20 }, (_, y) => <span key={y}>{y + 1}</span>)}</div>
        <div className={styles.board} ref={grid} role="grid" aria-label="20줄 오목판" aria-rowcount={20} aria-colcount={20}
          onPointerLeave={event => { if (event.pointerType === "mouse") setSelection(current => current?.input === "mouse" ? null : current); }}
          onPointerCancel={() => setSelection(null)}>
          {Array.from({ length: 20 }, (_, y) => <div role="row" key={y} className={styles.boardRow}>
            {Array.from({ length: 20 }, (_, x) => {
              const position = y * 20 + x, move = board.get(position);
              const color = move?.seat === game.blackSeat ? "black" : "white";
              const isLast = last?.x === x && last?.y === y;
              return <button key={x} type="button" role="gridcell" aria-rowindex={y + 1} aria-colindex={x + 1}
                aria-label={`${String.fromCharCode(65 + x)}${y + 1}${move ? ` ${color === "black" ? "흑돌" : "백돌"}${isLast ? " 마지막 수" : ""}` : " 빈 자리"}`}
                aria-selected={selected === position} aria-disabled={!canMove || !!move} tabIndex={cursor === position ? 0 : -1}
                className={styles.intersection} data-position={position} data-x={x} data-y={y}
                onKeyDown={event => key(event, position)}
                onFocus={event => { setCursor(position); if (event.currentTarget.matches(":focus-visible")) preview(position, "keyboard"); }}
                onPointerDown={event => { pointerType.current = event.pointerType || "mouse"; }}
                onPointerEnter={event => { if (event.pointerType === "mouse") preview(position, "mouse"); }}
                onClick={event => activate(event, position)}>
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
