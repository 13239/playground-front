import "server-only";

import { createHash } from "node:crypto";
import { ApiError } from "@/lib/server/api-error";
import { proofBody } from "../request-binding";
import { getAppEnvironment } from "@/lib/server/env";

/** Spring이 검증할 증명과 BFF가 실제 브라우저 본문에서 계산한 해시다. */
export type BrowserRequestProof = Readonly<{ value: string; bodyHash: string }> | undefined;

/** local/prod는 읽기 요청도 키 증명이 필요하다. 작은 본문만 읽고 서버에서 만든 토큰·식별자는 해시에 포함하지 않는다. */
export async function readBrowserProof(request: Request): Promise<BrowserRequestProof> {
  const url = new URL(request.url);
  // 현재 인증 API는 쿼리를 받지 않는다. 서명하지 않은 쿼리가 동작을 바꾸는 경로를 허용하지 않는다.
  if (url.search) throw new ApiError("INVALID_REQUEST_BODY");
  // dev의 원격 HTTP에서만 개인키 검증을 생략한다. 브라우저가 보낸 플래그나 헤더로 결정하지 않는다.
  if (getAppEnvironment() === "dev") return undefined;
  const value = request.headers.get("X-Browser-Proof");
  if (!value || value.length > 4096 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) {
    throw new ApiError("BROWSER_PROOF_INVALID");
  }
  const reader = request.body?.getReader();
  const loginBody: Buffer[] = [];
  const hash = createHash("sha256");
  let size = 0;
  try {
    if (reader) while (true) {
      const { value: chunk, done } = await reader.read();
      if (done) break;
      size += chunk.byteLength;
      if (size > 4096) throw new ApiError("PAYLOAD_TOO_LARGE");
      if (url.pathname === "/api/auth/login") loginBody.push(Buffer.from(chunk));
      else hash.update(chunk);
    }
    if (url.pathname === "/api/auth/login") hash.update(proofBody(url.pathname, Buffer.concat(loginBody).toString("utf8")));
    return { value, bodyHash: hash.digest("base64url") };
  } catch (error) {
    if (reader) void reader.cancel().catch(() => {});
    throw error instanceof ApiError ? error : new ApiError("INVALID_REQUEST_BODY");
  } finally { reader?.releaseLock(); }
}
