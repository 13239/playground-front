import { getSessionFromBackend } from "@/features/auth/server/api";
import { readAuthCookie } from "@/features/auth/server/cookies";
import { refreshSessionCookie } from "@/features/auth/server/refresh";
import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { assertSameOrigin } from "@/lib/server/request-security";

/** 자동 복원용 POST. 토큰을 반환하거나 사용자 활동으로 세션 수명을 연장하지 않는다. */
export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const session = await readAuthCookie();
    if (!session) throw new ApiError("AUTHENTICATION_REQUIRED");
    let needsRefresh = session.accessTokenExpiresAt <= Date.now();
    if (!needsRefresh) {
      try {
        // 다른 탭이 이미 쿠키를 갱신했다면 현재 Redis 세션만 확인하고 다시 회전하지 않는다.
        await getSessionFromBackend(session.accessToken);
      } catch (error) {
        if (!(error instanceof ApiError && error.code === "INVALID_ACCESS_TOKEN")) throw error;
        needsRefresh = true;
      }
    }
    if (needsRefresh) await refreshSessionCookie(session);
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    // 늦게 도착한 실패 응답이 다른 요청의 새 쿠키를 지우지 않도록 여기서는 쿠키를 삭제하지 않는다.
    return apiErrorResponse(error);
  }
}
