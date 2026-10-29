import Phaser from "phaser";
import {
  WORLD,
  type GameSnapshot,
  type PlayerView,
} from "@playground/shooting-shared";
import type { ShootingRuntime } from "../client/runtime";
import { drawEnemy } from "./enemy-art";
import {
  drawEffect,
  drawEnemyWarning,
  drawHazard,
  drawShield,
} from "./combat-effects";

/** 전투는 고정 월드 좌표를 사용하고 화면의 가로·세로 비율만 카메라에 반영한다. DOM에는 매 프레임 상태를 전달하지 않는다. */
export function createArena(
  host: HTMLElement,
  runtime: ShootingRuntime,
): { destroy(): void } {
  let observer: ResizeObserver | undefined;
  class Arena extends Phaser.Scene {
    private floor!: Phaser.GameObjects.Graphics;
    private props!: Phaser.GameObjects.Graphics;
    private actors!: Phaser.GameObjects.Graphics;
    private overlays!: Phaser.GameObjects.Graphics;
    private labels = new Map<string, Phaser.GameObjects.Text>();
    private positions = new Map<string, { x: number; y: number }>();
    private stage = -1;
    private elapsed = 0;
    private aimX = WORLD.width / 2;
    private aimY = WORLD.height / 2;
    private mouseAiming = false;
    create(): void {
      this.cameras.main.setBackgroundColor("#090f18");
      this.floor = this.add.graphics();
      this.props = this.add.graphics();
      this.actors = this.add.graphics();
      this.overlays = this.add.graphics();
      this.buildFloor();
      const aim = (pointer: Phaser.Input.Pointer) => {
        if (pointer.wasTouch) return;
        this.mouseAiming = true;
        const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        this.aimX = point.x;
        this.aimY = point.y;
        const player = runtime.position;
        if (player)
          runtime.setAim(Math.atan2(point.y - player.y, point.x - player.x));
      };
      this.input.on("pointermove", aim);
      this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        if (!pointer.wasTouch && pointer.leftButtonDown()) {
          host.focus({ preventScroll: true });
          aim(pointer);
          runtime.setAim(runtime.aim, true);
        }
      });
      this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
        if (!pointer.wasTouch) runtime.setAim(runtime.aim, false);
      });
      this.input.mouse?.disableContextMenu();
      observer = new ResizeObserver(() => {
        if (host.clientWidth > 0 && host.clientHeight > 0)
          this.scale.resize(host.clientWidth, host.clientHeight);
      });
      observer.observe(host);
    }
    private buildFloor(): void {
      const g = this.floor;
      g.fillStyle(0x141d28).fillRect(0, 0, WORLD.width, WORLD.height);
      for (let y = 40; y < WORLD.height - 40; y += 80)
        for (let x = 40; x < WORLD.width - 40; x += 80) {
          const alternate = (x / 80 + y / 80) % 2;
          g.fillStyle(alternate ? 0x1b2632 : 0x1d2936).fillRect(
            x + 1,
            y + 1,
            78,
            78,
          );
          g.lineStyle(1, 0x344252, 0.25).strokeRect(x + 3, y + 3, 74, 74);
          g.fillStyle(0x485565, 0.5)
            .fillCircle(x + 8, y + 8, 1.5)
            .fillCircle(x + 72, y + 72, 1.5);
        }
      g.lineStyle(3, 0x7bc7df, 0.2).strokeRect(
        42,
        42,
        WORLD.width - 84,
        WORLD.height - 84,
      );
      // 출입구와 안전선은 장식이며 실제 충돌은 공유 월드 경계·엄폐물만 사용한다.
      for (const x of [180, 680, 1180]) {
        g.fillStyle(0x0d141e).fillRect(x, 0, 240, 36).fillRect(x, 924, 240, 36);
        for (let i = 0; i < 12; i++)
          g.fillStyle(i % 2 ? 0xa18a48 : 0x2d3032, 0.7)
            .fillRect(x + i * 20, 32, 18, 6)
            .fillRect(x + i * 20, 922, 18, 6);
      }
      // 중앙 바닥 장식도 얇은 십자선으로 정리해 전투 효과와 혼동하지 않게 한다.
      g.lineStyle(2, 0x80c3cf, 0.1)
        .lineBetween(765, 480, 835, 480)
        .lineBetween(800, 445, 800, 515);
    }
    private buildProps(state: GameSnapshot): void {
      const g = this.props.clear();
      for (const wall of state.walls) {
        const { x, y, width: w, height: h } = wall;
        g.fillStyle(0x060b11, 0.6).fillRoundedRect(x + 7, y + 10, w, h, 5);
        g.fillStyle(0x3d4a58).fillRoundedRect(x, y, w, h, 5);
        g.fillStyle(0x283440).fillRect(x + 5, y + 8, w - 10, h - 13);
        g.lineStyle(2, 0x6b7c89).lineBetween(x + 7, y + 4, x + w - 7, y + 4);
        g.lineStyle(1, 0x16202b).strokeRect(x + 12, y + 16, w - 24, h - 30);
        for (let offset = 16; offset < w - 15; offset += 18)
          g.fillStyle(0xc9a456, 0.65).fillRect(x + offset, y + h - 10, 9, 4);
      }
    }
    update(_time: number, delta: number): void {
      const state = runtime.snapshot;
      this.elapsed += delta / 1000;
      const camera = this.cameras.main;
      // 세로 모바일에서는 캐릭터를 과도하게 축소하지 않고 카메라가 이동을 따라간다. 판정 좌표·이동 속도는 동일하다.
      const fit = Math.min(
        this.scale.width / WORLD.width,
        this.scale.height / WORLD.height,
      );
      const portrait =
        this.scale.width < 650 && this.scale.height > this.scale.width;
      const zoom = portrait ? Math.max(fit, this.scale.width / 720) : fit;
      const position = runtime.position;
      const halfWidth = this.scale.width / zoom / 2;
      camera
        .setZoom(zoom)
        .centerOn(
          portrait && position
            ? Phaser.Math.Clamp(position.x, halfWidth, WORLD.width - halfWidth)
            : WORLD.width / 2,
          WORLD.height / 2,
        );
      if (!state) return;
      if (
        this.mouseAiming &&
        !matchMedia("(pointer: coarse)").matches &&
        runtime.position &&
        !state.paused
      ) {
        // 이동 중 마우스가 정지해 있어도 현재 조준점을 계속 바라보게 한다.
        const pointer = this.input.activePointer;
        const point = camera.getWorldPoint(pointer.x, pointer.y);
        this.aimX = point.x;
        this.aimY = point.y;
        runtime.setAim(
          Math.atan2(
            point.y - runtime.position.y,
            point.x - runtime.position.x,
          ),
        );
      }
      if (state.stage !== this.stage) {
        this.stage = state.stage;
        this.buildProps(state);
        this.positions.clear();
      }
      const g = this.actors.clear(),
        fx = this.overlays.clear();
      const seen = new Set<string>();
      for (const hazard of Object.values(state.hazards))
        drawHazard(g, hazard, this.elapsed);
      for (const pickup of Object.values(state.pickups)) {
        const colors = {
          xp: 0x6aafff,
          heal: 0x5ce8a5,
          revive: 0xf7cc6a,
          invul: 0xb38aff,
        };
        const color = colors[pickup.kind],
          x = pickup.x,
          y = pickup.y;
        g.fillStyle(color, 0.1).fillCircle(x, y, pickup.kind === "xp" ? 9 : 20);
        if (pickup.kind === "xp") {
          g.fillStyle(color).fillTriangle(x, y - 5, x + 4, y + 3, x - 4, y + 3);
          continue;
        }
        g.fillStyle(0x0b1720).fillRoundedRect(x - 11, y - 11, 22, 22, 5);
        g.lineStyle(1.5, color).strokeRoundedRect(x - 11, y - 11, 22, 22, 5);
        if (pickup.kind === "heal")
          g.fillStyle(color)
            .fillRect(x - 2, y - 6, 4, 12)
            .fillRect(x - 6, y - 2, 12, 4);
        else if (pickup.kind === "revive")
          g.lineStyle(2, color)
            .strokeCircle(x, y, 5)
            .lineBetween(x, y - 8, x, y + 8)
            .lineBetween(x - 8, y, x + 8, y);
        else
          g.lineStyle(2, color).strokeTriangle(
            x,
            y - 7,
            x + 7,
            y + 5,
            x - 7,
            y + 5,
          );
      }
      for (const enemy of Object.values(state.enemies)) {
        const position = this.smooth(enemy.id, enemy.x, enemy.y, delta, seen),
          { x, y } = position,
          r = enemy.radius;
        if (enemy.spawnRemaining > 0) {
          // 생성 예고는 바닥 모서리 표식으로 통일하고 원형 테두리를 쌓지 않는다.
          g.lineStyle(2, 0xff887c, 0.65).strokeRect(
            x - r - 6,
            y - r - 6,
            (r + 6) * 2,
            (r + 6) * 2,
          );
          g.lineBetween(x - 7, y - 7, x + 7, y + 7).lineBetween(
            x + 7,
            y - 7,
            x - 7,
            y + 7,
          );
          continue;
        }
        drawEnemyWarning(g, enemy, x, y);
        drawEnemy(g, enemy, x, y, this.elapsed);
        if (enemy.hp < enemy.maxHp && !enemy.boss) {
          g.fillStyle(0x090e16).fillRect(x - r, y - r - 9, r * 2, 3);
          g.fillStyle(0xf08079).fillRect(
            x - r,
            y - r - 9,
            (r * 2 * enemy.hp) / enemy.maxHp,
            3,
          );
        }
      }
      for (const bullet of Object.values(state.bullets)) {
        const color = bullet.hostile
          ? 0xff7772
          : bullet.weapon === "launcher"
            ? 0xfacb76
            : 0xa4eaff;
        const length = bullet.hostile ? 0.008 : 0.012;
        g.lineStyle(bullet.radius * 5, color, 0.1).lineBetween(
          bullet.x,
          bullet.y,
          bullet.x - bullet.vx * length,
          bullet.y - bullet.vy * length,
        );
        g.lineStyle(Math.max(2, bullet.radius * 1.6), color).lineBetween(
          bullet.x,
          bullet.y,
          bullet.x - bullet.vx * length,
          bullet.y - bullet.vy * length,
        );
      }
      for (const player of Object.values(state.players)) {
        if (player.departed) continue;
        const own = player.id === runtime.playerId;
        const target = own ? (runtime.position ?? player) : player;
        const { x, y } = this.smooth(
          player.id,
          target.x,
          target.y,
          delta,
          seen,
        );
        this.drawPlayer(g, player, x, y, own ? runtime.aim : player.aim, own);
        let label = this.labels.get(player.id);
        if (!label) {
          label = this.add
            .text(x, y - 38, "", {
              fontFamily: "system-ui, sans-serif",
              fontSize: "13px",
              color: "#d5e4f0",
              backgroundColor: "#101a26cc",
              padding: { x: 5, y: 3 },
            })
            .setOrigin(0.5);
          this.labels.set(player.id, label);
        }
        label
          .setPosition(x, y - 40)
          .setText(
            // 내 표식은 닉네임·상태 문구 없이 '나'만 표시하고 구조 상태는 HUD에서 안내한다.
            own
              ? "나"
              : `${player.nickname}${!player.alive ? " · 구조 대기" : ""}`,
          )
          .setVisible(!player.departed);
      }
      for (const [id, label] of this.labels)
        if (!state.players[id] || state.players[id].departed) {
          label.destroy();
          this.labels.delete(id);
        }
      // 처치·폭발·회복·부활·무적·클리어는 의미별 전용 모션을 사용한다.
      for (const effect of Object.values(state.effects)) drawEffect(fx, effect);
      if (
        matchMedia("(pointer: fine)").matches &&
        state.phase === "combat" &&
        !state.paused
      ) {
        fx.lineStyle(1.5, 0xc1edff, 0.9)
          .strokeCircle(this.aimX, this.aimY, 7)
          .lineBetween(this.aimX - 12, this.aimY, this.aimX - 5, this.aimY)
          .lineBetween(this.aimX + 5, this.aimY, this.aimX + 12, this.aimY)
          .lineBetween(this.aimX, this.aimY - 12, this.aimX, this.aimY - 5)
          .lineBetween(this.aimX, this.aimY + 5, this.aimX, this.aimY + 12);
      }
      for (const id of this.positions.keys())
        if (!seen.has(id)) this.positions.delete(id);
    }
    private smooth(
      id: string,
      x: number,
      y: number,
      delta: number,
      seen: Set<string>,
    ): { x: number; y: number } {
      seen.add(id);
      const previous = this.positions.get(id);
      const factor = Math.min(1, delta / 40);
      const position =
        previous && Math.hypot(previous.x - x, previous.y - y) < 180
          ? {
              x: previous.x + (x - previous.x) * factor,
              y: previous.y + (y - previous.y) * factor,
            }
          : { x, y };
      this.positions.set(id, position);
      return position;
    }
    private drawPlayer(
      g: Phaser.GameObjects.Graphics,
      player: PlayerView,
      x: number,
      y: number,
      angle: number,
      own: boolean,
    ): void {
      const color = own ? 0x66c7fa : 0x69e3b5;
      if (!player.alive) {
        g.lineStyle(3, 0xfac679, 0.8)
          .strokeRoundedRect(x - 17, y - 17, 34, 34, 4)
          .lineBetween(x - 7, y - 7, x + 7, y + 7)
          .lineBetween(x + 7, y - 7, x - 7, y + 7);
        return;
      }
      g.fillStyle(0x03070c, 0.5).fillEllipse(x + 2, y + 17, 48, 20);
      // 보호 상태는 육각 장갑, 일반 캐릭터는 실루엣만 보여 중첩 원을 줄인다.
      if (player.protection > 0)
        drawShield(g, x, y, 29, 0.65 + Math.sin(this.elapsed * 7) * 0.1);
      if (player.dashRemaining > 0) {
        g.lineStyle(5, color, 0.35).lineBetween(
          x - player.vx * 0.04,
          y - player.vy * 0.04,
          x,
          y,
        );
      }
      g.fillStyle(0x1b3448).fillRoundedRect(x - 16, y - 18, 32, 34, 8);
      g.fillStyle(color).fillRoundedRect(x - 13, y - 17, 26, 26, 7);
      g.fillStyle(0x203d50).fillRoundedRect(x - 10, y - 12, 20, 12, 4);
      g.fillStyle(0xd0f5ff).fillRect(x - 6, y - 8, 12, 3);
      g.fillStyle(0x89a7b9)
        .fillRoundedRect(x - 20, y - 5, 8, 16, 3)
        .fillRoundedRect(x + 12, y - 5, 8, 16, 3);
      const length =
        player.weapon === "sniper"
          ? 39
          : player.weapon === "launcher"
            ? 29
            : 30;
      g.lineStyle(
        player.weapon === "launcher" ? 12 : player.weapon === "shotgun" ? 9 : 7,
        0x0a131c,
      ).lineBetween(
        x,
        y + 2,
        x + Math.cos(angle) * length,
        y + Math.sin(angle) * length,
      );
      g.lineStyle(3, 0x809aaa).lineBetween(
        x + Math.cos(angle) * 15,
        y + Math.sin(angle) * 15,
        x + Math.cos(angle) * length,
        y + Math.sin(angle) * length,
      );
      g.fillStyle(0x090e16).fillRect(x - 20, y + 29, 40, 4);
      g.fillStyle(color).fillRect(
        x - 20,
        y + 29,
        (40 * player.hp) / player.maxHp,
        4,
      );
    }
  }
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: host,
    width: Math.max(1, host.clientWidth),
    height: Math.max(1, host.clientHeight),
    backgroundColor: "#090f18",
    transparent: false,
    antialias: true,
    powerPreference: "high-performance",
    audio: { noAudio: true },
    fps: { target: 60, forceSetTimeOut: false },
    input: { activePointers: 4, keyboard: false, touch: { capture: false } },
    scene: Arena,
    banner: false,
  });
  return {
    destroy() {
      observer?.disconnect();
      game.destroy(true);
    },
  };
}
