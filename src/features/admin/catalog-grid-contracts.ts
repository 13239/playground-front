import { gameCodePattern } from "@/features/games/contracts";
import { parseGenre, parseMode, type Game, type Genre } from "./contracts";
import { parseNumberedPage, type NumberedPage } from "./pagination-contracts";

/** 긴 게임 설명은 상세 조회로 분리하고 목록에 표시하는 정보만 전달한다. */
export type GameGridItem = Pick<Game, "code" | "name" | "sortOrder" | "version" | "genres" | "modes" | "published" | "availability">;
export type GenreGridItem = Genre & Readonly<{ gameCount: number }>;
export type CatalogGridPage<T> = NumberedPage<T> & Readonly<{ orderVersion: number }>;
export type CatalogArea = "games" | "game-genres" | "game-filters";

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function integer(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function parseGameItem(value: unknown): GameGridItem {
  if (!object(value) || typeof value.code !== "string" || !gameCodePattern.test(value.code)
    || typeof value.name !== "string" || value.name.length > 100 || !integer(value.sortOrder) || value.sortOrder > 1_000_000
    || !integer(value.version) || typeof value.published !== "boolean"
    || value.availability !== "AVAILABLE" && value.availability !== "MAINTENANCE" && value.availability !== "DISABLED"
    || !Array.isArray(value.genres) || value.genres.length > 1000 || !Array.isArray(value.modes) || value.modes.length > 1000) throw new Error("Invalid game grid item");
  return { code: value.code, name: value.name, sortOrder: value.sortOrder, version: value.version,
    published: value.published, availability: value.availability, genres: value.genres.map(parseGenre), modes: value.modes.map(parseMode) };
}
export function parseAdminGenre(value: unknown): GenreGridItem {
  const genre = parseGenre(value);
  if (!object(value) || !integer(value.gameCount)) throw new Error("Invalid genre game count");
  return { ...genre, gameCount: value.gameCount };
}
function parseGridPage<T extends { code: string; sortOrder: number }>(value: unknown, parse: (item: unknown) => T): CatalogGridPage<T> {
  const page = parseNumberedPage(value, parse);
  if (!object(value) || !integer(value.orderVersion)
    || page.items.length !== Math.min(page.size, page.totalElements - (page.page - 1) * page.size)
    || new Set(page.items.map(item => item.code)).size !== page.items.length
    || page.items.some((item, index) => index > 0 && item.sortOrder <= page.items[index - 1].sortOrder)) throw new Error("Invalid catalog grid page");
  return { ...page, orderVersion: value.orderVersion };
}
export const parseGameGridPage = (value: unknown) => parseGridPage(value, parseGameItem);
export const parseGenreGridPage = (value: unknown) => parseGridPage(value, parseAdminGenre);
