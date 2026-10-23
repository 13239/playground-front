"use client";

import { useCallback, useEffect, useReducer } from "react";
import { aiDifficulties, type AiDifficulty, type AiRule, type AiSearchRequest, type AiSearchResponse } from "../ai/contracts";
import { aiGameReducer, initialAiGame } from "../ai/game-state";

/** 한 차례당 하나의 워커만 실행한다. 무르기·재대국·나가기·계정 변경은 계산과 늦은 응답을 함께 폐기한다. */
export function useAiGame(difficulty: AiDifficulty, rule: AiRule) {
  // 난이도·규칙은 대국에 고정하고 팝업 전환은 이 훅을 재생성하지 않는다.
  const [game, dispatch] = useReducer(aiGameReducer, { difficulty, rule }, options => initialAiGame(options.difficulty, 1, 1, options.rule));
  const thinking = game.phase === "PLAYING" && game.turnSeat === 2 && !game.error;

  useEffect(() => {
    if (!thinking) return;
    let active = true;
    let worker: Worker | undefined;
    const { id, turnNumber: turn } = game;
    const fail = () => { if (active) dispatch({ type: "ERROR", id, turn }); };
    // 워커 로드 실패나 장치 중단은 임의의 약한 착수로 덮지 않고 사용자에게 재시도를 제공한다.
    const timeout = window.setTimeout(() => { worker?.terminate(); fail(); }, aiDifficulties[difficulty].timeMs + 5_000);
    try {
      worker = new Worker(new URL("../ai/worker.ts", import.meta.url), { type: "module", name: "gomoku-ai" });
      worker.onmessage = (event: MessageEvent<AiSearchResponse>) => {
        if (!active || event.data?.requestId !== turn) return;
        window.clearTimeout(timeout);
        worker?.terminate();
        const result = event.data;
        if (!result.ok || !result.move || !Number.isInteger(result.move.x) || !Number.isInteger(result.move.y)
          || result.move.x < 0 || result.move.x >= 20 || result.move.y < 0 || result.move.y >= 20
          || game.moves.some(move => move.x === result.move.x && move.y === result.move.y)) { fail(); return; }
        dispatch({ type: "MOVE", point: result.move, seat: 2, id, turn });
      };
      worker.onerror = () => { window.clearTimeout(timeout); worker?.terminate(); fail(); };
      worker.onmessageerror = () => { window.clearTimeout(timeout); worker?.terminate(); fail(); };
      worker.postMessage({ requestId: turn, difficulty, rule: game.rule, blackSeat: game.blackSeat, moves: game.moves } satisfies AiSearchRequest);
    } catch { queueMicrotask(fail); }
    return () => { active = false; window.clearTimeout(timeout); worker?.terminate(); };
  }, [thinking, difficulty, game]);

  const move = useCallback((x: number, y: number) => {
    dispatch({ type: "MOVE", point: { x, y }, seat: 1, id: game.id, turn: game.turnNumber });
  }, [game.id, game.turnNumber]);

  return { game, thinking, move, dispatch };
}
