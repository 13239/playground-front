/** 렌더러와 독립된 60Hz 정수 규칙이다. 서버의 TetrisReplay와 같은 버전·난수·명령 순서를 사용한다. */
export const RULE_VERSION = 3;
// 보이는 15×25칸과 생성용 숨김 행을 분리해 렌더러와 서버가 같은 크기를 사용한다.
export const WIDTH = 15;
export const VISIBLE_HEIGHT = 25;
export const HIDDEN = 2;
export const HEIGHT = VISIBLE_HEIGHT + HIDDEN;
const SPAWN_X = Math.floor(WIDTH / 2) - 2;
export const MAX_TICKS = 216_000;
export const MAX_INPUTS = 24_000;
export const ACTIONS = [
  "LEFT",
  "RIGHT",
  "DOWN",
  "CW",
  "CCW",
  "DROP",
  "HOLD",
] as const;
export type Action = (typeof ACTIONS)[number];
export type ReplayInput = [number, number];
export type Piece = { type: number; rotation: number; x: number; y: number };
export type Phase = "ready" | "playing" | "paused" | "over";
export const COLORS = [
  0, 0x64e7ff, 0xffd96e, 0xc287ff, 0x73a8ff, 0xffad65, 0x70efb3, 0xff809d,
];
const SHAPES = [
  [],
  ["0000", "1111", "0000", "0000"],
  ["0110", "0110", "0000", "0000"],
  ["010", "111", "000"],
  ["100", "111", "000"],
  ["001", "111", "000"],
  ["011", "110", "000"],
  ["110", "011", "000"],
];
// SRS 표의 위쪽 양수 좌표는 cells에서 쓰는 화면 좌표로 변환한다.
const KICKS: Record<string, number[][]> = {
  "01": [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
  "10": [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
  "12": [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
  "21": [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
  "23": [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ],
  "32": [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ],
  "30": [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ],
  "03": [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ],
};
const I_KICKS: Record<string, number[][]> = {
  "01": [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, -1],
    [1, 2],
  ],
  "10": [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, 1],
    [-1, -2],
  ],
  "12": [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, 2],
    [2, -1],
  ],
  "21": [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, -2],
    [-2, 1],
  ],
  "23": [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, 1],
    [-1, -2],
  ],
  "32": [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, -1],
    [1, 2],
  ],
  "30": [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, -2],
    [-2, 1],
  ],
  "03": [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, 2],
    [2, -1],
  ],
};

/** 회전 원점을 유지한 셀 좌표를 화면과 규칙 양쪽에서 재사용한다. O 블록은 제자리 회전한다. */
export function cells(type: number, rotation = 0): number[][] {
  const shape = SHAPES[type];
  const result: number[][] = [];
  shape?.forEach((row, y) =>
    [...row].forEach((value, x) => {
      if (value !== "1") return;
      let a = x,
        b = y;
      for (let r = 0; r < (type === 2 ? 0 : rotation); r++)
        [a, b] = [shape.length - 1 - b, a];
      result.push([a, b]);
    }),
  );
  return result;
}

export class TetrisRules {
  board = Array<number>(WIDTH * HEIGHT).fill(0);
  piece: Piece = { type: 1, rotation: 0, x: SPAWN_X, y: 1 };
  queue: number[] = [];
  hold = 0;
  holdUsed = false;
  score = 0;
  lines = 0;
  ticks = 0;
  over = false;
  revision = 0;
  lastClear = 0;
  clearSerial = 0;
  private random: number;
  private gravity = 0;
  private grounded = 0;
  private resets = 0;

