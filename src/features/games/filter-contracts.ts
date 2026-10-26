/** 관리·홈·게임 편집이 같은 DB 필터 코드와 표시 이름을 공유한다. */
export const filterTypes = ["GENRE", "PLAYERS", "GRAPHICS"] as const;
export type GameFilterType = typeof filterTypes[number];
export const filterTypeNames = { GENRE: "장르", PLAYERS: "플레이 인원", GRAPHICS: "그래픽" } as const;
export const filterIcons = ["gamepad", "puzzle", "car", "swords", "board", "city", "user", "users", "2d", "cube", "grid"] as const;
export type FilterIcon = typeof filterIcons[number];
export type GameFilter = Readonly<{
  code: string; labelCode: string; name: string; type: GameFilterType; icon: FilterIcon; enabled: boolean; sortOrder: number;
  minPlayers: number | null; maxPlayers: number | null; graphicsType: "TWO_D" | "THREE_D" | null;
}>;
export type GameFilterPage = Readonly<{ items: readonly GameFilter[]; nextCursor: string | null }>;
const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const integer = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
export function parseGameFilter(value: unknown): GameFilter {
  if (!object(value) || typeof value.code !== "string" || !/^[A-Z][A-Z0-9_]{0,63}$/.test(value.code)
    || typeof value.name !== "string" || !value.name.trim() || value.name.length > 50
    || !filterTypes.some(type => type === value.type) || !filterIcons.some(icon => icon === value.icon)
    || value.labelCode !== `${value.type}:${value.code}` || typeof value.enabled !== "boolean" || !integer(value.sortOrder) || value.sortOrder > 1_000_000) throw new Error("Invalid game filter");
  const min = value.minPlayers ?? null, max = value.maxPlayers ?? null, graphics = value.graphicsType ?? null;
  if (value.type === "GENRE" && (min !== null || max !== null || graphics !== null)
    || value.type === "PLAYERS" && (!integer(min) || !integer(max) || min < 1 || min > max || max > 10000 || graphics !== null)
    || value.type === "GRAPHICS" && (min !== null || max !== null || graphics !== "TWO_D" && graphics !== "THREE_D")) throw new Error("Invalid filter conditions");
  return { code: value.code, labelCode: value.labelCode as string, name: value.name, type: value.type as GameFilterType,
    icon: value.icon as FilterIcon, enabled: value.enabled, sortOrder: value.sortOrder,
    minPlayers: min as number | null, maxPlayers: max as number | null, graphicsType: graphics as GameFilter["graphicsType"] };
}
export function isGameFilter(value: unknown): value is GameFilter { try { parseGameFilter(value); return true; } catch { return false; } }
export function parseGameFilterPage(value: unknown): GameFilterPage {
  if (!object(value) || !Array.isArray(value.items) || value.items.length > 100
    || value.nextCursor != null && (typeof value.nextCursor !== "string" || !/^\d{1,7}:\d{1,19}$/.test(value.nextCursor))) throw new Error("Invalid filter page");
  const items = value.items.map(parseGameFilter);
  if (new Set(items.map(f => f.code)).size !== items.length || items.length === 0 && value.nextCursor) throw new Error("Invalid filter sequence");
  return { items, nextCursor: value.nextCursor as string | null ?? null };
}
