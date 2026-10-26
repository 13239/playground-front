/** 새 관리 화면은 번호 페이지 계약과 네 가지 표시 개수를 공유한다. */
export const PAGE_SIZES = [10, 20, 30, 50] as const;
export type NumberedPage<T> = Readonly<{ items: readonly T[]; page: number; size: number; totalPages: number; totalElements: number }>;
const integer = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

/** 집계·범위가 맞는 응답에서 허용된 항목만 복사하고 임의의 추가 필드는 전달하지 않는다. */
export function parseNumberedPage<T>(value: unknown, parse: (item: unknown) => T, sizes: readonly number[] = PAGE_SIZES): NumberedPage<T> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Invalid numbered page");
  const page = value as Record<string, unknown>;
  if (!integer(page.page) || page.page < 1 || !integer(page.size) || !sizes.some(size => size === page.size)
    || !integer(page.totalPages) || page.totalPages < 1 || page.page > page.totalPages || !integer(page.totalElements)
    || page.totalPages !== Math.max(1, Math.ceil(page.totalElements / page.size))
    || !Array.isArray(page.items) || page.items.length > page.size || page.items.length > page.totalElements) throw new Error("Invalid numbered page");
  return { items: page.items.map(parse), page: page.page, size: page.size, totalPages: page.totalPages, totalElements: page.totalElements };
}
