import { STAGE_MAPS, type StageMapId } from "@playground/shooting-shared";

const images = new Map<string, Promise<void>>();

/** 서버 전투가 시작되기 전에 원화를 준비한다. 실패는 캐시하지 않아 같은 화면에서 재시도할 수 있다. */
export function warmStageArt(mapId: StageMapId): Promise<void> {
  const pending = ["players", STAGE_MAPS[mapId].theme].map((name) => {
    const url = `/images/shooting/stage-v3/${name}.png`;
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
