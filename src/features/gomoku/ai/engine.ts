import type { MatchMove } from "../game-contracts";
import { AI_BOARD_SIZE, aiDifficulties, isAiPosition, type AiDifficulty, type AiPoint, type AiRule } from "./contracts";
import { AiRuleEvaluator, hasAiFive, type AiMoveResult } from "./rules";

const SIZE = AI_BOARD_SIZE;
const STRIDE = SIZE + 2;
const AREA = STRIDE ** 2;
const DIRECTIONS = [1, STRIDE, STRIDE + 1, STRIDE - 1];
const FIVE = 10_000_000;
const OPEN_FOUR = 1_000_000;
const FOUR = 50_000;
const OPEN_THREE = 5_000;
const MATE = 1_000_000_000;
const STOP = Symbol("search-time-budget");
const TABLE_SIZE = 1 << 17;
type Seat = 1 | 2;
type Candidate = { point: number; attack: number; defense: number; order: number };
type SearchResult = Readonly<{ move: AiPoint; depth: number; nodes: number }>;
type SearchLimits = Readonly<{ timeMs?: number; maxDepth?: number; rule?: AiRule; blackSeat?: Seat }>;

// 같은 모양은 흑백·좌표에 관계없이 재사용한다. 중앙을 뺀 열 칸의 3진수 패턴이다.
const patternCache = new Int32Array(3 ** 10);
const cells: number[] = [];
const neighbors: number[][] = Array.from({ length: AREA }, () => []);
const affected: { point: number; direction: number }[][] = Array.from({ length: AREA }, () => []);
for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
  const point = (y + 1) * STRIDE + x + 1;
  cells.push(point);
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    if ((dx || dy) && x + dx >= 0 && x + dx < SIZE && y + dy >= 0 && y + dy < SIZE)
      neighbors[point].push(point + dy * STRIDE + dx);
  }
  for (let direction = 0; direction < 4; direction++) {
    const [dx, dy] = [[1, 0], [0, 1], [1, 1], [-1, 1]][direction];
    for (let step = -5; step <= 5; step++) {
      if (step && x + dx * step >= 0 && x + dx * step < SIZE && y + dy * step >= 0 && y + dy * step < SIZE)
        affected[point].push({ point: point + DIRECTIONS[direction] * step, direction });
    }
  }
}

// 두 개의 독립 해시를 대조해 전이표 충돌로 다른 판의 평가를 사용하는 것을 막는다.
let randomSeed = 0x734a91b3;
function random32() {
  randomSeed ^= randomSeed << 13; randomSeed ^= randomSeed >>> 17; randomSeed ^= randomSeed << 5;
  return randomSeed >>> 0;
}
const hashKeys = Array.from({ length: 3 }, () => new Uint32Array(AREA * 2));
for (const seat of [1, 2]) for (let i = 0; i < AREA * 2; i++) hashKeys[seat][i] = random32();

/** 중앙의 돌을 포함하는 다섯 칸 중 한 칸만 채우면 이기는 위치를 중복 없이 모은다. */
function winningMask(line: Int8Array) {
  let mask = 0;
  for (let start = 1; start <= 5; start++) {
    let empty = -1, stones = 0;
    for (let offset = 0; offset < 5; offset++) {
      const index = start + offset;
      if (line[index] === 1) stones++;
      else if (line[index] === 0) empty = index;
      else { stones = -5; break; }
    }
    if (stones === 4 && empty >= 0) mask |= 1 << empty;
  }
  return mask;
}
const multipleBits = (mask: number) => (mask & (mask - 1)) !== 0;

function patternScore(code: number) {
  if (patternCache[code]) return patternCache[code];
  const line = new Int8Array(11);
  line[5] = 1;
  let remaining = code;
  for (let i = 10; i >= 0; i--) if (i !== 5) { line[i] = remaining % 3; remaining = Math.floor(remaining / 3); }
  let best = 0;
  for (let start = 1; start <= 5; start++) {
    let count = 0;
    for (let i = start; i < start + 5; i++) {
      if (line[i] === 2) { count = -1; break; }
      if (line[i] === 1) count++;
    }
    best = Math.max(best, count);
  }
  let score: number;
  if (best === 5) score = FIVE;
  else {
    const wins = winningMask(line);
    if (wins) score = multipleBits(wins) ? OPEN_FOUR : FOUR;
    else {
      let three = false, openThree = false;
      // 끊어진 3·4도 이어 붙여 확인하므로 단순한 연속 돌 개수 평가에 의존하지 않는다.
      for (let i = 1; i <= 9; i++) if (i !== 5 && line[i] === 0) {
        line[i] = 1;
        const next = winningMask(line);
        line[i] = 0;
        if (multipleBits(next)) { openThree = true; break; }
        if (next) three = true;
      }
      score = openThree ? OPEN_THREE : three ? 500 : best >= 2 ? 50 : 3;
    }
  }
  patternCache[code] = score;
  return score;
}

