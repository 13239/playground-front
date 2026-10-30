import { randomUUID } from "node:crypto";
import { assertSameOrigin } from "@/lib/server/request-security";
import { readJsonBody } from "@/lib/server/request-body";
import { getTrustedClientIp } from "@/lib/server/client-ip";
import { getClientUserAgent } from "@/lib/server/client-user-agent";
import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { newLoginReport, queueLoginFailure, safeLoginUsername } from "@/features/auth/server/login-audit";

const reasons = new Set(["BROWSER_KEY_REQUIRED", "AUTH_STORAGE_UNAVAILABLE", "AUTH_LOCK_WAIT_TIMEOUT", "AUTH_REQUEST_TIMEOUT",
  "LOGIN_SESSION_CHANGED", "BROWSER_PROOF_INVALID", "BACKEND_UNAVAILABLE", "BACKEND_TIMEOUT", "AUTH_SERVICE_UNAVAILABLE", "NETWORK_ERROR", "UNEXPECTED_LOGIN_FAILURE"]);
const budgets = new Map<string, { until: number; count: number }>();

/** 브라우저 보고는 미검증 진단으로만 저장한다. 동일 Origin·작은 고정 계약·IP 예산을 강제한다. */
export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const value = await readJsonBody(request, 1024);
    if (typeof value !== "object" || value === null || Array.isArray(value)) throw new ApiError("INVALID_REQUEST_BODY");
    const input = value as Record<string, unknown>;
    if (Object.keys(input).some(key => !["username", "reason"].includes(key)) || typeof input.reason !== "string" || !reasons.has(input.reason)
      || input.username !== undefined && safeLoginUsername(input.username) === undefined) throw new ApiError("INVALID_REQUEST_BODY");
    const clientIp = getTrustedClientIp(request), key = clientIp || "unknown", now = Date.now();
    for (const [ip, budget] of budgets) if (budget.until < now) budgets.delete(ip);
    const budget = budgets.get(key) ?? { until: now + 60000, count: 0 };
    if (budget.count >= 30 || budgets.size >= 1000 && !budgets.has(key)) throw new ApiError("LOGIN_SERVER_ERROR");
    budget.count++; budgets.set(key, budget);
    const report = newLoginReport({ attemptId: randomUUID(), started: now, stage: "BROWSER_LOGIN_PREPARATION", error: new ApiError("INTERNAL_ERROR"),
      source: "BROWSER", username: safeLoginUsername(input.username), clientIp, userAgent: getClientUserAgent(request) });
    await queueLoginFailure({ ...report, reason: input.reason, httpStatus: 0 });
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch { return apiErrorResponse(new ApiError("LOGIN_SERVER_ERROR")); }
}
