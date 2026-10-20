import { readAuthCookie } from "@/features/auth/server/cookies";
import { refreshSessionCookie } from "@/features/auth/server/refresh";
import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { assertSameOrigin } from "@/lib/server/request-security";
import { readBrowserProof } from "@/features/auth/server/browser-proof";

/** 자동 복원용 POST. 토큰을 반환하거나 사용자 활동으로 세션 수명을 연장하지 않는다. */
export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const session = await readAuthCookie();
    if (!session) throw new ApiError("AUTHENTICATION_REQUIRED");
    // 다른 탭의 갱신 여부 확인은 브라우저 잠금 안의 별도 GET 증명으로 수행한다. 여기서는 POST 증명을 갱신에만 쓴다.
    await refreshSessionCookie(session, await readBrowserProof(request));
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    // 늦게 도착한 실패 응답이 다른 요청의 새 쿠키를 지우지 않도록 여기서는 쿠키를 삭제하지 않는다.
    return apiErrorResponse(error);
  }
}
