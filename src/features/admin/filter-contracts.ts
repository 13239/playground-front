import { parseGameFilter, type GameFilter } from "@/features/games/filter-contracts";
import { parseNumberedPage } from "./pagination-contracts";
export const FILTER_PAGE_SIZES = [20, 30, 40, 50] as const;
export type AdminGameFilter = GameFilter & Readonly<{ version: number; gameCount: number }>;
const number = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
/** 관리 응답은 편집 버전·연결 수까지 검증하고 공개 응답과 구분한다. */
export function parseAdminGameFilter(value: unknown): AdminGameFilter {
  const item = parseGameFilter(value);
  if (typeof value !== "object" || value === null || !("version" in value) || !("gameCount" in value) || !number(value.version) || !number(value.gameCount)) throw new Error("Invalid admin game filter");
  return { ...item, version: value.version, gameCount: value.gameCount };
}
export function parseFilterGrid(value: unknown) {
  const page = parseNumberedPage(value, parseAdminGameFilter, FILTER_PAGE_SIZES);
  if (typeof value !== "object" || value === null || !("orderVersion" in value) || !number(value.orderVersion)
    || page.items.length !== Math.min(page.size, page.totalElements - (page.page - 1) * page.size)) throw new Error("Invalid filter grid");
  return { ...page, orderVersion: value.orderVersion };
}
