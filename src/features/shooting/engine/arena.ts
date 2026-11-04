import Phaser from "phaser";
import {
  WORLD,
  STAGE_MAPS,
  STAGE_PALETTES,
  SHOOTING_CHARACTERS,
  encounterFor,
  formatShieldTime,
  type GameSnapshot,
  type PlayerView,
} from "@playground/shooting-shared";
import type { ShootingRuntime } from "../client/runtime";
import { SpriteArt } from "./sprite-art";
import { drawPickup } from "./pickup-art";
import { drawWeapon } from "./weapon-art";
import { drawActiveShield, drawHostileProjectile, drawSupportDrone } from "./combat-visuals";
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
    private gear!: Phaser.GameObjects.Graphics;
    private danger!: Phaser.GameObjects.Graphics;
    private shields!: Phaser.GameObjects.Graphics;
    private readonly reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    private art!: SpriteArt;
    private wallCount = -1;
    private labels = new Map<string, Phaser.GameObjects.Text>();
    private protectionLabel!: Phaser.GameObjects.Text;
    private positions = new Map<string, { x: number; y: number }>();
    private stage = -1;
    private elapsed = 0;
    private aimX = WORLD.width / 2;
    private aimY = WORLD.height / 2;
    private mouseAiming = false;
    preload(): void {
      SpriteArt.preload(this, runtime.snapshot?.mapId ?? "CAVE");
    }
    create(): void {
      // 네이티브 커서의 핫스폿과 월드 조준점은 같은 중심을 사용하며 렌더 지연을 추가하지 않는다.
      this.input.setDefaultCursor('url("/images/shooting/aim-cursor.svg") 16 16, crosshair');
      // 월드 비율을 유지하며 생기는 여백도 파스텔 셸과 같은 계열로 채운다.
      this.cameras.main.setBackgroundColor("#e7e0f2");
      this.floor = this.add.graphics();
      this.props = this.add.graphics();
      this.actors = this.add.graphics();
      this.overlays = this.add.graphics();
      this.gear = this.add.graphics().setDepth(20);
      this.overlays.setDepth(30);
      // 공격·실드를 캐릭터 스프라이트보다 위에 두어 큰 원화나 지형에 가려지지 않게 한다.
      this.danger = this.add.graphics().setDepth(25);
      this.shields = this.add.graphics().setDepth(40);
      this.art = new SpriteArt(this);
      this.art.prepare(runtime.snapshot?.mapId ?? "CAVE");
      // 보호 시간 표시는 한 번 만든 텍스트를 재사용하고 캐릭터 주변에 0.1초 단위로 갱신한다.
      this.protectionLabel = this.add
        .text(0, 0, "", {
          fontFamily: "ui-monospace, monospace",
          fontSize: "18px",
          fontStyle: "bold",
          color: "#d9fdff",
          backgroundColor: "#112d4aee",
          stroke: "#150c29",
          strokeThickness: 3,
          padding: { x: 7, y: 4 },
        })
        .setOrigin(0.5)
        .setDepth(42)
        .setVisible(false);
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
      const map = runtime.snapshot?.mapId ?? "CAVE";
      const palette = STAGE_PALETTES[map];
      const floor = palette.floor;
      g.clear();
      // 출입구와 안전선은 장식이며 실제 충돌은 공유 월드 경계·엄폐물만 사용한다.
      // 맵별 바닥의 색·줄눈·장식은 달라도 실제 벽과 플레이어 좌표는 공유 월드에 맞춘다.
      g.fillStyle(floor).fillRect(0, 0, WORLD.width, WORLD.height);
      for (let y = 40; y < WORLD.height - 40; y += 80)
        for (let x = 40; x < WORLD.width - 40; x += 80) {
          g.fillStyle(
            0xffffff,
            (x / 80 + y / 80) % 2 ? 0.035 : 0.075,
          ).fillRoundedRect(x + 2, y + 2, 76, 76, map === "FACTORY" ? 3 : 12);
          g.lineStyle(1.5, 0x42325e, 0.14).strokeRoundedRect(
            x + 2,
            y + 2,
            76,
            76,
            map === "FACTORY" ? 3 : 12,
          );
        }
      g.lineStyle(10, palette.edge).strokeRect(
        35,
        35,
        WORLD.width - 70,
        WORLD.height - 70,
      );
      // 중앙 바닥 장식도 얇은 십자선으로 정리해 전투 효과와 혼동하지 않게 한다.
      g.lineStyle(2, 0xe1d3f2, 0.15)
        .lineBetween(765, 480, 835, 480)
        .lineBetween(800, 445, 800, 515);
    }
    private buildProps(state: GameSnapshot): void {
      const g = this.props.clear();
      for (const wall of state.walls) {
        const { x, y, width: w, height: h } = wall;
        // 새 맵 재질만 한 번 그려 이전 금속 레이어를 중복 렌더링하지 않는다.
        const factory = state.mapId === "FACTORY";
        const { edge: border, wall: top } = STAGE_PALETTES[state.mapId];
        g.fillStyle(border, 0.4).fillRoundedRect(x + 5, y + 9, w, h, 16);
        g.fillStyle(top).fillRoundedRect(x, y, w, h, factory ? 7 : 17);
        g.lineStyle(3, border).strokeRoundedRect(x, y, w, h, factory ? 7 : 17);
        g.lineStyle(2, 0xffffff, 0.3).lineBetween(
          x + 12,
          y + 7,
          x + w - 12,
          y + 7,
        );
        if (state.mapId === "GARDEN")
          for (let leaf = x + 12; leaf < x + w; leaf += 35)
            g.fillStyle(0x658f68).fillEllipse(leaf, y + 8, 30, 17);
      }
    }
    update(_time: number, delta: number): void {
      const state = runtime.snapshot;
      this.elapsed += delta / 1000;
      const camera = this.cameras.main;
      // 작은 화면에서는 캐릭터를 과도하게 축소하지 않고 카메라가 가로·세로 이동을 따라간다. 판정 좌표·이동 속도는 동일하다.
      const fit = Math.min(
        this.scale.width / WORLD.width,
        this.scale.height / WORLD.height,
      );
      const compact = this.scale.width < 1000 || this.scale.height < 480;
      const zoom = compact
        ? Math.max(fit, 0.38, Math.min(0.65, this.scale.width / 900))
        : fit;
      const position = runtime.position;
      const halfWidth = this.scale.width / zoom / 2;
      const halfHeight = this.scale.height / zoom / 2;
      camera
        .setZoom(zoom)
        .centerOn(
          compact && position && halfWidth < WORLD.width / 2
            ? Phaser.Math.Clamp(position.x, halfWidth, WORLD.width - halfWidth)
            : WORLD.width / 2,
          compact && position && halfHeight < WORLD.height / 2
            ? Phaser.Math.Clamp(
                position.y,
                halfHeight,
                WORLD.height - halfHeight,
              )
            : WORLD.height / 2,
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
      if (state.stage !== this.stage || state.walls.length !== this.wallCount) {
        this.stage = state.stage;
        this.wallCount = state.walls.length;
        this.buildProps(state);
        this.positions.clear();
      }
      const g = this.actors.clear(),
        fx = this.overlays.clear();
      this.gear.clear();
      this.danger.clear();
      this.shields.clear();
      this.art.begin();
      // 장치가 파괴되면 같은 틱의 서버 상태와 함께 이미지·충돌 벽도 사라진다.
      for (const device of Object.values(state.devices)) {
        if (device.hp <= 0 || device.kind === "pillar") continue;
        const goal = encounterFor(state.stage).goal;
        if (goal === "devices" || goal === "disrupt") {
          this.danger.lineStyle(3, 0xffdc78, 0.85).strokeCircle(device.x, device.y, device.radius + 14);
          this.danger.lineStyle(2, 0x372b43).strokeCircle(device.x, device.y, device.radius + 18);
        }
        // 바닥 효과의 외곽은 서버 둔화 반경과 일치한다. 장치가 파괴되면 같은 패치에서 사라진다.
        if (device.kind === "sand-totem" || device.kind === "frost-core") {
          const frost = device.kind === "frost-core", radius = frost ? 165 : 145;
          g.fillStyle(frost ? 0xa7e8ff : 0xffd077, 0.18).fillCircle(device.x, device.y, radius);
          g.lineStyle(2, frost ? 0xc5f6ff : 0xffdf9a, 0.65).strokeCircle(device.x, device.y, radius);
          for (let index = 0; index < 8; index++) {
            const angle = index * Math.PI / 4;
            const x = device.x + Math.cos(angle) * radius * 0.7, y = device.y + Math.sin(angle) * radius * 0.7;
            g.lineStyle(2, frost ? 0xe0faff : 0xffe7ad, 0.6).lineBetween(x - 5, y, x + 5, y);
            if (frost) g.lineBetween(x, y - 5, x, y + 5);
          }
        }
        this.art.draw(
          device.id,
          STAGE_MAPS[state.mapId].theme,
          5,
          device.x,
          device.y,
          90,
          0,
          device.hp,
          this.elapsed,
        );
        if (device.hp < device.maxHp) {
          g.fillStyle(0x49345e).fillRoundedRect(
            device.x - 28,
            device.y - 58,
            56,
            5,
            2,
          );
          g.fillStyle(0xf5c574).fillRoundedRect(
            device.x - 28,
            device.y - 58,
            (56 * device.hp) / device.maxHp,
            5,
            2,
          );
        }
      }
      this.protectionLabel.setVisible(false);
      const seen = new Set<string>();
      for (const hazard of Object.values(state.hazards))
        drawHazard(this.danger, hazard, this.elapsed);
      for (const pickup of Object.values(state.pickups)) drawPickup(g, pickup);
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
        drawEnemyWarning(this.danger, enemy, x, y, this.elapsed);
        const roster = STAGE_MAPS[state.mapId].ordinary as readonly string[];
        const frame = enemy.boss
          ? state.stage === 5
            ? 3
            : 4
          : enemy.kind === "sniper" ? 2 : Math.max(0, roster.indexOf(enemy.kind));
        if (enemy.kind === "support") drawSupportDrone(g, x, y, this.elapsed);
        else this.art.draw(
          enemy.id,
          STAGE_MAPS[state.mapId].theme,
          frame,
          x,
          y,
          enemy.boss ? (state.stage === 5 ? 110 : 145) : r * 2.8,
          enemy.angle,
          enemy.hp,
          this.elapsed,
          true,
          enemy.exposed > 0,
        );
        if (enemy.elite) {
          this.danger.lineStyle(2.5, 0xffd267).strokeCircle(x, y + r * 0.25, r + 10);
          this.danger.fillStyle(0xffda7a).fillTriangle(x - 7, y - r * 2, x + 7, y - r * 2, x, y - r * 2 - 9);
        }
        if (enemy.exposed > 0)
          g.lineStyle(2.5, 0xffd16c, 0.85).strokeEllipse(
            x,
            y + r * 0.7,
            r * 2.6,
            r,
          );
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
        if (bullet.hostile) {
          drawHostileProjectile(this.danger, bullet, zoom, runtime.snapshotAgeSeconds);
          continue;
        }
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
        const protection = Math.max(
          0,
          player.protection - runtime.snapshotAgeSeconds,
        );
        this.drawPlayer(
          g,
          player,
          x,
          y,
          own ? runtime.aim : player.aim,
          own,
          protection,
        );
        const shield = Math.max(0, (player.shieldRemaining ?? 0) - runtime.snapshotAgeSeconds);
        if (player.alive && shield > 0)
          drawActiveShield(this.shields, x, y, shield, this.elapsed, this.reducedMotion);
        if (own && player.alive && shield > 0) {
          // 작은 화면에서도 읽을 수 있는 크기를 유지하고 화면 아래에서는 캐릭터 위로 재배치한다.
          const scale = Math.max(1, 0.8 / zoom);
          const text = formatShieldTime(shield);
          if (this.protectionLabel.text !== text)
            this.protectionLabel.setText(text);
          const half = (this.protectionLabel.width * scale) / 2 + 8 / zoom;
          const textY =
            y + 58 + 22 / zoom < camera.worldView.bottom ? y + 58 : y - 68;
          this.protectionLabel
            .setScale(scale)
            .setPosition(
              Phaser.Math.Clamp(
                x,
                camera.worldView.left + half,
                camera.worldView.right - half,
              ),
              textY,
            )
            .setVisible(true);
        }
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
            .setOrigin(0.5)
            .setDepth(35);
          this.labels.set(player.id, label);
        }
        label
          .setPosition(x, y - 55)
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
      for (const effect of Object.values(state.effects))
        drawEffect(fx, effect, runtime.snapshotAgeSeconds);
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
      this.art.end();
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
      protection: number,
    ): void {
      const color = protection > 0 ? 0xd9c1ff : own ? 0x66c7fa : 0x69e3b5;
      if (!player.alive) {
        this.art.draw(
          player.id,
          "players",
          SHOOTING_CHARACTERS[player.character].frame,
          x,
          y,
          76,
          angle,
          player.hp,
          this.elapsed,
        );
        g.lineStyle(3, 0xfac679, 0.8)
          .strokeRoundedRect(x - 17, y - 17, 34, 34, 4)
          .lineBetween(x - 7, y - 7, x + 7, y + 7)
          .lineBetween(x + 7, y - 7, x - 7, y + 7);
        return;
      }
      g.fillStyle(0x03070c, 0.5).fillEllipse(x + 2, y + 17, 48, 20);
      // 피격·부활 보호는 얇은 육각 장갑, 아이템 무적은 최상단의 큰 시안 실드로 구분한다.
      if (protection > 0 && !(player.shieldRemaining > 0))
        drawShield(this.shields, x, y, 34, 0.35);
      if (player.dashRemaining > 0) {
        g.lineStyle(5, color, 0.35).lineBetween(
          x - player.vx * 0.04,
          y - player.vy * 0.04,
          x,
          y,
        );
      }
      this.art.draw(
        player.id,
        "players",
        SHOOTING_CHARACTERS[player.character].frame,
        x,
        y,
        76,
        angle,
        player.hp,
        this.elapsed,
        Math.hypot(player.vx, player.vy) > 1,
      );
      g.lineStyle(2.5, own ? 0x78e5ff : 0xd8a3ff, 0.85).strokeEllipse(
        x,
        y + 18,
        48,
        23,
      );
      drawWeapon(
        this.gear,
        player.weapon,
        // 공룡의 위쪽 조준은 총을 머리 옆으로 옮겨 총열이 헤드폰·뿔처럼 겹쳐 보이지 않게 한다.
        x + Math.cos(angle) * 12 - Math.sin(angle) * (player.character === "HEADPHONE_DINO" ? 34 : 0),
        y + Math.sin(angle) * 8 + (player.character === "HEADPHONE_DINO" ? 10 : 0),
        angle,
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
    backgroundColor: "#e7e0f2",
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