class Search {
  readonly board = new Int8Array(AREA).fill(3);
  readonly near = new Int16Array(AREA);
  readonly lines = Array.from({ length: 3 }, () => new Int32Array(AREA * 4));
  readonly scores = Array.from({ length: 3 }, () => new Int32Array(AREA));
  readonly history = Array.from({ length: 3 }, () => new Int32Array(AREA));
  // 줄을 갱신할 때 짧은 배열을 계속 할당하지 않아 깊은 탐색의 GC 지연을 줄인다.
  readonly scratch = new Int8Array(11);
  readonly tableLo = new Uint32Array(TABLE_SIZE);
  readonly tableHi = new Uint32Array(TABLE_SIZE);
  readonly tableValue = new Int32Array(TABLE_SIZE);
  readonly tableDepth = new Int8Array(TABLE_SIZE);
  readonly tableFlag = new Uint8Array(TABLE_SIZE);
  readonly tableMove = new Int16Array(TABLE_SIZE);
  hashLo = 0;
  hashHi = 0;
  count: number;
  nodes = 0;
  readonly deadline: number;
  readonly settings: (typeof aiDifficulties)[AiDifficulty];
  readonly rules: AiRuleEvaluator;
  readonly legality = new Map<number, AiMoveResult>();

  constructor(moves: readonly MatchMove[], difficulty: AiDifficulty, started: number, timeMs: number,
    readonly rule: AiRule, readonly blackSeat: Seat) {
    this.rules = new AiRuleEvaluator(this.board, rule, blackSeat, STRIDE, STRIDE + 1);
    this.settings = aiDifficulties[difficulty];
    this.deadline = started + timeMs;
    this.count = moves.length;
    for (const point of cells) this.board[point] = 0;
    for (const move of moves) {
      const point = (move.y + 1) * STRIDE + move.x + 1;
      this.board[point] = move.seat;
      this.toggleHash(point, move.seat);
      for (const neighbor of neighbors[point]) this.near[neighbor]++;
    }
    for (const point of cells) if (!this.board[point]) {
      for (const side of [1, 2] as const) {
        for (let direction = 0; direction < 4; direction++) this.updateLine(point, side, direction);
        this.updateScore(point, side);
      }
    }
  }

  toggleHash(point: number, side: Seat) {
    this.hashLo = (this.hashLo ^ hashKeys[side][point * 2]) >>> 0;
    this.hashHi = (this.hashHi ^ hashKeys[side][point * 2 + 1]) >>> 0;
  }

  updateLine(point: number, side: Seat, direction: number) {
    let code = 0;
    const delta = DIRECTIONS[direction];
    // 첫 경계 이후에는 같은 줄의 바깥 칸을 모두 막아 패딩 너머의 다른 행을 읽지 않는다.
    const values = this.scratch;
    for (const sign of [-1, 1]) {
      let blocked = false;
      for (let step = 1; step <= 5; step++) {
        const value = blocked ? 3 : this.board[point + delta * step * sign];
        if (value === 3 || value === undefined) blocked = true;
        values[5 + step * sign] = blocked || value !== 0 && value !== side ? 2 : value === side ? 1 : 0;
      }
    }
    for (let i = 0; i < 11; i++) if (i !== 5) code = code * 3 + values[i];
    this.lines[side][point * 4 + direction] = patternScore(code);
  }

  updateScore(point: number, side: Seat) {
    let sum = 0, fours = 0, threes = 0, openFours = 0;
    for (let direction = 0; direction < 4; direction++) {
      const score = this.lines[side][point * 4 + direction];
      if (score >= FIVE) { this.scores[side][point] = FIVE; return; }
      if (score >= OPEN_FOUR) openFours++;
      else if (score >= FOUR) fours++;
      else if (score >= OPEN_THREE) threes++;
      sum += score;
    }
    // 두 방향의 위협을 함께 평가해 4·4, 4·3, 3·3 공격과 예방 수비를 우선한다.
    this.scores[side][point] = openFours || fours >= 2 ? OPEN_FOUR + sum
      : fours && threes ? 500_000 + sum : threes >= 2 ? 100_000 + sum : sum;
  }

