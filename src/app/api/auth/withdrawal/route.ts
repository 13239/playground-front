import { readBrowserProof } from "@/features/auth/server/browser-proof";
import { clearAuthCookie } from "@/features/auth/server/cookies";
import { withAuthenticatedSession } from "@/features/auth/server/refresh";
import { isSessionId } from "@/features/auth/session-id";
import { validateAccountWithdrawal, type AccountWithdrawalInput } from "@/features/auth/withdrawal-validation";
import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { backendRequest } from "@/lib/server/backend-client";
import { getClientUserAgent } from "@/lib/server/client-user-agent";
import { readJsonBody } from "@/lib/server/request-body";
import { assertSameOrigin } from "@/lib/server/request-security";

/** 본인 세션·Origin·브라우저 증명을 검사하고 실제 탈퇴 성공 뒤에만 인증 쿠키를 삭제한다. */
export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const proof = await readBrowserProof(request.clone());
    const input = await readJsonBody(request, 1024);
    if (typeof input !== "object" || input === null || Array.isArray(input)
      || Object.keys(input).some(key => key !== "sessionId" && key !== "currentPassword")
      || !("sessionId" in input) || !isSessionId(input.sessionId)) throw new ApiError("INVALID_REQUEST_BODY");
    const fieldErrors = validateAccountWithdrawal(input);
    if (Object.keys(fieldErrors).length) throw new ApiError("VALIDATION_FAILED", { fieldErrors });
    const { currentPassword } = input as AccountWithdrawalInput & { sessionId: string };
    await withAuthenticatedSession(proof, (accessToken, proof) => backendRequest("/api/auth/withdrawal", {
      method: "POST", body: { currentPassword }, accessToken, proof, responseType: "empty", userAgent: getClientUserAgent(request),
    }), input.sessionId);
    await clearAuthCookie();
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}
