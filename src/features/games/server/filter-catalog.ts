import "server-only";
import { backendRequest } from "@/lib/server/backend-client";
import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { parseGameFilterPage } from "../filter-contracts";

/** 공개 검색어·커서·상한만 전달하고 관리 버전·게임 연결 수는 공개하지 않는다. */
export async function filterCatalogResponse(request: Request): Promise<Response> {
  try {
    const params = new URL(request.url).searchParams;
    if ([...params.keys()].some(key => !["query", "cursor", "limit"].includes(key) || params.getAll(key).length !== 1)
      || (params.get("query")?.length ?? 0) > 100
      || params.has("cursor") && !/^\d{1,7}:\d{1,19}$/.test(params.get("cursor")!)
      || params.has("limit") && !/^(?:[1-9]|[1-9]\d|100)$/.test(params.get("limit")!)) throw new ApiError("INVALID_REQUEST_BODY");
    const page = parseGameFilterPage(await backendRequest(`/api/game-filters${params.size ? `?${params}` : ""}`, { signal: request.signal }));
    if (page.items.some(filter => !filter.enabled)) throw new ApiError("INVALID_BACKEND_RESPONSE");
    return Response.json(page, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}
