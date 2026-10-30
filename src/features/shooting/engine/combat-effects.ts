import type Phaser from "phaser";
import {
  WORLD,
  BOSS_COMBAT,
  type EffectView,
  type EnemyView,
  type HazardView,
} from "@playground/shooting-shared";

type Graphics = Phaser.GameObjects.Graphics;

/** 오브젝트·타이머를 효과마다 생성하지 않고 서버 수명과 ID로 일정한 파편 궤적을 그린다. */
export function drawEffect(g: Graphics, effect: EffectView, snapshotAge = 0): void {
  // 50ms 서버 패치 사이도 이어 그려 빠르게 흩어지는 파편이 계단식으로 움직이지 않게 한다.
  const life = Math.max(0, effect.life - snapshotAge);
  if (life <= 0 || effect.duration <= 0) return;
  const p = Math.max(0, Math.min(1, 1 - life / effect.duration)),
    fade = 1 - p;
  const { x, y, radius: r, kind } = effect;
  const seed = parseInt(effect.id, 36) || 1;
  if (kind === "death" || kind === "boss-death") {
    // A안: 금속·장갑 파편이 회전하며 흩어지고 아래로 가라앉아 사라진다.
    // 짧은 파열 섬광과 밝은 테두리·잔궤적으로 어두운 바닥에서도 처치 순간과 분해 방향을 읽게 한다.
    const boss = kind === "boss-death";
    const count = boss ? 24 : 12;
    const scatter = 1 - (1 - p) ** 3;
    const fragmentAlpha = Math.min(1, (1 - p) / 0.45);
    if (p < 0.2) {
      const flash = 1 - p / 0.2;
      g.fillStyle(0xffdab0, flash * 0.2).fillCircle(x, y, r * (0.35 + p));
      g.lineStyle(boss ? 4 : 2.5, 0xffe8c0, flash)
        .strokeCircle(x, y, r * (0.18 + p * 2));
    }
    for (let i = 0; i < count; i++) {
      const a = i * 2.399 + seed * 0.37,
        travel = (0.5 + ((seed + i * 7) % 11) / 10) * r * scatter,
        px = x + Math.cos(a) * travel,
        py = y + Math.sin(a) * travel * 0.8 + p * p * 30,
        color = i % 3 === 0 ? 0xa7d4e4 : i % 3 === 1 ? 0xff9a83 : 0xc3afff;
      g.lineStyle(boss ? 2.5 : 1.5, color, fragmentAlpha * 0.4)
        .lineBetween(px, py, px - Math.cos(a) * (8 + 15 * (1 - p)), py - Math.sin(a) * (8 + 15 * (1 - p)));
      g.save()
        .translateCanvas(px, py)
        .rotateCanvas(a + p * (i % 2 ? 6 : -6));
      g.fillStyle(color, fragmentAlpha);
      const size = ((i % 4) + (boss ? 7 : 5)) * (1 - p * 0.35);
      g.fillTriangle(-size, -size * 0.4, size, -size * 0.65, 0, size);
      g.lineStyle(1.2, 0xffedcf, fragmentAlpha * 0.85)
        .strokeTriangle(-size, -size * 0.4, size, -size * 0.65, 0, size);
      g.restore();
    }
    return;
  }
  if (kind === "explosion" || kind === "enemy-explosion") {
    // 폭발은 짧은 섬광→불꽃 조각→잔연기로 표현한다. 피해 범위 원을 남기지 않는다.
    const hostile = kind === "enemy-explosion",
      color = hostile ? 0xff745c : 0xffbb65;
    if (hostile && p < 0.35)
      g.fillStyle(0xffc6a0, (1 - p / 0.35) * 0.8).fillTriangle(
        x - 12,
        y,
        x,
        y - r * 1.7,
        x + 12,
        y,
      );
    for (let i = 0; i < 10; i++) {
      const a = i * 2.399 + seed,
        distance = r * (0.1 + p * 0.8),
        px = x + Math.cos(a) * distance,
        py = y + Math.sin(a) * distance * 0.85;
      g.lineStyle(3 * fade + 1, color, fade).lineBetween(
        px,
        py,
        px + Math.cos(a) * 10 * fade,
        py + Math.sin(a) * 10 * fade,
      );
      if (i < 5)
        g.fillStyle(0x7c716c, fade * p * 0.4).fillEllipse(
          px * 0.4 + x * 0.6,
          py * 0.4 + y * 0.6 - p * 25,
          r * 0.4 * p,
          r * 0.25 * p,
        );
    }
    if (p < 0.28) {
      const flash = 1 - p / 0.28;
      g.fillStyle(0xffedbc, flash).fillTriangle(
        x - r * 0.3,
        y,
        x + r * 0.3,
        y,
        x,
        y - r * 0.35,
      );
      g.fillTriangle(x - r * 0.3, y, x, y + r * 0.35, x + r * 0.3, y);
    }
    return;
  }
  if (kind === "heal") {
    for (let i = 0; i < 4; i++) {
      const px = x - 18 + i * 12,
        py = y + 10 - p * 45 - (i % 2) * 12;
      g.fillStyle(0x75edb4, fade)
        .fillRect(px - 2, py - 6, 4, 12)
        .fillRect(px - 6, py - 2, 12, 4);
    }
    return;
  }
  if (kind === "revive") {
    g.fillStyle(0x8aeaca, fade * 0.22).fillRect(x - 18, y - 95, 36, 110);
    for (let i = 0; i < 3; i++) {
      const py = y + 20 - p * 65 - i * 18;
      g.lineStyle(3, 0xaaffdd, fade)
        .lineBetween(x - 12, py + 7, x, py)
        .lineBetween(x, py, x + 12, py + 7);
    }
    return;
  }
  if (kind === "invul") {
    drawShield(g, x, y, 30 + p * 9, fade);
    return;
  }
  if (kind === "stage-clear") {
    // 클리어는 전장 전체의 얇은 청록 스캔과 양쪽 리본으로 표시한다.
    const lineY = WORLD.height * p;
    g.fillStyle(0x7ee8d8, fade * 0.15).fillRect(
      WORLD.border,
      lineY,
      WORLD.width - WORLD.border * 2,
      12,
    );
    g.lineStyle(2, 0x9cf7df, fade * 0.7)
      .lineBetween(x - 200 - p * 300, y, x - 130 - p * 300, y)
      .lineBetween(x + 130 + p * 300, y, x + 200 + p * 300, y);
    return;
  }
  if (kind === "melee-swipe") {
    g.lineStyle(6 * fade, 0xe5a0ae, fade)
      .beginPath()
      .arc(
        x,
        y,
        r * (0.7 + p * 0.3),
        effect.value - 0.95 + p,
        effect.value - 0.25 + p,
      )
      .strokePath();
    return;
  }
  // 피격은 작은 교차 스파크, 전투 불능은 내려앉는 경고 조각으로 구별한다.
  const color = kind === "hit" ? 0xffddaa : 0xff7785;
  const size = kind === "hit" ? 5 + p * 8 : 12 + p * 10;
  g.lineStyle(2, color, fade)
    .lineBetween(x - size, y - size, x - size * 0.35, y - size * 0.35)
    .lineBetween(x + size * 0.35, y + size * 0.35, x + size, y + size);
  if (kind !== "hit")
    g.lineBetween(
      x + size,
      y - size,
      x + size * 0.35,
      y - size * 0.35,
    ).lineBetween(x - size * 0.35, y + size * 0.35, x - size, y + size);
}