  refresh(point: number) {
    for (const entry of affected[point]) if (!this.board[entry.point]) {
      for (const side of [1, 2] as const) {
        this.updateLine(entry.point, side, entry.direction);
        this.updateScore(entry.point, side);
      }
    }
    if (!this.board[point]) for (const side of [1, 2] as const) {
      for (let direction = 0; direction < 4; direction++) this.updateLine(point, side, direction);
      this.updateScore(point, side);
    }
  }

  place(point: number, side: Seat) {
    this.legality.clear();
    this.board[point] = side; this.count++; this.toggleHash(point, side);
    for (const neighbor of neighbors[point]) this.near[neighbor]++;
    this.refresh(point);
  }

  remove(point: number, side: Seat) {
    this.legality.clear();
    this.board[point] = 0; this.count--; this.toggleHash(point, side);
    for (const neighbor of neighbors[point]) this.near[neighbor]--;
    this.refresh(point);
  }

  checkTime() {
    this.nodes++;
    if ((this.nodes & 63) === 0 && performance.now() >= this.deadline) throw STOP;
  }

  /** 금수가 될 수 있는 흑의 3 이상 모양만 엄밀히 판정하고 같은 국면의 공격·방어 평가에서 공유한다. */
  legal(point: number, side: Seat) {
    // 3·3와 4·4(같은 방향 포함)·장목은 모두 적어도 열린 3 이상의 패턴 점수를 갖는다.
    if (this.rule !== "renju" || side !== this.blackSeat || this.scores[side][point] < OPEN_THREE) return true;
    const key = point * 3 + side;
    let result = this.legality.get(key);
    if (result === undefined) { result = this.rules.evaluate(point, side); this.legality.set(key, result); }
    return result !== "FORBIDDEN" && result !== "OCCUPIED";
  }

  candidates(side: Seat, preferred = -1): { moves: Candidate[]; forced: boolean } {
    const all: Candidate[] = [], wins: Candidate[] = [], blocks: Candidate[] = [];
    const opponent = (3 - side) as Seat;
    for (const point of cells) if (!this.board[point] && this.near[point] > 0) {
      if (!this.legal(point, side)) continue;
      const attack = this.scores[side][point], defense = this.legal(point, opponent) ? this.scores[opponent][point] : 0;
      const x = point % STRIDE - 1, y = Math.floor(point / STRIDE) - 1;
      const order = Math.max(attack, defense * 1.08) + Math.min(attack, defense) * .15
        + this.history[side][point] + (point === preferred ? MATE : 0) - (Math.abs(x - 9.5) + Math.abs(y - 9.5)) * .01;
      const candidate = { point, attack, defense, order };
      all.push(candidate);
      if (attack >= FIVE) wins.push(candidate);
      if (defense >= FIVE) blocks.push(candidate);
    }
    // 근처가 모두 금수여도 멀리 있는 합법 수를 누락해 워커 오류로 처리하지 않는다.
    if (!all.length) for (const point of cells) if (!this.board[point] && this.legal(point, side))
      all.push({ point, attack: this.scores[side][point], defense: 0, order: 0 });
    const moves = wins.length ? wins : blocks.length ? blocks : all;
    moves.sort((a, b) => b.order - a.order || a.point - b.point);
    return { moves, forced: wins.length > 0 || blocks.length > 0 };
  }

  winningPoints(side: Seat) {
    const result: number[] = [];
    for (const point of cells) if (!this.board[point] && this.near[point] > 0 && this.scores[side][point] >= FIVE
      && this.legal(point, side)) result.push(point);
    return result;
  }

