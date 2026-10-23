import type { MatchMove } from "../game-contracts";
import type { AiDifficulty, AiPoint, AiRule } from "./contracts";
import { evaluateAiMove } from "./rules";

export type AiGameState = Readonly<{
  id: number;
  difficulty: AiDifficulty;
  rule: AiRule;
  blackSeat: 1 | 2;
  turnSeat: 1 | 2;
  turnNumber: number;
  phase: "PLAYING" | "FINISHED";
  deadline: null;
  moves: readonly MatchMove[];
  winner: 0 | 1 | 2;
  reason: "FIVE" | "BOARD_FULL" | "RESIGN" | null;
  undoUsed: boolean;
  error: boolean;
  forbidden: boolean;
  attempt: number;
}>;
export type AiGameAction =
  | Readonly<{ type: "MOVE"; point: AiPoint; seat: 1 | 2; id: number; turn: number }>
  | Readonly<{ type: "ERROR"; id: number; turn: number }>
  | Readonly<{ type: "UNDO" }>
  | Readonly<{ type: "RETRY" }>
  | Readonly<{ type: "RESIGN" }>
  | Readonly<{ type: "REMATCH" }>;

/** 첫판은 사람이 흑이며, 재대국부터 직전 패자가 흑을 잡는다. 방·서버 대국은 생성하지 않는다. */
export function initialAiGame(difficulty: AiDifficulty, id = 1, blackSeat: 1 | 2 = 1, rule: AiRule = "freestyle"): AiGameState {
  return { id, difficulty, rule, blackSeat, turnSeat: blackSeat, turnNumber: 0, phase: "PLAYING", deadline: null,
    moves: [], winner: 0, reason: null, undoUsed: false, error: false, forbidden: false, attempt: 0 };
}

/** 빠른 연속 입력·늦은 워커 응답은 같은 판·차례 검증으로 무시하고 상태 전이는 한곳에서 처리한다. */
export function aiGameReducer(state: AiGameState, action: AiGameAction): AiGameState {
  if (action.type === "REMATCH") {
    if (state.phase !== "FINISHED") return state;
    const black = state.winner === 0 ? (3 - state.blackSeat) as 1 | 2 : (3 - state.winner) as 1 | 2;
    return initialAiGame(state.difficulty, state.id + 1, black, state.rule);
  }
  if (state.phase !== "PLAYING") return state;
  if (action.type === "RESIGN") return { ...state, phase: "FINISHED", winner: 2, reason: "RESIGN", error: false, forbidden: false };
  if (action.type === "RETRY") return state.error ? { ...state, error: false, attempt: state.attempt + 1 } : state;
  if (action.type === "UNDO") {
    if (state.undoUsed) return state;
    const index = state.moves.findLastIndex(move => move.seat === 1);
    if (index < 0) return state;
    return { ...state, moves: state.moves.slice(0, index), turnSeat: 1, turnNumber: state.turnNumber + 1,
      undoUsed: true, error: false, forbidden: false, attempt: state.attempt + 1 };
  }
  if (action.id !== state.id || action.turn !== state.turnNumber) return state;
  if (action.type === "ERROR") return state.turnSeat === 2 ? { ...state, error: true } : state;
  const { x, y } = action.point;
  if (action.seat !== state.turnSeat || state.error || !Number.isInteger(x) || !Number.isInteger(y)
    || x < 0 || x >= 20 || y < 0 || y >= 20 || state.moves.some(move => move.x === x && move.y === y)) return state;
  const last: MatchMove = { x, y, seat: action.seat };
  const result = evaluateAiMove(state.moves, last, action.seat, state.rule, state.blackSeat);
  if (result === "FORBIDDEN") {
    // 금수는 차례·돌·무르기 횟수를 유지하고 입력 식별자만 갱신해 다른 칸에 곧바로 다시 둘 수 있게 한다.
    return action.seat === 1 ? { ...state, forbidden: true, turnNumber: state.turnNumber + 1 } : { ...state, error: true };
  }
  const moves = [...state.moves, last];
  const five = result === "WIN", full = moves.length === 400;
  return { ...state, moves, forbidden: false, turnSeat: (3 - state.turnSeat) as 1 | 2, turnNumber: state.turnNumber + 1,
    phase: five || full ? "FINISHED" : "PLAYING", winner: five ? action.seat : 0,
    reason: five ? "FIVE" : full ? "BOARD_FULL" : null };
}
