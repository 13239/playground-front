import type { GameFilter } from "./filter-contracts";
import type { CatalogGenre, CatalogMode } from "./contracts";

/** 표시 이름은 현재 게임 정보에서 만들고 관리자가 선택한 안정적인 코드만 저장한다. */
export type CardLabelCode = `GRAPHICS:${string}` | `GENRE:${string}` | `PLAYERS:${string}`;
export type CardLabelOption = Readonly<{ code: CardLabelCode; name: string; group: "graphics" | "genres" | "players" }>;
export const MAX_GAME_CARD_LABELS = 128;
const labelPattern = /^(?:GRAPHICS|GENRE|PLAYERS):[A-Z][A-Z0-9_]{0,63}$/;

export function isCardLabelCode(value: unknown): value is CardLabelCode {
  return typeof value === "string" && labelPattern.test(value);
}

/** 누락은 전체 해제와 구분하고 중복·범위·임의 문자열을 공개 응답과 관리 요청에서 함께 거절한다. */
export function isCardLabelCodes(value: unknown): value is readonly CardLabelCode[] {
  return Array.isArray(value) && value.length <= MAX_GAME_CARD_LABELS && new Set(value).size === value.length && value.every(isCardLabelCode);
}

/** 필터 마스터에 등록된 항목만 선택지로 만들며 실행 정보로 새 라벨을 생성하지 않는다. */
export function cardLabelOptions(
  genres: readonly Pick<CatalogGenre, "code" | "name">[],
  modes: readonly Pick<CatalogMode, "graphicsType" | "minHumanPlayers" | "maxHumanPlayers">[],
  filters: readonly GameFilter[],
): readonly CardLabelOption[] {
  return filters.filter(filter => filter.enabled && (filter.type === "GENRE"
    ? genres.some(genre => genre.code === filter.code)
    : modes.some(mode => filter.type === "GRAPHICS" ? mode.graphicsType === filter.graphicsType
      : mode.minHumanPlayers <= filter.maxPlayers! && mode.maxHumanPlayers >= filter.minPlayers!)))
    .map(filter => ({ code: filter.labelCode as CardLabelCode, name: filter.name,
      group: filter.type === "GENRE" ? "genres" : filter.type === "PLAYERS" ? "players" : "graphics" }));
}