/** 무적은 채워진 외곽 육각 장갑과 밝은 이중 테두리로 표현해 회복·부활과 구분한다. */
export function drawShield(
  g: Graphics,
  x: number,
  y: number,
  radius: number,
  alpha: number,
): void {
  g.fillStyle(0x9b78ff, alpha * 0.18).lineStyle(6, 0x9d75ff, alpha * 0.28).beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3,
      px = x + Math.cos(a) * radius,
      py = y + Math.sin(a) * radius;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath().fillPath().strokePath();
  g.lineStyle(2.5, 0xe8d9ff, alpha).strokePath();
  g.fillStyle(0xf0e5ff, alpha).fillRect(x - 4, y - radius - 3, 8, 5);
}

/** 포격은 정확한 원형 판정 경계의 짧은 점선·안쪽 빗금·중앙 낙하 화살표로 예고한다. */
export function drawHazard(
  g: Graphics,
  hazard: HazardView,
  time: number,
): void {
  if (hazard.warning <= 0) return;
  const { x, y, radius: r } = hazard,
    progress = 1 - hazard.warning / 0.9;
  const alpha = 0.5 + Math.sin(time * 14) * 0.15;
  g.lineStyle(2, 0xff806e, alpha);
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8;
    g.beginPath()
      .arc(x, y, r, a, a + 0.11)
      .strokePath();
  }
  // 빗금은 실제 원 내부에 한정해 위험 영역을 과장하거나 줄여 보이지 않는다.
  g.lineStyle(1.5, 0xff695e, 0.18 + progress * 0.18);
  for (let offset = -r + 12; offset < r; offset += 18) {
    const half = Math.sqrt(r * r - offset * offset);
    g.lineBetween(x - half, y + offset, x + half, y + offset);
  }
  const py = y - 35 + progress * 22;
  g.lineStyle(3, 0xffa381, alpha)
    .lineBetween(x, py - 13, x, py + 5)
    .lineBetween(x - 7, py - 1, x, py + 6)
    .lineBetween(x, py + 6, x + 7, py - 1);
  g.fillStyle(0xffb495, 0.9).fillRect(x - 18, y + r + 8, 36 * progress, 3);
}

