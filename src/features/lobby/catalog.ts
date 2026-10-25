import type { CatalogGame, CatalogGenre } from "@/features/games/contracts";

/** 공개 로비의 표시용 계약이다. 게임 실행·접속자 수는 실제 서비스가 연결된 뒤 별도 API로 제공한다. */
// 게임 정보와 장르는 DB API에서 읽고 이 파일은 표시 방식과 파생 배지만 관리한다.
export type GameCategoryId =
  | "all"
  | "popular"
  | "new"
  | "2d"
  | "3d"
  | "multiplayer"
  | "singleplayer"
  | "twoplayer"
  | "group"
  | `genre:${string}`;

export const gameCategories = [
  { id: "all", label: "전체", icon: "grid", color: "purple" },
  { id: "popular", label: "인기 게임", icon: "flame", color: "orange" },
  { id: "new", label: "신규 게임", icon: "new", color: "blue" },
  { id: "2d", label: "2D 게임", icon: "2d", color: "blue" },
  { id: "3d", label: "3D 게임", icon: "cube", color: "cyan" },
  { id: "multiplayer", label: "멀티플레이", icon: "users", color: "purple" },
  { id: "singleplayer", label: "싱글플레이", icon: "user", color: "green" },
  { id: "twoplayer", label: "2인 플레이", icon: "users", color: "purple" },
  { id: "group", label: "3인 이상", icon: "users", color: "blue" },
] as const satisfies readonly {
  id: GameCategoryId;
  label: string;
  icon: string;
  color: string;
}[];

/** 오목 한 개로 시작하며 이후 게임도 같은 카드 계약을 사용한다. 출시 전 수치나 순위는 표시하지 않는다. */
export type LobbyGame = Readonly<{
  id: string; title: string; description: string; tags: readonly string[];
  availability: CatalogGame["availability"]; available: boolean; unavailableMessage: string;
}>;

export function lobbyGame(game: CatalogGame): LobbyGame {
  const modes = game.modes.filter(mode => mode.published && mode.supported);
  const graphics = [...new Set(modes.map(mode => mode.graphicsType === "TWO_D" ? "2D" : "3D"))];
  const playerTags = [...new Set(modes.map(mode => mode.maxHumanPlayers === 1 ? "1인" : mode.minHumanPlayers === mode.maxHumanPlayers
    ? `${mode.maxHumanPlayers}인` : `${mode.minHumanPlayers}~${mode.maxHumanPlayers}인`))];
  // 카드 표지는 고정 게임 코드로 연결하므로 별도 이미지 선택값을 복제하지 않는다.
  return { id: game.code, title: game.name, description: game.summary,
    availability: game.availability, available: game.availability === "AVAILABLE" && modes.some(mode => mode.availability === "AVAILABLE"),
    unavailableMessage: game.unavailableMessage,
    tags: [...graphics, ...game.genres.map(genre => genre.name), ...playerTags] };
}

/** 익숙한 장르만 기존 아이콘을 사용하며 새 장르도 DB 이름과 공통 아이콘으로 바로 표시한다. */
type GenreIcon = "puzzle" | "car" | "swords" | "board" | "city" | "gamepad";
export function genreCategory(genre: CatalogGenre): { id: GameCategoryId; label: string; icon: GenreIcon; color: string } {
  const icons: Readonly<Record<string, GenreIcon>> = { PUZZLE: "puzzle", RACING: "car", ACTION: "swords", BOARD: "board", SIMULATION: "city", CASUAL: "gamepad" };
  return { id: `genre:${genre.code}`, label: genre.name, icon: icons[genre.code] ?? "gamepad", color: "blue" };
}