  evaluate(side: Seat) {
    const top = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], totals = [0, 0, 0];
    for (const point of cells) if (!this.board[point] && this.near[point] > 0) for (const player of [1, 2] as const) {
      if (!this.legal(point, player)) continue;
      const score = this.scores[player][point];
      if (score < FOUR) totals[player] += score;
      const best = top[player];
      if (score > best[0]) { best[2] = best[1]; best[1] = best[0]; best[0] = score; }
      else if (score > best[1]) { best[2] = best[1]; best[1] = score; }
      else if (score > best[2]) best[2] = score;
    }
    const value = (player: number) => top[player][0] + top[player][1] / 4 + top[player][2] / 8 + totals[player] / 16;
    return Math.trunc(Math.max(-MATE / 4, Math.min(MATE / 4, value(side) - value(3 - side) + 20)));
  }

  /** 닫힌 4를 연속으로 강제해 양방향 4나 4·4에 도달하는 수순만 증명한다. */
  forcingWin(side: Seat, remaining: number, deadline: number): number | null {
    this.checkTime();
    if (remaining <= 0 || performance.now() >= deadline) return null;
    const opponent = (3 - side) as Seat;
    const ownWins = this.winningPoints(side);
    if (ownWins.length) return ownWins[0];
    if (this.winningPoints(opponent).length) return null;
    const moves = this.candidates(side).moves.filter(move => move.attack >= FOUR).slice(0, 16);
    for (const move of moves) {
      if (performance.now() >= deadline) return null;
      let won = false;
      this.place(move.point, side);
      try {
        // 강제 응수 대신 상대가 먼저 5목을 완성할 수 있으면 해당 공격은 승리 증명이 아니다.
        if (this.winningPoints(opponent).length) continue;
        const wins = this.winningPoints(side);
        if (wins.length >= 2) won = true;
        else if (wins.length === 1) {
          // 흑이 유일한 방어 지점에 둘 수 없으면 금수 방어를 가정하지 않고 승리로 판정한다.
          if (!this.legal(wins[0], opponent)) won = true;
          else {
            this.place(wins[0], opponent);
            try { won = this.forcingWin(side, remaining - 2, deadline) !== null; }
            finally { this.remove(wins[0], opponent); }
          }
        }
      } finally { this.remove(move.point, side); }
      if (won) return move.point;
    }
    return null;
  }

  quiescence(side: Seat, alpha: number, beta: number, ply: number, remaining: number): number {
    this.checkTime();
    if (this.count === SIZE ** 2) return 0;
    const generated = this.candidates(side);
    if (generated.moves[0]?.attack >= FIVE) return MATE - ply;
    if (remaining <= 0) return this.evaluate(side);
    const stand = this.evaluate(side);
    if (!generated.forced) {
      if (stand >= beta) return stand;
      alpha = Math.max(alpha, stand);
    }
    const moves = generated.forced ? generated.moves : generated.moves.filter(move => move.attack >= FOUR).slice(0, 6);
    let best = generated.forced ? -MATE : stand;
    for (const move of moves) {
      this.place(move.point, side);
      let score: number;
      try { score = -this.quiescence((3 - side) as Seat, -beta, -alpha, ply + 1, remaining - 1); }
      finally { this.remove(move.point, side); }
      best = Math.max(best, score);
      alpha = Math.max(alpha, score);
      if (alpha >= beta) break;
    }
    return best;
  }

  negamax(side: Seat, depth: number, alpha: number, beta: number, ply: number): number {
    this.checkTime();
    if (this.count === SIZE ** 2) return 0;
    if (depth <= 0) return this.quiescence(side, alpha, beta, ply, this.settings.strength === 10 ? 8 : 4);
    const key = (this.hashLo ^ (side === 1 ? 0x691e34a7 : 0xd4127bc1)) >>> 0;
    const index = key & (TABLE_SIZE - 1);
    const hit = this.tableFlag[index] !== 0 && this.tableLo[index] === key && this.tableHi[index] === this.hashHi;
    if (hit && this.tableDepth[index] >= depth) {
      const stored = this.tableValue[index];
      const score = stored > MATE / 2 ? stored - ply : stored < -MATE / 2 ? stored + ply : stored;
      if (this.tableFlag[index] === 1) return score;
      if (this.tableFlag[index] === 2) alpha = Math.max(alpha, score);
      else beta = Math.min(beta, score);
      if (alpha >= beta) return score;
    }
    // 전이표가 좁힌 실제 창을 기준으로 저장해야 경계값을 정확한 평가로 오인하지 않는다.
    const originalAlpha = alpha, originalBeta = beta;
    const generated = this.candidates(side, hit ? this.tableMove[index] : -1);
    if (!generated.moves.length) return 0;
    if (generated.moves[0].attack >= FIVE) return MATE - ply;
    const width = Math.max(8, this.settings.width - Math.floor(ply / 2) * 3);
    const tacticalCount = generated.moves.filter(move => move.attack >= FOUR || move.defense >= FOUR).length;
    const moves = generated.forced ? generated.moves : generated.moves.slice(0, Math.max(width, tacticalCount));
    let best = -MATE, bestMove = moves[0].point;
    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      this.place(move.point, side);
      let score: number;
      try {
        // 첫 후보는 전체 창으로, 나머지는 좁은 창으로 확인한 뒤 필요한 수만 다시 탐색한다.
        score = i === 0 ? -this.negamax((3 - side) as Seat, depth - 1, -beta, -alpha, ply + 1)
          : -this.negamax((3 - side) as Seat, depth - 1, -alpha - 1, -alpha, ply + 1);
        if (i > 0 && score > alpha && score < beta) score = -this.negamax((3 - side) as Seat, depth - 1, -beta, -alpha, ply + 1);
      } finally { this.remove(move.point, side); }
      if (score > best) { best = score; bestMove = move.point; }
      alpha = Math.max(alpha, score);
      if (alpha >= beta) { this.history[side][move.point] = Math.min(20_000, this.history[side][move.point] + depth ** 2); break; }
    }
    this.tableLo[index] = key; this.tableHi[index] = this.hashHi;
    this.tableDepth[index] = depth; this.tableMove[index] = bestMove;
    this.tableValue[index] = best > MATE / 2 ? best + ply : best < -MATE / 2 ? best - ply : best;
    this.tableFlag[index] = best <= originalAlpha ? 3 : best >= originalBeta ? 2 : 1;
    return best;
  }
}