/** 사수는 조준선, 돌진은 통로, 보스는 실제 공격 식별자에 맞는 탄막·휘두르기·포격 예고로 구분한다. */
export function drawEnemyWarning(
  g: Graphics,
  enemy: EnemyView,
  x: number,
  y: number,
  time = 0,
): void {
  if (enemy.warning <= 0) return;
  const dx = enemy.targetX - x,
    dy = enemy.targetY - y,
    a = Math.atan2(dy, dx);
  const attack = enemy.attack;
  if (enemy.boss && attack && attack !== "boss-charge") {
    const enraged = enemy.hp <= enemy.maxHp * 0.5;
    g.lineStyle(2, 0xff967c, 0.65);
    if (attack === "boss-cleave") {
      const { cleaveRadius: r, cleaveHalfAngle: arc } = BOSS_COMBAT;
      g.fillStyle(0xff806e, 0.13).beginPath().moveTo(x, y)
        .arc(x, y, r, a - arc, a + arc).closePath().fillPath().strokePath();
    } else if (attack === "boss-mortar" || attack === "boss-crossfire") {
      // 포격 직전에는 중심·진행 방향, 발사 후에는 각 지점의 정확한 원형 범위를 표시한다.
      const tx = enemy.targetX, ty = enemy.targetY;
      g.strokeRect(tx - 20, ty - 20, 40, 40);
      if (attack === "boss-crossfire") {
        g.save().translateCanvas(tx, ty).rotateCanvas(a)
          .lineBetween(-200, 0, 200, 0).lineBetween(0, -200, 0, 200).restore();
      } else {
        for (let i = 0; i < 6; i++) {
          const direction = a + i * Math.PI / 3;
          g.strokeCircle(tx + Math.cos(direction) * 185, ty + Math.sin(direction) * 185, 8);
        }
      }
    } else if (attack === "boss-ring" || attack === "boss-spiral") {
      const count = attack === "boss-ring" ? (enraged ? 16 : 12) : 8;
      g.strokeCircle(x, y, enemy.radius + 26);
      for (let i = 0; i < count; i++) {
        const direction = a + (i + 0.5) * Math.PI * 2 / count + (attack === "boss-spiral" ? time * 1.6 : 0);
        g.lineBetween(x + Math.cos(direction) * (enemy.radius + 10),
          y + Math.sin(direction) * (enemy.radius + 10),
          x + Math.cos(direction) * (enemy.radius + 58), y + Math.sin(direction) * (enemy.radius + 58));
      }
    } else {
      const count = attack === "boss-burst" ? 3 : (enraged ? 9 : 7);
      const arc = attack === "boss-burst" ? 0.32 : BOSS_COMBAT.fanArc;
      for (let i = 0; i < count; i++) {
        const direction = a + (i / (count - 1) - 0.5) * arc;
        g.lineBetween(x + Math.cos(direction) * enemy.radius, y + Math.sin(direction) * enemy.radius,
          x + Math.cos(direction) * 320, y + Math.sin(direction) * 320);
      }
    }
  } else if (enemy.kind.includes("artillery")) {
    const tx = enemy.targetX,
      ty = enemy.targetY;
    g.lineStyle(2, 0xff9876, 0.6).strokeRect(tx - 16, ty - 16, 32, 32);
    g.lineBetween(tx - 8, ty, tx + 8, ty).lineBetween(tx, ty - 8, tx, ty + 8);
  } else if (enemy.kind.includes("charge")) {
    const length = enemy.boss ? BOSS_COMBAT.chargeSpeed * BOSS_COMBAT.chargeSeconds
      : Math.min(Math.hypot(dx, dy), 270),
      width = enemy.radius;
    g.save().translateCanvas(x, y).rotateCanvas(a);
    g.lineStyle(2, 0xff8c71, 0.5)
      .lineBetween(width, -width, length, -width)
      .lineBetween(width, width, length, width);
    for (let i = 70; i < length; i += 55)
      g.lineBetween(i - 12, -10, i, 0).lineBetween(i, 0, i - 12, 10);
    g.restore();
  } else if (enemy.kind === "brute") {
    g.lineStyle(3, 0xe0a0b6, 0.55)
      .beginPath()
      .arc(x, y, 105, a - 1.2, a + 1.2)
      .strokePath();
  } else {
    g.lineStyle(enemy.boss ? 3 : 1.5, 0xff776f, 0.45).lineBetween(
      x,
      y,
      enemy.targetX,
      enemy.targetY,
    );
    g.fillStyle(0xffa48b, 0.8).fillTriangle(
      enemy.targetX,
      enemy.targetY - 5,
      enemy.targetX + 5,
      enemy.targetY + 4,
      enemy.targetX - 5,
      enemy.targetY + 4,
    );
  }
}
