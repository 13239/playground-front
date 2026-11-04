import type Phaser from "phaser";
import { ATTACK_READABILITY, BALANCE, type BulletView } from "@playground/shooting-shared";

type Graphics = Phaser.GameObjects.Graphics;

/** 적 탄환은 지형·몬스터 위에 어두운 외곽선→발광 몸체→흰 핵으로 그린다. 패치 사이 이동도 짧게 보간한다. */
export function drawHostileProjectile(g: Graphics, bullet: BulletView, zoom: number, age: number): void {
  const x = bullet.x + bullet.vx * Math.min(0.075, age);
  const y = bullet.y + bullet.vy * Math.min(0.075, age);
  const r = Math.max(bullet.radius, 2.8 / zoom);
  const sniper = bullet.weapon === "enemy-sniper";
  const tail = sniper ? 0.04 : 0.035;
  const color = sniper ? 0xffdb68 : 0xff7358;
  const tx = x - bullet.vx * tail, ty = y - bullet.vy * tail;
  g.lineStyle(r * 3.5, 0x26152c, 0.8).lineBetween(tx, ty, x, y);
  g.lineStyle(r * 2, color).lineBetween(tx, ty, x, y);
  g.fillStyle(color, 0.18).fillCircle(x, y, r * 2.4);
  g.fillStyle(color).fillCircle(x, y, r);
  g.lineStyle(Math.max(1.5, 1 / zoom), 0xfff5d8).strokeCircle(x, y, r);
  g.fillStyle(0xffffff).fillCircle(x, y, r * 0.38);
}

/** 지원 장갑은 마젠타, 플레이어 실드는 시안으로 분리해 적과 아군 보호를 혼동하지 않게 한다. */
export function drawSupportDrone(g: Graphics, x: number, y: number, time: number): void {
  const radius = ATTACK_READABILITY.supportRadius;
  g.fillStyle(0xeb67e7, 0.055).fillCircle(x, y, radius);
  g.lineStyle(2, 0xef8cf0, 0.45);
  for (let i = 0; i < 16; i++)
    g.beginPath().arc(x, y, radius, i * Math.PI / 8, i * Math.PI / 8 + 0.1).strokePath();
  g.fillStyle(0x2e203c).fillEllipse(x, y + 12, 58, 23);
  g.fillStyle(0xb863d4).fillRoundedRect(x - 24, y - 20, 48, 33, 12);
  g.lineStyle(3, 0xffb9f5).strokeRoundedRect(x - 24, y - 20, 48, 33, 12);
  g.fillStyle(0x34213c).fillCircle(x, y - 4, 11);
  g.lineStyle(3, 0xffd6fb).lineBetween(x - 6, y - 4, x + 6, y - 4).lineBetween(x, y - 10, x, y + 2);
  g.fillStyle(0xf9caff, 0.65 + Math.sin(time * 5) * 0.15).fillEllipse(x, y + 17, 22, 7);
}

/** 아이템 무적은 캐릭터를 감싼 육각 실드와 남은 시간 호로 표시한다. 피격 보호는 이 효과를 사용하지 않는다. */
export function drawActiveShield(g: Graphics, x: number, y: number, remaining: number, time: number, reduced: boolean): void {
  const r = 47, cy = y - 9;
  const pulse = reduced ? 0.9 : 0.82 + Math.sin(time * 8) * 0.12;
  g.fillStyle(0x4de6ff, 0.13).fillEllipse(x, cy, r * 2, r * 2.15);
  g.lineStyle(9, 0x143455, 0.55).strokeEllipse(x, cy, r * 2, r * 2.15);
  g.lineStyle(3, 0x8cf6ff, pulse).strokeEllipse(x, cy, r * 2, r * 2.15);
  g.lineStyle(4, remaining < 0.5 ? 0xffde85 : 0xe5feff, 1)
    .beginPath().arc(x, cy, r + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, remaining / BALANCE.invulnerability)).strokePath();
  // 국소 육각면만 사용해 화면 전체 점멸·흔들림 때문에 적 탄환을 놓치지 않게 한다.
  g.lineStyle(1.5, 0xc2faff, 0.5).beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 3 * i;
    const px = x + Math.cos(a) * 33, py = cy + Math.sin(a) * 34;
    if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
  }
  g.closePath().strokePath();
}
