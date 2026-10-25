import Phaser from "phaser";
import { cells, COLORS, HIDDEN, WIDTH } from "./rules";
import type { TetrisRuntime } from "./runtime";

const SIZE = 32;
/** 클라이언트에서만 불러오는 Phaser 4 렌더러다. 규칙·입력·개인 기록은 게임 엔진의 전역 상태에 넣지 않는다. */
export function createBoard(parent: HTMLElement, runtime: TetrisRuntime) {
  class BoardScene extends Phaser.Scene {
    private blocks!: Phaser.GameObjects.Graphics;
    private drawn = "";
    create() {
      const grid = this.add.graphics();
      // 표시는 논리 좌표를 유지하고 버퍼만 2배로 그려 큰 화면에서도 얇은 선을 선명하게 유지한다.
      grid.setScale(2);
      grid.fillStyle(0x09121d, 1).fillRect(0, 0, 320, 640);
      grid.lineStyle(1, 0x24374d, 0.65);
      for (let x = 0; x <= WIDTH; x++)
        grid.lineBetween(x * SIZE, 0, x * SIZE, 640);
      for (let y = 0; y <= 20; y++)
        grid.lineBetween(0, y * SIZE, 320, y * SIZE);
      this.blocks = this.add.graphics().setScale(2);
    }
    update(_time: number, delta: number) {
      runtime.update(delta);
      const game = runtime.game,
        key = `${game.revision}:${runtime.phase}:${runtime.ghost}`;
      if (!this.blocks || key === this.drawn) return;
      this.drawn = key;
      this.blocks.clear();
      for (let y = HIDDEN; y < 22; y++)
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
      if (y < 0 || y >= 20) return;
      const g = this.blocks,
        px = x * SIZE + 2,
        py = y * SIZE + 2,
        width = SIZE - 4,
        color = COLORS[type];
      if (ghost) {
        // 고스트는 발광·채움 없이 어두운 점선으로만 표시해 현재 블록과 구분한다.
        g.lineStyle(1, color, 0.32);
        for (let offset = 0; offset < width; offset += 8) {
          const end = Math.min(offset + 4, width);
          g.lineBetween(px + offset, py, px + end, py);
          g.lineBetween(px + offset, py + width, px + end, py + width);
          g.lineBetween(px, py + offset, px, py + end);
          g.lineBetween(px + width, py + offset, px + width, py + end);
        }
      } else {
        // LIGHTLINE 시안의 어두운 내부와 가장자리 가까운 얇은 발광을 겹친 선으로 재현한다.
        g.fillStyle(color, 0.055).fillRoundedRect(px, py, width, width, 1.5);
        g.lineStyle(7, color, 0.055).strokeRect(px, py, width, width);
        g.lineStyle(4, color, 0.13).strokeRect(px, py, width, width);
        g.lineStyle(1.6, color, 1).strokeRect(px, py, width, width);
        g.lineStyle(0.6, 0xffffff, 0.6).strokeRect(
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
    width: 640,
    height: 1280,
    backgroundColor: "#09121d",
    banner: false,
    audio: { noAudio: true },
    input: { keyboard: false, mouse: false, touch: false },
    fps: { target: 60 },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: BoardScene,
  });
  return () => game.destroy(true);
}
