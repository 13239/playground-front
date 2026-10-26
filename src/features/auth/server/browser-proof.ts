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
  // 기존 보호 API는 검색 조건도 서명 본문으로 받는다. 관리자 REST는 Spring에서 전체 쿼리를 서명과 대조한다.
  const admin = url.pathname.startsWith("/api/admin/");
  if (url.search && !admin || url.href.length > 2048) throw new ApiError("INVALID_REQUEST_BODY");
  // dev의 원격 HTTP에서만 개인키 검증을 생략한다. 브라우저가 보낸 플래그나 헤더로 결정하지 않는다.
  if (getAppEnvironment() === "dev") return undefined;
  const value = request.headers.get("X-Browser-Proof");
  if (!value || value.length > 4096 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) {
    throw new ApiError("BROWSER_PROOF_INVALID");
  }
  const reader = request.body?.getReader();
  // 로그인과 방 생성은 비밀번호를 제외한 본문을 다시 구성해 브라우저와 같은 해시를 계산한다.
  // 입장 비밀번호에도 로그인·방 생성과 같은 본문 결합 정책을 적용한다.
  // 비밀번호 변경 원문도 로그인과 같이 빠른 증명 해시에서 제외한다.
  // 방 설정 변경의 새 비밀번호도 브라우저와 동일하게 빠른 해시에서 제외한다.
  const sensitiveBody = url.pathname === "/api/auth/login" || url.pathname === "/api/auth/password"
    || url.pathname === "/api/gomoku/rooms" || url.pathname === "/api/gomoku/rooms/join" || url.pathname === "/api/gomoku/rooms/settings";
  const credentialBody: Buffer[] = [];
  const hash = createHash("sha256");
  let size = 0;
  try {
    if (reader) while (true) {
      const { value: chunk, done } = await reader.read();
      if (done) break;
      size += chunk.byteLength;
      // 관리자 설명과 테트리스 종료 리플레이만 별도 상한을 쓴다. 인증·다른 게임의 작은 본문 제한은 유지한다.
      // 게임 정보의 장르·카드 라벨·한글 설명은 BFF 본문 검증과 같은 32KiB 한도를 사용한다.
      const gameMetadata = /^\/api\/admin\/games(?:\/[A-Z][A-Z0-9_]{0,63})?$/.test(url.pathname);
      const limit = url.pathname === "/api/tetris/finish" ? 300_000 : gameMetadata ? 32768 : admin ? 16384 : 4096;
      if (size > limit) throw new ApiError("PAYLOAD_TOO_LARGE");
      if (sensitiveBody) credentialBody.push(Buffer.from(chunk));
      else hash.update(chunk);
    }
    if (sensitiveBody) hash.update(proofBody(url.pathname, Buffer.concat(credentialBody).toString("utf8")));
    return { value, bodyHash: hash.digest("base64url") };
  } catch (error) {
    if (reader) void reader.cancel().catch(() => {});
    throw error instanceof ApiError ? error : new ApiError("INVALID_REQUEST_BODY");
  } finally { reader?.releaseLock(); }
}
