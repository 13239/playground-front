import { STAGE_MAPS, type StageMapId } from "@playground/shooting-shared";

const images = new Map<string, Promise<void>>();

/** 준비 화면과 Phaser 로더가 같은 목록을 사용한다. 공룡만 수정된 단일 원화를 사용해 다른 캐릭터는 보존한다. */
export function stageTextures(mapId: StageMapId) {
  const theme = STAGE_MAPS[mapId].theme;
  return [
    { key: "players", url: "/images/shooting/stage-v3/players.png", columns: 3, rows: 2 },
    { key: "headphone-dino-v5", url: "/images/shooting/combat-v5/headphone-dino.png", columns: 1, rows: 1 },
    { key: theme, url: `/images/shooting/stage-v3/${theme}.png`, columns: 3, rows: 2 },
  ];
}

/** 서버 전투가 시작되기 전에 원화를 준비한다. 실패는 캐시하지 않아 같은 화면에서 재시도할 수 있다. */
export function warmStageArt(mapId: StageMapId): Promise<void> {
  const pending = stageTextures(mapId).map(({ url }) => {
    let image = images.get(url);
    if (!image) {
      image = new Promise<void>((resolve, reject) => {
        const asset = new Image();
        asset.decoding = "async";
        asset.onload = () => resolve();
        asset.onerror = () =>
          reject(new Error("Stage artwork is unavailable."));
        asset.src = url;
      }).catch((error: unknown) => {
        images.delete(url);
        throw error;
      });
      images.set(url, image);
    }
    return image;
  });
  return Promise.all(pending).then(() => undefined);
}