  constructor(seed: number) {
    this.random = seed >>> 0 || 1;
    this.fillQueue();
    this.spawn();
  }
  get level() {
    return Math.floor(this.lines / 10) + 1;
  }
  private nextRandom() {
    // xorshift32와 unsigned 나머지는 Java의 Integer.toUnsignedLong과 일치한다.
    let value = this.random;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.random = value >>> 0;
    return this.random;
  }
  private fillQueue() {
    while (this.queue.length < 6) {
      const bag = [1, 2, 3, 4, 5, 6, 7];
      for (let i = 6; i > 0; i--) {
        const j = this.nextRandom() % (i + 1);
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      this.queue.push(...bag);
    }
  }
  fits(piece: Piece) {
    return cells(piece.type, piece.rotation).every(([x, y]) => {
      x += piece.x;
      y += piece.y;
      return (
        x >= 0 &&
        x < WIDTH &&
        y >= 0 &&
        y < HEIGHT &&
        !this.board[y * WIDTH + x]
      );
    });
  }
  ghostY() {
    let y = this.piece.y;
    while (this.fits({ ...this.piece, y: y + 1 })) y++;
    return y;
  }
  private spawn(type?: number) {
    // 숨김 행 한 줄 아래, 넓어진 판의 중앙에서 생성해 첫 프레임부터 블록 일부를 보여 준다.
    this.piece = { type: type ?? this.queue.shift()!, rotation: 0, x: SPAWN_X, y: 1 };
    this.fillQueue();
    this.gravity = 0;
    this.grounded = 0;
    this.resets = 0;
    if (!this.fits(this.piece)) this.over = true;
    this.revision++;
  }
  private resetLock(wasGrounded: boolean) {
    if (wasGrounded && this.resets < 15) {
      this.grounded = 0;
      this.resets++;
    }
  }
  private move(dx: number, dy: number) {
    const next = { ...this.piece, x: this.piece.x + dx, y: this.piece.y + dy };
    if (!this.fits(next)) return false;
    const wasGrounded = !this.fits({ ...this.piece, y: this.piece.y + 1 });
    this.piece = next;
    if (dx) this.resetLock(wasGrounded);
    this.revision++;
    return true;
  }
  private rotate(direction: number) {
    const rotation = (this.piece.rotation + direction + 4) % 4;
    const kicks =
      this.piece.type === 2
        ? [[0, 0]]
        : (this.piece.type === 1 ? I_KICKS : KICKS)[
            `${this.piece.rotation}${rotation}`
          ];
    const wasGrounded = !this.fits({ ...this.piece, y: this.piece.y + 1 });
    for (const [x, y] of kicks) {
      const next = {
        ...this.piece,
        rotation,
        x: this.piece.x + x,
        y: this.piece.y - y,
      };
      if (this.fits(next)) {
        this.piece = next;
        this.resetLock(wasGrounded);
        this.revision++;
        return;
      }
    }
  }
  private lock() {
    for (const [x, y] of cells(this.piece.type, this.piece.rotation))
      this.board[(y + this.piece.y) * WIDTH + x + this.piece.x] =
        this.piece.type;
    const rows: number[][] = [];
    for (let y = 0; y < HEIGHT; y++) {
      const row = this.board.slice(y * WIDTH, (y + 1) * WIDTH);
      if (row.some((value) => !value)) rows.push(row);
    }
    const cleared = HEIGHT - rows.length;
    this.lastClear = cleared;
    if (cleared) {
      this.score += [0, 100, 300, 500, 800][cleared] * this.level;
      this.lines += cleared;
      this.clearSerial++;
      while (rows.length < HEIGHT) rows.unshift(Array<number>(WIDTH).fill(0));
      this.board = rows.flat();
    }
    this.holdUsed = false;
    this.spawn();
  }
  /** 한 tick의 입력을 먼저 순서대로 처리하고 중력·고정을 한 번 계산한다. 물리 시간은 FPS와 독립적이다. */
  step(actions: readonly Action[] = []) {
    if (this.over) return;
    this.ticks++;
    for (const action of actions) {
      if (this.over) break;
      switch (action) {
        case "LEFT":
          this.move(-1, 0);
          break;
        case "RIGHT":
          this.move(1, 0);
          break;
        case "DOWN":
          if (this.move(0, 1)) this.score++;
          break;
        case "CW":
          this.rotate(1);
          break;
        case "CCW":
          this.rotate(-1);
          break;
        case "DROP": {
          const y = this.ghostY();
          this.score += (y - this.piece.y) * 2;
          this.piece.y = y;
          this.lock();
          break;
        }
        case "HOLD":
          if (!this.holdUsed) {
            const old = this.hold;
            this.hold = this.piece.type;
            this.spawn(old || undefined);
            this.holdUsed = true;
          }
          break;
      }
    }
    if (this.over) return;
    this.gravity++;
    if (this.gravity >= Math.max(3, 48 - (this.level - 1) * 4)) {
      this.move(0, 1);
      this.gravity = 0;
    }
    if (!this.fits({ ...this.piece, y: this.piece.y + 1 })) {
      if (++this.grounded >= 30) this.lock();
    } else this.grounded = 0;
    if (this.ticks >= MAX_TICKS) this.over = true;
  }
}
