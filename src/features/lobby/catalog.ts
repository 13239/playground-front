import type { CatalogGame } from "@/features/games/contracts";
import type { GameFilter } from "@/features/games/filter-contracts";

/** 공개 로비의 표시용 계약이다. 게임 실행·접속자 수는 실제 서비스가 연결된 뒤 별도 API로 제공한다. */
// 게임 정보와 장르는 DB API에서 읽고 이 파일은 관리자가 선택한 라벨의 표시 방식만 관리한다.
export type GameCategoryId = "all" | "popular" | "new" | `filter:${string}`;
// 전체·인기·신규만 고정 탐색이며 장르·인원·그래픽 버튼은 사용 중인 DB 필터에서 읽는다.
export const gameCategories = [
  { id: "all", label: "전체", icon: "grid", color: "purple" },
  { id: "popular", label: "인기 게임", icon: "flame", color: "orange" },
  { id: "new", label: "신규 게임", icon: "new", color: "blue" },
] as const;

/** 오목 한 개로 시작하며 이후 게임도 같은 카드 계약을 사용한다. 출시 전 수치나 순위는 표시하지 않는다. */
export type LobbyGame = Readonly<{
  id: string; title: string; description: string; tags: readonly string[];
  availability: CatalogGame["availability"]; available: boolean; unavailableMessage: string;
}>;

export function lobbyGame(game: CatalogGame): LobbyGame {
  const modes = game.modes.filter(mode => mode.published && mode.supported);
  // 공개·지원 정보와 선택 코드가 모두 일치할 때만 표시하고 빈 선택에는 기본 라벨을 보충하지 않는다.
  const selected = new Set<string>(game.cardLabelCodes);
  const tags = [...new Set(game.cardLabels.filter(label => label.enabled && selected.has(label.labelCode)).map(label => label.name))];
  // 카드 표지는 고정 게임 코드로 연결하므로 별도 이미지 선택값을 복제하지 않는다.
  return { id: game.code, title: game.name, description: game.summary,
    availability: game.availability, available: game.availability === "AVAILABLE" && modes.some(mode => mode.availability === "AVAILABLE"),
    unavailableMessage: game.unavailableMessage,
    tags };
}

/** 홈은 사용 중인 DB 필터의 아이콘·이름·전체 순서를 그대로 사용한다. */
export function filterCategory(filter: GameFilter) {
  return { id: `filter:${filter.code}` as GameCategoryId, label: filter.name, icon: filter.icon,
    color: filter.type === "PLAYERS" ? "purple" : filter.type === "GRAPHICS" ? "cyan" : "blue" };
}
