import { logoutFromBackend } from "@/features/auth/server/api";
import { clearAuthCookie } from "@/features/auth/server/cookies";
import { withAuthenticatedSession } from "@/features/auth/server/refresh";
import { apiErrorResponse } from "@/lib/server/api-error";
import { assertSameOrigin } from "@/lib/server/request-security";
import { readBrowserProof } from "@/features/auth/server/browser-proof";
import { readMutationSessionId } from "@/features/auth/server/mutation-input";

/** Redis 세션 해제 후 쿠키를 삭제하며 이미 인증이 끝난 요청에도 같은 결과를 반환한다. */
export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    // Access Token이 만료되면 브라우저가 갱신 전용 증명으로 갱신한 뒤 로그아웃을 한 번 다시 요청한다.
    // 만료·폐기·장애 응답은 새 로그인 쿠키를 지우지 않으며 브라우저가 로그인 이동/재시도를 판단한다.
    const proof = await readBrowserProof(request.clone());
    const sessionId = await readMutationSessionId(request);
    await withAuthenticatedSession(proof, logoutFromBackend, sessionId);
    await clearAuthCookie();
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
