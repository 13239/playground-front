import type { MatchMove } from "../game-contracts";

/** 강도는 내부 탐색 설정으로만 사용하며 난이도 선택 화면에는 이름과 아이콘만 표시한다. */
export const aiDifficulties = {
  normal: { label: "노말", strength: 7, timeMs: 1_100, maxDepth: 6, width: 14, forcingDepth: 8 },
  hard: { label: "하드", strength: 10, timeMs: 4_500, maxDepth: 12, width: 24, forcingDepth: 22 },
} as const;

export type AiDifficulty = keyof typeof aiDifficulties;
export const isAiDifficulty = (value: unknown): value is AiDifficulty => value === "normal" || value === "hard";
/** 사람 대전과 같은 20×20 판을 사용하며 렌주는 흑돌의 금수·정확한 5목을 적용한다. */
export const aiRules = {
  freestyle: { label: "자유 룰" },
  renju: { label: "렌주 룰" },
} as const;
export type AiRule = keyof typeof aiRules;
export const isAiRule = (value: unknown): value is AiRule => value === "freestyle" || value === "renju";
// 문장 경계를 명시해 화면 크기와 관계없이 금수와 승리 조건을 각각 새 줄에서 읽게 한다.
export const RENJU_DESCRIPTION = "흑돌은 3·3, 4·4, 장목(6목 이상)을 둘 수 없어요.\n흑은 정확한 5목, 백은 5목 이상으로 승리해요.";
export const AI_BOARD_SIZE = 20;
export type AiPoint = Readonly<{ x: number; y: number }>;
export type AiSearchRequest = Readonly<{
  requestId: number;
  difficulty: AiDifficulty;
  rule: AiRule;
  blackSeat: 1 | 2;
  moves: readonly MatchMove[];
}>;
export type AiSearchResponse = Readonly<
  | { requestId: number; ok: true; move: AiPoint; depth: number; nodes: number }
  | { requestId: number; ok: false }
>;

/** 워커 경계에서도 범위·중복·최대 크기를 확인해 잘못된 판을 탐색하지 않는다. */
export function isAiPosition(value: unknown): value is readonly MatchMove[] {
  if (!Array.isArray(value) || value.length > AI_BOARD_SIZE ** 2) return false;
  const occupied = new Set<number>();
  return value.every(move => {
    if (!move || typeof move !== "object" || !Number.isInteger(move.x) || !Number.isInteger(move.y)
      || move.x < 0 || move.x >= AI_BOARD_SIZE || move.y < 0 || move.y >= AI_BOARD_SIZE
      || move.seat !== 1 && move.seat !== 2) return false;
    const point = move.y * AI_BOARD_SIZE + move.x;
    if (occupied.has(point)) return false;
    occupied.add(point);
    return true;
  });
}
