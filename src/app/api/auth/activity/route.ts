import { reportActivityToBackend } from "@/features/auth/server/api";
import { updateAuthCookieExpiry } from "@/features/auth/server/cookies";
import { readBrowserProof } from "@/features/auth/server/browser-proof";
import { withAuthenticatedSession } from "@/features/auth/server/refresh";
import { apiErrorResponse } from "@/lib/server/api-error";
import { assertSameOrigin } from "@/lib/server/request-security";
import { readMutationSessionId } from "@/features/auth/server/mutation-input";

/** 키를 증명한 실제 활동만 Redis와 쿠키 만료에 함께 반영한다. 자동 갱신에서는 호출하지 않는다. */
export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const proof = await readBrowserProof(request.clone());
    const sessionId = await readMutationSessionId(request);
    const activity = await withAuthenticatedSession(proof, reportActivityToBackend, sessionId);
    await updateAuthCookieExpiry(activity);
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}
