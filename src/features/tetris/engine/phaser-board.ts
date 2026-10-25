import Phaser from "phaser";
import { cells, COLORS, HEIGHT, HIDDEN, VISIBLE_HEIGHT, WIDTH } from "./rules";
import type { TetrisRuntime } from "./runtime";

const SIZE = 32;
// 격자·그리기 버퍼·캔버스가 규칙의 크기를 공유해 확대해도 셀을 정사각형으로 유지한다.
const BOARD_WIDTH = WIDTH * SIZE;
const BOARD_HEIGHT = VISIBLE_HEIGHT * SIZE;
export type TetrisBoard = {
  setDisplayWindow: (view: Window) => void;
  destroy: () => void;
};
/** 클라이언트에서만 불러오는 Phaser 4 렌더러다. 규칙·입력·개인 기록은 게임 엔진의 전역 상태에 넣지 않는다. */
export function createBoard(parent: HTMLElement, runtime: TetrisRuntime): TetrisBoard {
  const sourceWindow = window;
  let displayWindow: Window = parent.ownerDocument.defaultView ?? sourceWindow;
  let clockWindow: Window = sourceWindow;
  let frame: number | undefined;
  let previousTime: number | undefined;
  let disposed = false;

  // 같은 캔버스가 문서 사이를 이동해도 새 부모 크기에 맞게 정사각형 격자를 다시 맞춘다.
  const resize = () => {
    if (!game.isRunning || disposed) return;
    game.scale.getParentBounds();
    game.scale.refresh();
  };
  const drawPopupFrame = () => {
    if (disposed || clockWindow.closed || clockWindow === sourceWindow) return;
    // 두 창의 timeOrigin 차이는 원본의 단조 시계로 통일하고 예약만 실제 표시 창에서 수행한다.
    const now = sourceWindow.performance.now();
    const delta = previousTime === undefined ? 0 : Math.min(100, now - previousTime);
    previousTime = now;
    game.step(now, delta);
    frame = clockWindow.requestAnimationFrame(drawPopupFrame);
  };
  const applyDisplay = () => {
    if (disposed || !game.isRunning) return;
    if (frame !== undefined) clockWindow.cancelAnimationFrame(frame);
    frame = undefined;
    clockWindow.removeEventListener("resize", resize);
    clockWindow = displayWindow;
    clockWindow.addEventListener("resize", resize);
    previousTime = undefined;
    resize();
    if (clockWindow === sourceWindow) game.loop.wake();
    else {
      // 원본 탭이 숨겨져도 보이는 팝업은 계속 그린다. 두 RAF가 입력을 이중 처리하지 않게 기존 루프는 쉰다.
      game.loop.sleep();
      frame = clockWindow.requestAnimationFrame(drawPopupFrame);
    }
  };
  class BoardScene extends Phaser.Scene {
    private blocks!: Phaser.GameObjects.Graphics;
    private drawn = "";
    create() {
      const grid = this.add.graphics();
      // 표시는 논리 좌표를 유지하고 버퍼만 2배로 그려 큰 화면에서도 얇은 선을 선명하게 유지한다.
      grid.setScale(2);
      grid.fillStyle(0x09121d, 1).fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
      grid.lineStyle(1, 0x24374d, 0.65);
      for (let x = 0; x <= WIDTH; x++)
        grid.lineBetween(x * SIZE, 0, x * SIZE, BOARD_HEIGHT);
      for (let y = 0; y <= VISIBLE_HEIGHT; y++)
        grid.lineBetween(0, y * SIZE, BOARD_WIDTH, y * SIZE);
      this.blocks = this.add.graphics().setScale(2);
    }
    update(_time: number, delta: number) {
      runtime.update(delta);
      const game = runtime.game,
        key = `${game.revision}:${runtime.phase}:${runtime.ghost}`;
      if (!this.blocks || key === this.drawn) return;
      this.drawn = key;
      this.blocks.clear();
      for (let y = HIDDEN; y < HEIGHT; y++)
        for (let x = 0; x < WIDTH; x++) {
          const type = game.board[y * WIDTH + x];
          if (type) this.block(x, y - HIDDEN, type);
        }
      if (runtime.phase === "ready" || game.over) return;
      if (runtime.ghost)
        for (const [x, y] of cells(game.piece.type, game.piece.rotation))
          this.block(
            x + game.piece.x,
            y + game.ghostY() - HIDDEN,
            game.piece.type,
            true,
          );
      for (const [x, y] of cells(game.piece.type, game.piece.rotation))
        this.block(
          x + game.piece.x,
          y + game.piece.y - HIDDEN,
          game.piece.type,
        );
    }
    private block(x: number, y: number, type: number, ghost = false) {
      if (y < 0 || y >= VISIBLE_HEIGHT) return;
      const g = this.blocks,
        px = x * SIZE + 2,
        py = y * SIZE + 2,
        width = SIZE - 4,
        color = COLORS[type];
      if (ghost) {
        // 고스트도 같은 색을 반투명하게 채우고 밝은 점선을 둘러 실제 블록과 착지 위치를 구분한다.
        g.fillStyle(color, 0.32).fillRoundedRect(px, py, width, width, 1.5);
        g.lineStyle(1.25, color, 0.85);
        for (let offset = 0; offset < width; offset += 8) {
          const end = Math.min(offset + 4, width);
          g.lineBetween(px + offset, py, px + end, py);
          g.lineBetween(px + offset, py + width, px + end, py + width);
          g.lineBetween(px, py + offset, px, py + end);
          g.lineBetween(px + width, py + offset, px + width, py + end);
        }
      } else {
        // LIGHTLINE 팔레트는 유지하고 내부를 불투명하게 채워 낙하 중·쌓인 블록이 작은 화면에서도 잘 보이게 한다.
        g.fillStyle(color, 1).fillRoundedRect(px, py, width, width, 1.5);
        // 얇은 상단 하이라이트와 하단 음영으로 채워진 셀의 경계를 구분한다.
        g.fillStyle(0xffffff, 0.2).fillRect(px + 1.5, py + 1.5, width - 3, 3);
        g.fillStyle(0x000000, 0.14).fillRect(px + 1.5, py + width - 4.5, width - 3, 3);
        g.lineStyle(1, 0xffffff, 0.4).strokeRect(
          px + 1.5,
          py + 1.5,
          width - 3,
          width - 3,
        );
      }
    }
  }
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: BOARD_WIDTH * 2,
    height: BOARD_HEIGHT * 2,
    backgroundColor: "#09121d",
    banner: false,
    autoFocus: false,
    audio: { noAudio: true },
    input: { keyboard: false, mouse: false, touch: false },
    fps: { target: 60 },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    callbacks: {
      // postBoot 뒤 Phaser가 기본 루프를 시작하므로 같은 작업의 마지막에서 표시 창으로 시계를 인계한다.
      postBoot: () => queueMicrotask(() => {
        if (disposed) game.step(sourceWindow.performance.now(), 0);
        else applyDisplay();
      }),
    },
    scene: BoardScene,
  });
  const observer = new ResizeObserver(resize);
  observer.observe(parent);
  return {
    setDisplayWindow(view) {
      displayWindow = view;
      applyDisplay();
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      if (frame !== undefined) clockWindow.cancelAnimationFrame(frame);
      clockWindow.removeEventListener("resize", resize);
      observer.disconnect();
      game.destroy(true);
      // 잠든 원본 창의 다음 프레임을 기다리지 않고 활성 엔진의 파괴 요청을 처리한다.
      if (game.isRunning) game.step(sourceWindow.performance.now(), 0);
    },
  };
}
