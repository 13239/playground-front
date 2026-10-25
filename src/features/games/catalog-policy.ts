import type { CatalogGame, CatalogMode } from "./contracts";

/** 화면의 새 실행 버튼에만 쓰는 표시 정책이다. 실제 실행·입장·재대국 권한은 매번 서버가 확인한다. */
export function catalogModeEntry(game: CatalogGame | undefined, code: string, error?: string): Readonly<{
  mode?: CatalogMode; available: boolean; message: string;
}> {
  const mode = game?.modes.find(value => value.code === code && value.published && value.supported);
  if (error) return { mode, available: false, message: error };
  if (!game) return { available: false, message: "게임 정보를 확인하고 있어요." };
  if (!game.published) return { available: false, message: "현재 공개되지 않은 게임이에요." };
  if (game.availability !== "AVAILABLE") return { mode, available: false, message: game.unavailableMessage || "현재 이 게임을 이용할 수 없어요." };
  if (!mode) return { available: false, message: "현재 이용할 수 있는 게임 모드가 없어요." };
  return { mode, available: mode.availability === "AVAILABLE", message: mode.availability === "AVAILABLE" ? ""
    : mode.unavailableMessage || "현재 이 모드를 이용할 수 없어요." };
}
