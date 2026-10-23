import { catalogResponse } from "@/features/games/server/catalog";
import { apiErrorResponse } from "@/lib/server/api-error";

/** 장르도 DB의 현재 사용 여부와 정렬 순서를 읽으며 고정된 프론트 enum으로 제한하지 않는다. */
export async function GET(request: Request): Promise<Response> {
  try { return await catalogResponse(request, true); } catch (error) { return apiErrorResponse(error); }
}