/** 난수를 섞어 일부러 실수하지 않는다. 노말과 하드는 탐색 폭·깊이·강제수 예산으로 강도를 구분한다. */
export function chooseAiMove(moves: readonly MatchMove[], difficulty: AiDifficulty, side: Seat = 2, limits: SearchLimits = {}): SearchResult | null {
  if (!isAiPosition(moves) || moves.length >= SIZE ** 2 || !Object.hasOwn(aiDifficulties, difficulty)) return null;
  const rule = limits.rule ?? "freestyle", blackSeat = limits.blackSeat ?? 1;
  if (moves.some(move => hasAiFive(moves, move, rule, blackSeat))) return null;
  const settings = aiDifficulties[difficulty];
  const started = performance.now();
  const timeMs = Math.min(settings.timeMs, Math.max(20, limits.timeMs ?? settings.timeMs));
  if (!moves.length) return { move: { x: 9, y: 9 }, depth: 0, nodes: 0 };
  const search = new Search(moves, difficulty, started, timeMs, rule, blackSeat);
  const generated = search.candidates(side);
  if (!generated.moves.length) return null;
  let best = generated.moves[0].point, completedDepth = 0;
  const pointResult = (): SearchResult => ({ move: { x: best % STRIDE - 1, y: Math.floor(best / STRIDE) - 1 }, depth: completedDepth, nodes: search.nodes });
  // 당장 이기거나 반드시 막아야 하는 수는 탐색 폭과 시간 제한에 관계없이 보장한다.
  if (generated.forced) return pointResult();
  // 렌주 흑의 열린 4는 끝의 장목·금수까지 따져야 하므로 패턴 점수만으로 승리를 확정하지 않는다.
  const fork = rule === "renju" && side === blackSeat ? undefined : generated.moves.find(move => move.attack >= OPEN_FOUR);
  if (fork) { best = fork.point; return pointResult(); }
  try {
    const proof = search.forcingWin(side, settings.forcingDepth, Math.min(search.deadline, started + timeMs * .25));
    if (proof !== null) { best = proof; return pointResult(); }
    let preferred = best;
    for (let depth = 1; depth <= Math.min(settings.maxDepth, limits.maxDepth ?? settings.maxDepth); depth++) {
      if (performance.now() >= search.deadline) break;
      const root = search.candidates(side, preferred).moves.slice(0, settings.width);
      let score = -MATE, iterationBest = root[0].point;
      for (const move of root) {
        search.place(move.point, side);
        let value: number;
        try { value = -search.negamax((3 - side) as Seat, depth - 1, -MATE, -score, 1); }
        finally { search.remove(move.point, side); }
        if (value > score) { score = value; iterationBest = move.point; }
      }
      // 시간 초과로 중단된 깊이의 불완전한 결과가 이전 완성 탐색을 덮지 않게 한다.
      best = iterationBest; preferred = best; completedDepth = depth;
      if (Math.abs(score) > MATE / 2) break;
    }
  } catch (error) { if (error !== STOP) throw error; }
  return pointResult();
}
