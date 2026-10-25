import type { CatalogGame } from "@/features/games/contracts";

export type GomokuScreen = "list" | "create" | "ai" | "room";

/** 서버 메타데이터와 창 복귀 후 브라우저 제목이 같은 공개 이름을 사용한다. */
export function gomokuPageTitle(game: CatalogGame | undefined, screen: GomokuScreen): string {
  const ai = game?.modes.find(mode => mode.code === "AI" && mode.published && mode.supported);
  const suffix = screen === "list" ? "방 목록" : screen === "create" ? "방 만들기" : screen === "room" ? "대국" : ai?.name ?? "AI";
  return `${game?.name ?? "게임"} ${suffix}`;
}
