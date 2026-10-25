import { gameCodePattern } from "@/features/games/contracts";

/** 장르 검색 선택기는 코드·표시 이름·사용 여부만 다루고 관리 버전이나 집계는 전달하지 않는다. */
export type GenreOption = Readonly<{ code: string; name: string; enabled: boolean }>;
export type GenreOptionPage = Readonly<{ items: readonly GenreOption[]; nextCursor: string | null }>;
export const MAX_GAME_GENRES = 100;

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function parseGenreOption(value: unknown): GenreOption {
  if (!object(value) || typeof value.code !== "string" || !gameCodePattern.test(value.code)
    || typeof value.name !== "string" || !value.name.trim() || value.name.length > 50 || typeof value.enabled !== "boolean") throw new Error("Invalid genre option");
  return { code: value.code, name: value.name, enabled: value.enabled };
}
export function parseGenreOptionPage(value: unknown): GenreOptionPage {
  if (!object(value) || !Array.isArray(value.items) || value.items.length > 100
    || value.nextCursor !== null && (typeof value.nextCursor !== "string" || !/^\d{1,7}:\d{1,19}$/.test(value.nextCursor))) throw new Error("Invalid genre option page");
  const items = value.items.map(parseGenreOption);
  if (new Set(items.map(item => item.code)).size !== items.length || items.length === 0 && value.nextCursor !== null) throw new Error("Invalid genre option sequence");
  return { items, nextCursor: value.nextCursor };
}
