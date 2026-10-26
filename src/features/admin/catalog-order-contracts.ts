import { gameCodePattern } from "@/features/games/contracts";
import { parseNumberedPage, type NumberedPage } from "./pagination-contracts";

/** 그리드 이동은 전체 순서 버전과 기준 행으로 표현해 페이지 밖 항목을 누락하거나 덮어쓰지 않는다. */
export type CatalogOrderItem = Readonly<{ code: string; name: string; sortOrder: number; version: number }>;
export type CatalogOrderPage = NumberedPage<CatalogOrderItem> & Readonly<{ version: number }>;
export type CatalogOrderResult = Readonly<{ version: number }>;
export type CatalogOrderMove = Readonly<{ code: string; beforeCode: string | null }>;
export type CatalogOrderRequest = Readonly<{ expectedVersion: number; moves: readonly CatalogOrderMove[] }>;

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function version(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function parseItem(value: unknown): CatalogOrderItem {
  if (!object(value) || typeof value.code !== "string" || !gameCodePattern.test(value.code)
    || typeof value.name !== "string" || value.name.length > 100 || !version(value.sortOrder) || value.sortOrder > 1_000_000
    || !version(value.version)) throw new Error("Invalid catalog order item");
  return { code: value.code, name: value.name, sortOrder: value.sortOrder, version: value.version };
}

/** 순서 페이지의 번호·연속 위치·중복·버전을 검증하고 허용된 필드만 전달한다. */
export function parseCatalogOrderPage(value: unknown): CatalogOrderPage {
  const page = parseNumberedPage(value, parseItem, [10, 20, 30, 40, 50]);
  const result = parseCatalogOrderResult(value);
  const offset = (page.page - 1) * page.size;
  if (page.items.length !== Math.min(page.size, page.totalElements - offset)
    || new Set(page.items.map(item => item.code)).size !== page.items.length
    || page.items.some((item, index) => item.sortOrder !== offset + index)) throw new Error("Invalid catalog order page");
  return { ...page, version: result.version };
}

export function parseCatalogOrderResult(value: unknown): CatalogOrderResult {
  if (!object(value) || !version(value.version)) throw new Error("Invalid catalog order version");
  return { version: value.version };
}
