import type Phaser from "phaser";
import type { EnemyView } from "@playground/shooting-shared";

type Graphics = Phaser.GameObjects.Graphics;

/** 같은 색 사각형 대신 실루엣·장갑·무장을 달리 그린다. 장식은 실제 충돌 반경 가까이에 둔다. */
export function drawEnemy(
  g: Graphics,
  enemy: EnemyView,
  x: number,
  y: number,
  time: number,
): void {
  const r = enemy.radius,
    stride = Math.sin(time * (enemy.kind === "brute" ? 5 : 10) + x) * 0.1;
  g.fillStyle(0x03070c, 0.55).fillEllipse(
    x + 3,
    y + r * 0.65,
    r * 2.3,
    r * 0.9,
  );
  g.save().translateCanvas(x, y).rotateCanvas(enemy.angle).scaleCanvas(r, r);
  if (enemy.boss) drawBoss(g, enemy, time);
  else if (enemy.kind === "chaser") {
    // 추격병: 네 개의 발과 전방 집게를 가진 붉은 사냥 로봇.
    legs(g, 0xa95663, stride, false);
    g.fillStyle(0x291d2b).fillTriangle(1, 0, -0.65, -0.7, -0.65, 0.7);
    g.fillStyle(0xd56773).fillTriangle(0.8, 0, -0.5, -0.53, -0.5, 0.53);
    g.lineStyle(0.14, 0xffab91)
      .lineBetween(0.3, -0.45, 0.87, -0.65)
      .lineBetween(0.3, 0.45, 0.87, 0.65);
  } else if (enemy.kind === "charger") {
    // 돌진병: 뾰족한 전면과 뒤쪽 추진기로 접근 방향을 쉽게 구분한다.
    g.fillStyle(0x251924).fillTriangle(1.04, 0, -0.8, -0.8, -0.8, 0.8);
    g.fillStyle(0xdc7654).fillTriangle(0.88, 0, -0.62, -0.56, -0.62, 0.56);
    g.fillStyle(0x402631)
      .fillRect(-0.85, -0.7, 0.28, 0.4)
      .fillRect(-0.85, 0.3, 0.28, 0.4);
    g.fillStyle(0xffb378, 0.6 + stride)
      .fillTriangle(-0.85, -0.6, -1.12, -0.5, -0.85, -0.4)
      .fillTriangle(-0.85, 0.4, -1.12, 0.5, -0.85, 0.6);
  } else if (enemy.kind === "shield") {
    legs(g, 0x728b9a, stride, false);
    g.fillStyle(0x263e4c).fillRoundedRect(-0.65, -0.62, 1.25, 1.24, 0.2);
    g.fillStyle(0x90aeb8).fillRoundedRect(0.38, -0.85, 0.38, 1.7, 0.12);
    g.lineStyle(0.08, 0xcbebec).lineBetween(0.72, -0.7, 0.72, 0.7);
    g.fillStyle(0xc9a969).fillRect(0.42, -0.16, 0.3, 0.32);
  } else if (enemy.kind === "brute") {
    legs(g, 0x645c83, stride, true);
    g.fillStyle(0x30283e).fillRoundedRect(-0.7, -0.7, 1.4, 1.4, 0.22);
    g.fillStyle(0x8e789e).fillRoundedRect(-0.52, -0.55, 1.05, 1.1, 0.15);
    g.lineStyle(0.18, 0x51475d)
      .lineBetween(-0.2, -0.62, 0.8, -0.8)
      .lineBetween(-0.2, 0.62, 0.8, 0.8);
    g.fillStyle(0xbc91b1)
      .fillRect(0.58, -1, 0.38, 0.48)
      .fillRect(0.58, 0.52, 0.38, 0.48);
    g.fillStyle(0xf5cb85).fillRect(-0.05, -0.5, 0.17, 1);
  } else if (enemy.kind === "shooter") {
    g.fillStyle(0x463354)
      .fillTriangle(-0.75, -0.95, 0.6, -0.45, -0.55, -0.2)
      .fillTriangle(-0.75, 0.95, -0.55, 0.2, 0.6, 0.45);
    g.fillStyle(0xad88d0).fillRoundedRect(-0.65, -0.6, 1.2, 1.2, 0.3);
    barrel(g, 1.05, 0.2, 0x3a2d4d);
  } else if (enemy.kind === "skirmisher") {
    g.fillStyle(0x196279)
      .fillTriangle(0.9, 0, -0.8, -0.95, -0.4, 0)
      .fillTriangle(0.9, 0, -0.4, 0, -0.8, 0.95);
    g.fillStyle(0x5fb8bd).fillTriangle(0.7, 0, -0.55, -0.65, -0.55, 0.65);
    barrel(g, 1.1, 0.13, 0x243d4d);
    g.fillStyle(0xa4f1e4, 0.6)
      .fillRect(-0.85, -0.7, 0.13, 0.4)
      .fillRect(-0.85, 0.3, 0.13, 0.4);
  } else {
    // 포격병: 궤도와 굵은 박격포 포신을 갖춘 낮은 차체.
    tracks(g, 0x4a493d);
    g.fillStyle(0xa49158).fillRoundedRect(-0.65, -0.55, 1.3, 1.1, 0.14);
    barrel(g, 1, 0.36, 0x363b3f);
    g.fillStyle(0xf4c96e).fillRect(-0.48, -0.35, 0.2, 0.7);
  }
  // 공통 붉은 센서는 작은 몬스터의 전방을 알려 준다.
  g.fillStyle(0x18212d).fillRoundedRect(-0.34, -0.28, 0.64, 0.56, 0.1);
  g.fillStyle(enemy.boss ? 0xffd395 : 0xff7977).fillRect(
    0.04,
    -0.21,
    0.13,
    0.42,
  );
  g.restore();
}

