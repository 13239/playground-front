import { getCurrentSession } from "@/features/auth/server/session";
import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { readBrowserProof } from "@/features/auth/server/browser-proof";

/** 세션 복원용 공개 정보만 반환하며 쿠키를 재발급하거나 세션 수명을 연장하지 않는다. */
export async function GET(request: Request): Promise<Response> {
  try {
    const session = await getCurrentSession(await readBrowserProof(request));
    if (!session) throw new ApiError("AUTHENTICATION_REQUIRED");
    return Response.json(session, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
