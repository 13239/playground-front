import type Phaser from "phaser";
import type { PickupView } from "@playground/shooting-shared";

const colors = { xp: 0x6aafff, heal: 0x5ce8a5, revive: 0xff6678, invul: 0x7dd3fc } as const;
// 하트 곡선은 한 번만 계산해 많은 드롭을 그려도 프레임마다 배열·삼각함수를 생성하지 않는다.
const heart = Array.from({ length: 40 }, (_, index) => {
  const a = index * Math.PI / 20;
  return { x: 16 * Math.sin(a) ** 3 * 0.52,
    y: -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) * 0.52 - 1 };
});

/** 드롭도 사용 버튼과 같은 하늘색 방패·빨간 하트를 사용하고 회복 십자·경험치와 형태를 구분한다. */
export function drawPickup(g: Phaser.GameObjects.Graphics, pickup: PickupView): void {
  const { x, y, kind } = pickup, color = colors[kind];
  g.fillStyle(color, 0.13).fillCircle(x, y, kind === "xp" ? 9 : 21);
  if (kind === "xp") {
    g.fillStyle(color).fillTriangle(x, y - 5, x + 4, y + 3, x - 4, y + 3);
    return;
  }
  g.fillStyle(0x0b1720).fillRoundedRect(x - 12, y - 12, 24, 24, 5);
  g.lineStyle(1, color, 0.45).strokeRoundedRect(x - 12, y - 12, 24, 24, 5);
  if (kind === "heal") {
    g.fillStyle(color).fillRect(x - 2, y - 6, 4, 12).fillRect(x - 6, y - 2, 12, 4);
    return;
  }
  g.fillStyle(color, 0.3).lineStyle(2, color).beginPath();
  if (kind === "revive") {
    g.moveTo(x + heart[0].x, y + heart[0].y);
    for (let i = 1; i < heart.length; i++) g.lineTo(x + heart[i].x, y + heart[i].y);
  } else {
    g.moveTo(x, y - 10).lineTo(x + 8, y - 7).lineTo(x + 8, y - 1)
      .lineTo(x + 6, y + 5).lineTo(x, y + 10).lineTo(x - 6, y + 5)
      .lineTo(x - 8, y - 1).lineTo(x - 8, y - 7);
  }
  g.closePath().fillPath().strokePath();
}
