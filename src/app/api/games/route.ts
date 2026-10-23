import { catalogResponse } from "@/features/games/server/catalog";
import { apiErrorResponse } from "@/lib/server/api-error";

/** 개인 정보 없는 카탈로그만 공개하며 게임 실행은 별도 인증 경계를 사용한다. */
export async function GET(request: Request): Promise<Response> {
  try { return await catalogResponse(request); } catch (error) { return apiErrorResponse(error); }
}
