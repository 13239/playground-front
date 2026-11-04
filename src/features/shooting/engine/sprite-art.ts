import Phaser from "phaser";
import { STAGE_MAPS, type StageMapId } from "@playground/shooting-shared";

interface ActorSprite {
  image: Phaser.GameObjects.Image;
  hp: number;
  hurtUntil: number;
}

/** 아틀라스는 맵당 한 번만 업로드한다. 매 프레임 새 이미지·캔버스·픽셀 배열을 만들지 않는다. */
export class SpriteArt {
  private readonly actors = new Map<string, ActorSprite>();
  private readonly visible = new Set<string>();
  private readonly reducedMotion = matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  constructor(private readonly scene: Phaser.Scene) {}

  static preload(scene: Phaser.Scene, mapId: StageMapId): void {
    for (const name of ["players", STAGE_MAPS[mapId].theme])
      if (!scene.textures.exists(name))
        scene.load.image(name, `/images/shooting/stage-v3/${name}.png`);
  }

  /** 셀의 투명 여백을 한 번 계산해 캐릭터별로 다른 원화 여백이 조작 크기를 바꾸지 않게 한다. */
  prepare(mapId: StageMapId): void {
    for (const name of ["players", STAGE_MAPS[mapId].theme]) {
      const texture = this.scene.textures.get(name);
      if (!texture || texture.has("actor-0")) continue;
      const source = texture.getSourceImage() as HTMLImageElement;
      const canvas = document.createElement("canvas");
      canvas.width = source.width;
      canvas.height = source.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) continue;
      context.drawImage(source, 0, 0);
      const pixels = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      ).data;
      const width = Math.floor(canvas.width / 3),
        height = Math.floor(canvas.height / 2);
      for (let index = 0; index < 6; index++) {
        const left = (index % 3) * width,
          top = Math.floor(index / 3) * height;
        let x0 = width,
          y0 = height,
          x1 = 0,
          y1 = 0;
        for (let y = 0; y < height; y += 2)
          for (let x = 0; x < width; x += 2)
            if (pixels[((top + y) * canvas.width + left + x) * 4 + 3] > 220) {
              x0 = Math.min(x0, x);
              y0 = Math.min(y0, y);
              x1 = Math.max(x1, x);
              y1 = Math.max(y1, y);
            }
        if (x1 <= x0) continue;
        const x = Math.max(0, x0 - 6),
          y = Math.max(0, y0 - 6);
        texture.add(
          `actor-${index}`,
          0,
          left + x,
          top + y,
          Math.min(width - x, x1 - x + 8),
          Math.min(height - y, y1 - y + 8),
        );
      }
    }
  }

  begin(): void {
    this.visible.clear();
  }

  draw(
    id: string,
    atlas: string,
    frame: number,
    x: number,
    y: number,
    size: number,
    angle: number,
    hp: number,
    time: number,
    moving = false,
    exposed = false,
  ): void {
    if (!this.scene.textures.get(atlas)?.has(`actor-${frame}`)) return;
    this.visible.add(id);
    let actor = this.actors.get(id);
    if (!actor) {
      actor = {
        image: this.scene.add.image(x, y, atlas, `actor-${frame}`),
        hp,
        hurtUntil: 0,
      };
      this.actors.set(id, actor);
    }
    const image = actor.image.setTexture(atlas, `actor-${frame}`);
    if (hp < actor.hp) actor.hurtUntil = time + 0.1;
    actor.hp = hp;
    const bob =
      moving && !this.reducedMotion ? Math.sin(time * 13 + x) * 2.4 : 0;
    const scale = size / Math.max(image.frame.width, image.frame.height);
    image
      .setScale(scale)
      .setOrigin(0.5, 0.65)
      .setPosition(x, y + bob)
      .setDepth(10 + y / 10000)
      .setFlipX(Math.cos(angle) < 0)
      .setRotation(
        this.reducedMotion ? 0 : moving ? Math.sin(time * 13) * 0.045 : 0,
      )
      .setAlpha(hp <= 0 ? 0.35 : 1);
    // Phaser 4는 색과 틴트 모드를 분리한다. 제거된 setTintFill(color)를 사용하지 않는다.
    if (time < actor.hurtUntil)
      image.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    else if (exposed)
      image.setTint(0xffe2a1).setTintMode(Phaser.TintModes.MULTIPLY);
    else image.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
  }

  end(): void {
    for (const [id, actor] of this.actors)
      if (!this.visible.has(id)) {
        this.actors.delete(id);
        if (this.reducedMotion) actor.image.destroy();
        else
          this.scene.tweens.add({
            targets: actor.image,
            alpha: 0,
            angle: 12,
            duration: 200,
            onComplete: () => actor.image.destroy(),
          });
      }
  }
}
