import { filterCatalogResponse } from "@/features/games/server/filter-catalog";

/** 사용 중인 전체 유형만 기존 BFF 서버 인증으로 공개한다. */
export const runtime = "nodejs";
export const GET = filterCatalogResponse;
