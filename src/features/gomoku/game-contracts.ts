import { isObject } from "./contracts";

/** 화면과 BFF가 같은 대국 계약을 검증한다. 숨긴 카드·내부 회원 ID·서버 원본 엔티티는 받지 않는다. */
export type MatchMove = Readonly<{ x: number; y: number; seat: 1 | 2 }>;
export type MatchState = Readonly<{
  id: number;
  round: number;
  phase: "DRAWING" | "REVEAL" | "PLAYING" | "FINISHED";
  blackSeat: 0 | 1 | 2;
  turnSeat: 1 | 2;
  turnNumber: number;
  deadline: string | null;
  pickOne: -1 | 0 | 1;
  pickTwo: -1 | 0 | 1;
  undoOne: number;
  undoTwo: number;
  undoSeat: 0 | 1 | 2;
  undoDeadline: string | null;
  winnerSeat: 0 | 1 | 2;
  finishReason: "FIVE" | "BOARD_FULL" | "RESIGN" | "DISCONNECT" | "INTERRUPTED" | null;
  rematchOne: boolean;
  rematchTwo: boolean;
  connectedOne: boolean;
  connectedTwo: boolean;
  moves: readonly MatchMove[];
}>;
export type GameAction =
  | Readonly<{ action: "PICK"; card: 0 | 1 }>
  | Readonly<{ action: "MOVE"; x: number; y: number }>
  | Readonly<{ action: "UNDO_REPLY"; accept: boolean }>
  | Readonly<{ action: "UNDO_REQUEST" | "RESIGN" | "DISCONNECT" | "REMATCH" }>;

const integer = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;
const time = (value: unknown) => typeof value === "string" && value.length <= 40 && Number.isFinite(Date.parse(value));

export function isMatchState(value: unknown): value is MatchState {
  if (!isObject(value) || !integer(value.id, 1, Number.MAX_SAFE_INTEGER) || !integer(value.round, 1, 2_147_483_647)
    || !["DRAWING", "REVEAL", "PLAYING", "FINISHED"].includes(value.phase as string)
    || !integer(value.blackSeat, 0, 2) || !integer(value.turnSeat, 1, 2) || !integer(value.turnNumber, 0, Number.MAX_SAFE_INTEGER)
    || !(value.deadline === null || time(value.deadline)) || !integer(value.pickOne, -1, 1) || !integer(value.pickTwo, -1, 1)
    || !integer(value.undoOne, 0, 5) || !integer(value.undoTwo, 0, 5) || !integer(value.undoSeat, 0, 2)
    || !(value.undoDeadline === null || time(value.undoDeadline)) || !integer(value.winnerSeat, 0, 2)
    || !(value.finishReason === null || ["FIVE", "BOARD_FULL", "RESIGN", "DISCONNECT", "INTERRUPTED"].includes(value.finishReason as string))
    || [value.rematchOne, value.rematchTwo, value.connectedOne, value.connectedTwo].some(v => typeof v !== "boolean")
    || !Array.isArray(value.moves) || value.moves.length > 400
    || !value.moves.every(m => isObject(m) && integer(m.x, 0, 19) && integer(m.y, 0, 19) && integer(m.seat, 1, 2))) return false;
  return new Set(value.moves.map(m => m.y * 20 + m.x)).size === value.moves.length
    && (value.phase === "DRAWING" ? value.blackSeat === 0 : value.blackSeat !== 0)
    && (value.phase === "FINISHED" ? value.deadline === null && value.finishReason !== null : value.deadline !== null && value.finishReason === null)
    && (value.undoSeat === 0 ? value.undoDeadline === null : value.undoDeadline !== null)
    && !(value.pickOne >= 0 && value.pickOne === value.pickTwo);
}

/** 서버 응답의 추가 필드를 흘려보내지 않고 허용한 값만 다시 만든다. */
export function publicMatch(game: MatchState): MatchState {
  return {
    id: game.id, round: game.round, phase: game.phase, blackSeat: game.blackSeat, turnSeat: game.turnSeat,
    turnNumber: game.turnNumber, deadline: game.deadline, pickOne: game.pickOne, pickTwo: game.pickTwo,
    undoOne: game.undoOne, undoTwo: game.undoTwo, undoSeat: game.undoSeat, undoDeadline: game.undoDeadline,
    winnerSeat: game.winnerSeat, finishReason: game.finishReason, rematchOne: game.rematchOne, rematchTwo: game.rematchTwo,
    connectedOne: game.connectedOne, connectedTwo: game.connectedTwo,
    moves: game.moves.map(({ x, y, seat }) => ({ x, y, seat })),
  };
}

export function isGameAction(value: Record<string, unknown>): boolean {
  const absent = (...keys: string[]) => keys.every(key => value[key] === undefined);
  switch (value.action) {
    case "MOVE": return integer(value.x, 0, 19) && integer(value.y, 0, 19) && absent("card", "accept");
    case "PICK": return integer(value.card, 0, 1) && absent("x", "y", "accept");
    case "UNDO_REPLY": return typeof value.accept === "boolean" && absent("x", "y", "card");
    default: return ["UNDO_REQUEST", "RESIGN", "DISCONNECT", "REMATCH"].includes(value.action as string) && absent("x", "y", "card", "accept");
  }
}
