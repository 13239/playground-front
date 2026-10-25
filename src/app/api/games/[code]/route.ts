import { readPublicGame } from "@/features/games/server/catalog";
import { ApiError, apiErrorResponse } from "@/lib/server/api-error";

/** 게임 화면의 표시 정보는 공개 상세로 읽고 신규 실행 인증 API와 분리한다. */
export async function GET(request: Request, context: { params: Promise<{ code: string }> }): Promise<Response> {
  try {
    if (new URL(request.url).search) throw new ApiError("INVALID_REQUEST_BODY");
    const { code } = await context.params;
    return Response.json(await readPublicGame(code, request.signal), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}
