/** DB 카탈로그의 공개 계약이다. 실행 URL은 포함하지 않고 코드 등록 목록에서 결정한다. */
export type CatalogGenre = Readonly<{ code: string; name: string; sortOrder: number }>;
export type CatalogMode = Readonly<{
  code: string; name: string; graphicsType: "TWO_D" | "THREE_D"; connectionType: "LOCAL" | "ONLINE";
  interactionType: "SOLO" | "COMPETITIVE" | "COOPERATIVE"; minHumanPlayers: number; maxHumanPlayers: number;
  published: boolean; availability: "AVAILABLE" | "MAINTENANCE" | "DISABLED"; unavailableMessage: string; supported: boolean;
}>;
export type CatalogGame = Readonly<{
  code: string; name: string; summary: string; description: string; published: boolean;
  availability: CatalogMode["availability"]; unavailableMessage: string; firstPublishedAt: string | null;
  genres: readonly CatalogGenre[]; modes: readonly CatalogMode[];
}>;
export type CatalogPage = Readonly<{ items: readonly CatalogGame[]; nextCursor: string | null }>;
export type GenrePage = Readonly<{ items: readonly CatalogGenre[]; nextCursor: string | null }>;
export const gameCodePattern = /^[A-Z][A-Z0-9_]{0,63}$/;
const cursorPattern = /^\d{1,7}:\d{1,19}$/;
const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown, max: number): value is string => typeof value === "string" && value.length <= max;
const integer = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value);
const code = (value: unknown): value is string => typeof value === "string" && gameCodePattern.test(value);
const availability = (value: unknown): value is CatalogMode["availability"] => value === "AVAILABLE" || value === "MAINTENANCE" || value === "DISABLED";
const cursor = (value: unknown): value is string | null => value === null || typeof value === "string" && cursorPattern.test(value);

export function isCatalogMode(value: unknown): value is CatalogMode {
  return object(value) && code(value.code) && text(value.name, 100) && (value.graphicsType === "TWO_D" || value.graphicsType === "THREE_D")
    && (value.connectionType === "LOCAL" || value.connectionType === "ONLINE")
    && ["SOLO", "COMPETITIVE", "COOPERATIVE"].includes(String(value.interactionType))
    && integer(value.minHumanPlayers) && integer(value.maxHumanPlayers) && value.minHumanPlayers >= 1
    && value.maxHumanPlayers >= value.minHumanPlayers && value.maxHumanPlayers <= 10000
    && typeof value.published === "boolean" && availability(value.availability) && text(value.unavailableMessage, 300) && typeof value.supported === "boolean";
}
function isGenre(value: unknown): value is CatalogGenre {
  return object(value) && code(value.code) && text(value.name, 50) && integer(value.sortOrder) && value.sortOrder >= 0 && value.sortOrder <= 1000000;
}
export function isCatalogGame(value: unknown): value is CatalogGame {
  return object(value) && code(value.code) && text(value.name, 100) && text(value.summary, 160) && text(value.description, 2000)
    && typeof value.published === "boolean" && availability(value.availability) && text(value.unavailableMessage, 300)
    && (value.firstPublishedAt === null || typeof value.firstPublishedAt === "string" && Number.isFinite(Date.parse(value.firstPublishedAt)))
    && Array.isArray(value.genres) && value.genres.every(isGenre) && Array.isArray(value.modes) && value.modes.every(isCatalogMode);
}
export function isCatalogPage(value: unknown): value is CatalogPage {
  return object(value) && Array.isArray(value.items) && value.items.length <= 100 && value.items.every(isCatalogGame) && cursor(value.nextCursor);
}
export function isGenrePage(value: unknown): value is GenrePage {
  return object(value) && Array.isArray(value.items) && value.items.length <= 100 && value.items.every(isGenre) && cursor(value.nextCursor);
}
/** 백엔드에 새 관리 필드가 생겨도 공개 BFF 응답에 자동으로 복사하지 않는다. */
export function publicMode(mode: CatalogMode): CatalogMode {
  return { code: mode.code, name: mode.name, graphicsType: mode.graphicsType, connectionType: mode.connectionType,
    interactionType: mode.interactionType, minHumanPlayers: mode.minHumanPlayers, maxHumanPlayers: mode.maxHumanPlayers,
    published: mode.published, availability: mode.availability, unavailableMessage: mode.unavailableMessage, supported: mode.supported };
}
export function publicGame(game: CatalogGame): CatalogGame {
  return { code: game.code, name: game.name, summary: game.summary, description: game.description,
    published: game.published, availability: game.availability, unavailableMessage: game.unavailableMessage, firstPublishedAt: game.firstPublishedAt,
    genres: game.genres.map(genre => ({ code: genre.code, name: genre.name, sortOrder: genre.sortOrder })), modes: game.modes.map(publicMode) };
}
