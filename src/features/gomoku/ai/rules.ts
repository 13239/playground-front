import type { MatchMove } from "../game-contracts";
import { AI_BOARD_SIZE as SIZE, type AiPoint, type AiRule } from "./contracts";

const directions = [[1, 0], [0, 1], [1, 1], [1, -1]] as const;
type Seat = 1 | 2;
export type AiMoveResult = "VALID" | "WIN" | "OCCUPIED" | "FORBIDDEN";

/** UI의 평면 판과 탐색기의 패딩 판에 같은 판정을 적용해 AI의 흑백 교대 후에도 규칙이 바뀌지 않는다. */
export class AiRuleEvaluator {
  constructor(private readonly board: Int8Array, private readonly rule: AiRule, private readonly blackSeat: Seat,
    private readonly stride = SIZE, private readonly origin = 0) {}

  private offset(point: number, direction: readonly [number, number], distance: number) {
    const relative = point - this.origin;
    const x = relative % this.stride + direction[0] * distance;
    const y = Math.floor(relative / this.stride) + direction[1] * distance;
    return x < 0 || x >= SIZE || y < 0 || y >= SIZE ? -1 : this.origin + y * this.stride + x;
  }

  private run(point: number, direction: readonly [number, number]) {
    let count = 1;
    for (const sign of [-1, 1]) for (let distance = 1; distance < SIZE; distance++) {
      const candidate = this.offset(point, direction, sign * distance);
      if (candidate < 0 || this.board[candidate] !== this.board[point]) break;
      count++;
    }
    return count;
  }

  hasFive(point: number) {
    const exact = this.rule === "renju" && this.board[point] === this.blackSeat;
    return directions.some(direction => exact ? this.run(point, direction) === 5 : this.run(point, direction) >= 5);
  }

  /** 열린 4의 양 끝을 같은 4로 합치되, 한 방향의 서로 다른 4·4는 구분한다. */
  private fours(point: number) {
    const result = new Set<string>();
    for (const direction of directions) for (let start = -4; start <= 0; start++) {
      const stones: number[] = [];
      let empty = -1, valid = true;
      for (let step = 0; step < 5; step++) {
        const candidate = this.offset(point, direction, start + step);
        if (candidate < 0 || this.board[candidate] !== 0 && this.board[candidate] !== this.blackSeat) { valid = false; break; }
        if (this.board[candidate] === this.blackSeat) stones.push(candidate);
        else if (empty < 0) empty = candidate;
        else { valid = false; break; }
      }
      if (!valid || stones.length !== 4 || empty < 0) continue;
      this.board[empty] = this.blackSeat;
      try { if (this.run(empty, direction) === 5) result.add(stones.join(",")); }
      finally { this.board[empty] = 0; }
    }
    return result.size;
  }

  private legalBlack(point: number, memo: Map<string, boolean>, extensions: number[]): boolean {
    // RIF 9.1~9.3: 정확한 5목을 동시에 완성하면 승리가 우선한다. 가짜 3은 확장 수의 금수까지 재귀 판정한다.
    // https://gomoku.renju.net/rifrules/ — 판 크기와 시작 방식은 기존 서비스의 20×20 규칙을 유지한다.
    if (this.hasFive(point)) return true;
    const key = `${point}:${extensions.toSorted((a, b) => a - b).join(",")}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    const save = (legal: boolean) => { memo.set(key, legal); return legal; };
    if (directions.some(direction => this.run(point, direction) > 5) || this.fours(point) >= 2) return save(false);
    const threes = new Set<string>();
    for (const direction of directions) for (let start = -3; start <= 0; start++) {
      const left = this.offset(point, direction, start - 1), right = this.offset(point, direction, start + 4);
      if (left < 0 || right < 0 || this.board[left] || this.board[right]) continue;
      const stones: number[] = [];
      let empty = -1, valid = true;
      for (let step = 0; step < 4; step++) {
        const candidate = this.offset(point, direction, start + step);
        if (candidate < 0 || this.board[candidate] !== 0 && this.board[candidate] !== this.blackSeat) { valid = false; break; }
        if (this.board[candidate] === this.blackSeat) stones.push(candidate);
        else if (empty < 0) empty = candidate;
        else { valid = false; break; }
      }
      if (!valid || stones.length !== 3 || empty < 0) continue;
      this.board[empty] = this.blackSeat;
      extensions.push(empty);
      let open = false;
      try {
        // 겉으로 양 끝이 비어 있어도 끝을 채웠을 때 장목이면 합법적인 열린 4가 아니다.
        const straightFour = this.run(empty, direction) === 4
          && [left, right].every(end => {
            this.board[end] = this.blackSeat;
            try { return this.run(end, direction) === 5; }
            finally { this.board[end] = 0; }
          });
        open = straightFour && !this.hasFive(empty) && this.legalBlack(empty, memo, extensions);
      } finally { extensions.pop(); this.board[empty] = 0; }
      if (open) threes.add(stones.join(","));
      if (threes.size >= 2) return save(false);
    }
    return save(true);
  }

  /** 가상 착수는 반드시 복원하므로 후보 검증이 실제 판이나 탐색 캐시를 바꾸지 않는다. */
  evaluate(point: number, seat: Seat): AiMoveResult {
    if (this.board[point] !== 0) return "OCCUPIED";
    this.board[point] = seat;
    try {
      if (this.hasFive(point)) return "WIN";
      return this.rule === "renju" && seat === this.blackSeat && !this.legalBlack(point, new Map(), []) ? "FORBIDDEN" : "VALID";
    } finally { this.board[point] = 0; }
  }
}

function positionBoard(moves: readonly MatchMove[]) {
  const board = new Int8Array(SIZE ** 2);
  for (const move of moves) board[move.y * SIZE + move.x] = move.seat;
  return board;
}

/** 자유 룰: 가로·세로·두 대각선 중 다섯 개 이상 이어지면 승리한다. 렌주 흑은 정확히 다섯 개만 승리한다. */
export function hasAiFive(moves: readonly MatchMove[], last: MatchMove, rule: AiRule = "freestyle", blackSeat: Seat = 1): boolean {
  return new AiRuleEvaluator(positionBoard(moves), rule, blackSeat).hasFive(last.y * SIZE + last.x);
}

/** reducer도 워커의 응답을 신뢰하지 않고 선택한 규칙으로 착수를 최종 검증한다. */
export function evaluateAiMove(moves: readonly MatchMove[], point: AiPoint, seat: Seat, rule: AiRule, blackSeat: Seat): AiMoveResult {
  return new AiRuleEvaluator(positionBoard(moves), rule, blackSeat).evaluate(point.y * SIZE + point.x, seat);
}
