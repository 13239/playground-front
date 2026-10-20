/** 공개 로비의 표시용 계약이다. 게임 실행·접속자 수는 실제 서비스가 연결된 뒤 별도 API로 제공한다. */
export type GameCategoryId =
  | "all"
  | "popular"
  | "new"
  | "2d"
  | "3d"
  | "multiplayer"
  | "singleplayer"
  | "puzzle"
  | "racing"
  | "action"
  | "board"
  | "simulation"
  | "casual";

export const gameCategories = [
  { id: "all", label: "전체", icon: "grid", color: "purple" },
  { id: "popular", label: "인기 게임", icon: "flame", color: "orange" },
  { id: "new", label: "신규 게임", icon: "new", color: "blue" },
  { id: "2d", label: "2D 게임", icon: "2d", color: "blue" },
  { id: "3d", label: "3D 게임", icon: "cube", color: "cyan" },
  { id: "multiplayer", label: "멀티플레이", icon: "users", color: "purple" },
  { id: "singleplayer", label: "싱글플레이", icon: "user", color: "green" },
  { id: "puzzle", label: "퍼즐", icon: "puzzle", color: "blue" },
  { id: "racing", label: "레이싱", icon: "car", color: "purple" },
  { id: "action", label: "액션", icon: "swords", color: "red" },
  { id: "board", label: "보드", icon: "board", color: "blue" },
  { id: "simulation", label: "시뮬레이션", icon: "city", color: "blue" },
  { id: "casual", label: "캐주얼", icon: "gamepad", color: "purple" },
] as const satisfies readonly {
  id: GameCategoryId;
  label: string;
  icon: string;
  color: string;
}[];

/** 오목 한 개로 시작하며 이후 게임도 같은 카드 계약을 사용한다. 출시 전 수치나 순위는 표시하지 않는다. */
export const lobbyGames = [
  {
    id: "gomoku",
    title: "오목",
    description: "한 수 한 수, 함께 즐기는 두뇌 대결",
    categories: ["2d", "board", "multiplayer", "casual"],
    tags: ["2D", "보드", "멀티"],
  },
] as const;

export type LobbyGame = (typeof lobbyGames)[number];