/** 보스 세 종류는 큰 몸체뿐 아니라 다리·날개·궤도와 발광 코어로 구별한다. */
function drawBoss(g: Graphics, enemy: EnemyView, time: number): void {
  const pulse = 0.65 + Math.sin(time * 5) * 0.2;
  if (enemy.kind === "boss-charge") {
    legs(g, 0x7c4653, Math.sin(time * 7) * 0.1, true);
    g.fillStyle(0x2d2533).fillRoundedRect(-0.85, -0.67, 1.55, 1.34, 0.25);
    g.fillStyle(0xb75c62).fillRoundedRect(-0.72, -0.55, 1.22, 1.1, 0.23);
    // 넓은 어깨와 발톱, 전면의 공성 뿔을 가진 돌진형 거대 갑각수.
    for (const side of [-1, 1]) {
      g.lineStyle(0.19, 0x6e3847).lineBetween(
        -0.25,
        side * 0.55,
        0.5,
        side * 0.84,
      );
      g.fillStyle(0xe29b7b).fillTriangle(
        0.35,
        side * 0.8,
        0.94,
        side * 0.55,
        0.67,
        side * 0.95,
      );
      g.fillStyle(0xeca480).fillTriangle(
        -0.65,
        side * 0.51,
        -0.8,
        side * 0.8,
        -0.25,
        side * 0.51,
      );
    }
    g.fillStyle(0xeac598).fillTriangle(0.42, -0.22, 1.03, 0, 0.42, 0.22);
  } else if (enemy.kind === "boss-barrage") {
    // 센티넬: 날개 장갑·단일 주포·부유 추진기가 있는 지휘 드론.
    for (const side of [-1, 1]) {
      g.fillStyle(0x302e4b).fillTriangle(
        0.4,
        side * 0.3,
        -0.7,
        side * 0.98,
        -0.95,
        side * 0.52,
      );
      g.fillStyle(0x8276a8).fillTriangle(
        0.22,
        side * 0.36,
        -0.55,
        side * 0.85,
        -0.75,
        side * 0.52,
      );
      g.lineStyle(0.05, 0x8ce8eb, pulse).lineBetween(
        -0.58,
        side * 0.8,
        -0.16,
        side * 0.57,
      );
    }
    g.fillStyle(0x483a63).fillRoundedRect(-0.62, -0.53, 1.12, 1.06, 0.27);
    g.fillStyle(0xb09acb).fillTriangle(0.45, 0, -0.15, -0.45, -0.15, 0.45);
    barrel(g, 1.03, 0.23, 0x242c41);
    g.fillStyle(0x88efed, pulse).fillRect(-0.75, -0.23, 0.16, 0.46);
  } else {
    // 디스트로이어: 분할 궤도·방열판·거대한 중앙 포신의 중장갑 공성 전차.
    tracks(g, 0x565549);
    g.fillStyle(0x393a36).fillRoundedRect(-0.82, -0.62, 1.56, 1.24, 0.14);
    g.fillStyle(0xb59a63).fillRoundedRect(-0.65, -0.48, 1.18, 0.96, 0.12);
    for (let i = 0; i < 4; i++)
      g.fillStyle(0xe2b96c, pulse).fillRect(-0.65 + i * 0.16, -0.45, 0.07, 0.9);
    barrel(g, 1.05, 0.4, 0x303b43);
    g.lineStyle(0.07, 0xe9c37f)
      .lineBetween(0.55, -0.35, 0.97, -0.35)
      .lineBetween(0.55, 0.35, 0.97, 0.35);
  }
  // 장갑의 내부 코어는 보스에게만 넓게 표시한다.
  g.fillStyle(0xffad72, pulse).fillRoundedRect(-0.42, -0.23, 0.28, 0.46, 0.06);
  g.lineStyle(0.025, 0xffd3a7, 0.7).strokeRoundedRect(
    -0.87,
    -0.68,
    1.57,
    1.36,
    0.24,
  );
}
function barrel(
  g: Graphics,
  length: number,
  width: number,
  color: number,
): void {
  g.lineStyle(width, color).lineBetween(0, 0, length, 0);
  g.lineStyle(width * 0.3, 0x9aabb6).lineBetween(
    0.4,
    -width * 0.15,
    length,
    -width * 0.15,
  );
}
function legs(
  g: Graphics,
  color: number,
  stride: number,
  heavy: boolean,
): void {
  for (const side of [-1, 1])
    for (const offset of [-0.5, 0.35]) {
      const step = stride * (offset > 0 ? 1 : -1);
      g.lineStyle(heavy ? 0.22 : 0.14, 0x1a222c).lineBetween(
        offset,
        side * 0.3,
        offset - 0.18 + step,
        side * 0.92,
      );
      g.lineStyle(heavy ? 0.14 : 0.08, color).lineBetween(
        offset,
        side * 0.5,
        offset - 0.18 + step,
        side * 0.92,
      );
    }
}
function tracks(g: Graphics, color: number): void {
  for (const side of [-1, 1]) {
    g.fillStyle(0x1a2229).fillRoundedRect(
      -0.92,
      side * 0.7 - 0.17,
      1.8,
      0.34,
      0.12,
    );
    for (let i = 0; i < 7; i++)
      g.fillStyle(color).fillRect(
        -0.82 + i * 0.25,
        side * 0.7 - 0.13,
        0.14,
        0.26,
      );
  }
}
