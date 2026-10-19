import { logoutFromBackend } from "@/features/auth/server/api";
import { clearAuthCookie } from "@/features/auth/server/cookies";
import { withAuthenticatedSession } from "@/features/auth/server/refresh";
import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { assertSameOrigin } from "@/lib/server/request-security";

/** Redis 세션 해제 후 쿠키를 삭제하며 이미 인증이 끝난 요청에도 같은 결과를 반환한다. */
export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    try {
      // Access Token이 만료되었어도 한 번 갱신하여 Redis의 실제 세션까지 삭제한다.
      await withAuthenticatedSession(logoutFromBackend);
    } catch (error) {
      // 만료·폐기된 인증의 쿠키는 정리하되 장애 시에는 재시도를 위해 쿠키를 보존한다.
      if (!(error instanceof ApiError && error.status === 401)) throw error;
    }
    await clearAuthCookie();
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
