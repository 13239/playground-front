import type Phaser from "phaser";
import type { MissionNodeView } from "@playground/shooting-shared";

/** 재사용 Graphics에 공개 노드만 그린다. 색·형태·문자로 목표와 완료 상태를 함께 구분한다. */
export function drawMissionNodes(g: Phaser.GameObjects.Graphics, nodes: readonly MissionNodeView[], time: number): void {
  const chain = nodes.filter(n => ["circuit", "prune", "track"].includes(n.kind));
  if (chain.length > 1) {
    g.lineStyle(4, 0x162d48, 0.8);
    for (let i = 1; i < chain.length; i++) g.lineBetween(chain[i - 1].x, chain[i - 1].y, chain[i].x, chain[i].y);
    g.lineStyle(1.5, 0x8ae7f0, 0.85);
    for (let i = 1; i < chain.length; i++) g.lineBetween(chain[i - 1].x, chain[i - 1].y, chain[i].x, chain[i].y);
  }
  const mirror = nodes.find(n => n.kind === "reflect"), guide = nodes.find(n => n.kind === "guide"), receiver = nodes.find(n => n.kind === "receiver");
  if (mirror && guide && receiver) {
    g.lineStyle(2, 0x7deeff, 0.55).lineBetween(guide.x, guide.y, mirror.x, mirror.y);
    g.lineStyle(2, 0xffd97b, 0.55).lineBetween(mirror.x, mirror.y, receiver.x, receiver.y);
  }
  for (const node of nodes) {
    if (node.status === "hidden" || (node.kind === "hearth" && nodes.some(n => n.kind === "cargo" && n.status === "active"))) continue;
    const { x, y, radius: r } = node;
    const done = node.status === "done", open = node.status === "open";
    const color = done || node.kind === "shelter" ? 0x80e4b6 : open || ["receiver", "goal", "lure", "freeze", "dash"].includes(node.kind) ? 0xffdc75 : node.status === "closed" ? 0xd58cbb : 0x8addeb;
    g.fillStyle(0x142039, 0.88).fillCircle(x, y, r);
    g.fillStyle(color, 0.13).fillCircle(x, y, r);
    g.lineStyle(5, 0x162039, 0.9).strokeCircle(x, y, r + 3);
    g.lineStyle(open ? 3.5 : 2, color, 0.95).strokeCircle(x, y, r);
    if (node.kind === "goal" || node.kind === "shelter") {
      g.lineStyle(2, color, 0.4).strokeCircle(x, y, r * 0.7);
      g.lineBetween(x - 10, y, x + 10, y).lineBetween(x, y - 10, x, y + 10);
    } else if (node.kind === "reflect") {
      const a = node.angle + Math.PI / 2;
      g.lineStyle(7, 0xe7faff).lineBetween(x - Math.cos(a) * 26, y - Math.sin(a) * 26, x + Math.cos(a) * 26, y + Math.sin(a) * 26);
    } else if (node.kind === "dash" || node.kind === "wind") {
      const a = node.angle, dx = Math.cos(a), dy = Math.sin(a);
      g.lineStyle(4, color).lineBetween(x - dx * 20, y - dy * 20, x + dx * 20, y + dy * 20)
        .lineBetween(x + dx * 20, y + dy * 20, x + dx * 7 - dy * 10, y + dy * 7 + dx * 10)
        .lineBetween(x + dx * 20, y + dy * 20, x + dx * 7 + dy * 10, y + dy * 7 - dx * 10);
    } else if (node.kind === "cargo") {
      g.lineStyle(3, color).strokeRect(x - 13, y - 13, 26, 26);
    } else if (node.kind === "lure" || node.kind === "freeze") {
      g.lineStyle(2, color).strokeCircle(x, y, r * 0.5);
      g.lineBetween(x - r, y, x + r, y).lineBetween(x, y - r, x, y + r);
    }
    if (node.progress > 0) {
      g.lineStyle(5, color).beginPath().arc(x, y, r + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, node.progress)).strokePath();
    }
    if (open) g.lineStyle(1, color, 0.35 + Math.sin(time * 4) * 0.1).strokeCircle(x, y, r + 12);
  }
}
