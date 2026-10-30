import type Phaser from "phaser";
import type { WeaponId } from "@playground/shooting-shared";

/** 전장에서도 선택 카드와 같은 총열 수·조준경·목재·원통 탄창으로 총을 구분한다. 판정 크기는 바꾸지 않는다. */
export function drawWeapon(g: Phaser.GameObjects.Graphics, weapon: WeaponId, x: number, y: number, angle: number): void {
  g.save().translateCanvas(x, y + 2).rotateCanvas(angle);
  g.fillStyle(0x0a131c).fillRoundedRect(-3, -6, 27, 12, 2);
  if (weapon === "shotgun") {
    g.fillStyle(0xb77c4c).fillRect(0, -5, 16, 10);
    g.fillStyle(0xb2c3cc).fillRect(15, -6, 25, 4).fillRect(15, 2, 25, 4);
    g.fillStyle(0xad784b).fillRect(20, -7, 11, 14);
    g.lineStyle(1, 0x593d2d).lineBetween(23, -6, 23, 6).lineBetween(27, -6, 27, 6);
  } else if (weapon === "sniper") {
    g.fillStyle(0x78928a).fillRect(0, -4, 23, 8);
    g.fillStyle(0xa0b9bf).fillRect(22, -2, 31, 4);
    g.fillStyle(0x344d58).fillRect(49, -4, 8, 8);
    g.fillStyle(0x284550).fillRoundedRect(6, -5, 17, 10, 3);
    g.fillStyle(0xb4e0ea).fillRect(21, -6, 3, 12);
    g.lineStyle(2, 0x9cb4b4).lineBetween(34, -2, 29, -10).lineBetween(34, 2, 29, 10);
  } else if (weapon === "launcher") {
    g.fillStyle(0x405a6b).fillCircle(15, 5, 10);
    g.fillStyle(0x8196a2).fillRoundedRect(6, -9, 30, 18, 5);
    g.lineStyle(2, 0x344b59).lineBetween(14, -8, 14, 8).lineBetween(23, -8, 23, 8);
    g.fillStyle(0xc3a76e).fillRect(33, -10, 6, 20);
    g.fillStyle(0x182a36).fillRect(37, -6, 3, 12);
  } else {
    g.fillStyle(0x7993a5).fillRect(0, -5, 23, 10);
    g.fillStyle(0xc4a56b).fillRect(10, 4, 7, 9);
    g.fillStyle(0x324c60).fillRect(22, -6, 10, 12);
    g.fillStyle(0xa3b8c6).fillRect(31, -2, 10, 4);
    g.fillStyle(0x344959).fillRect(39, -4, 5, 8);
  }
  g.restore();
}
