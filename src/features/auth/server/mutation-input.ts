import "server-only";

import { ApiError } from "@/lib/server/api-error";
import { readJsonBody } from "@/lib/server/request-body";
import { isSessionId } from "../session-id";

/** 화면이 확인한 세션 ID를 작은 JSON 본문에서 읽는다. 본문은 별도의 브라우저 증명에도 결합된다. */
export async function readMutationSessionId(request: Request): Promise<string> {
  const value = await readJsonBody(request, 128);
  if (typeof value !== "object" || value === null || !("sessionId" in value) || !isSessionId(value.sessionId)) {
    throw new ApiError("INVALID_REQUEST_BODY");
  }
  return value.sessionId;
}
