import { SignJWT } from "jose";
import { getBrowserKey } from "./browser-key";
import { AuthRequestError, requireSuccess } from "./error";
import { proofBody } from "../request-binding";
import { isDevHttpAuth } from "./environment";

type Purpose = "login" | "session";
type Nonce = Readonly<{ value: string; receivedAt: number; serverTime: number; validUntil: number; thumbprint: string }>;
const nonces = new Map<Purpose, Nonce>();

/** 탭에는 목적별 nonce 두 건만 보관한다. 인증 토큰이나 개인키 문자열을 저장하지 않는다. */
export function clearProofNonces(): void { nonces.clear(); }

async function nonceFor(purpose: Purpose, thumbprint: string, signal?: AbortSignal): Promise<Nonce> {
  signal?.throwIfAborted();
  const cached = nonces.get(purpose);
  if (cached && cached.thumbprint === thumbprint && performance.now() < cached.validUntil) return cached;
  const response = await requireSuccess(await fetch("/api/auth/proof-challenge", {
    method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error",
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(35_000)]) : AbortSignal.timeout(35_000),
    headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purpose, keyThumbprint: thumbprint }),
  }));
  const value: unknown = await response.json();
  if (typeof value !== "object" || value === null || !("nonce" in value) || typeof value.nonce !== "string"
    || value.nonce.length > 2048 || !("serverTime" in value) || typeof value.serverTime !== "string"
    || !("expiresAt" in value) || typeof value.expiresAt !== "string") throw new AuthRequestError("서비스 응답을 처리할 수 없습니다.", 502);
  const serverTime = Date.parse(value.serverTime);
  const lifetime = Date.parse(value.expiresAt) - serverTime;
  if (!Number.isFinite(serverTime) || !Number.isFinite(lifetime) || lifetime <= 5000 || lifetime > 60_000) {
    throw new AuthRequestError("서비스 응답을 처리할 수 없습니다.", 502);
  }
  const receivedAt = performance.now();
  const result = { value: value.nonce, serverTime, receivedAt, validUntil: receivedAt + lifetime - 5000, thumbprint };
  signal?.throwIfAborted();
  nonces.set(purpose, result);
  return result;
}

function base64url(value: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(value))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

/** 종료 시에는 비동기 키 읽기·nonce 발급을 기다릴 수 없으므로 본문에 결합한 증명을 미리 만들어 둔다. */
export type PreparedPageExit = Readonly<{ body: string; headers: Readonly<Record<string, string>>; validUntil: number }>;
export async function preparePageExit(input: Readonly<{
  sessionId: string; roomId: number; membershipId: string; pageId: string; tabId: string; action: "CLOSE" | "LEAVE";
}>): Promise<PreparedPageExit> {
  const body = JSON.stringify(input);
  if (isDevHttpAuth()) return { body, headers: { "Content-Type": "application/json" }, validUntil: performance.now() + 50_000 };
  const key = await getBrowserKey(false);
  const nonce = await nonceFor("session", key.thumbprint);
  const proof = await signBoundRequest("/api/gomoku/rooms/lifecycle", "POST", body, key, nonce);
  return { body, headers: { "Content-Type": "application/json", "X-Browser-Proof": proof }, validUntil: nonce.validUntil };
}

/** 일반 요청과 미리 준비한 종료 요청이 같은 메서드·경로·본문·세션 nonce 결합을 사용한다. */
async function signBoundRequest(path: string, method: string, body: string | undefined,
  key: Awaited<ReturnType<typeof getBrowserKey>>, nonce: Nonce): Promise<string> {
  return new SignJWT({ nonce: nonce.value, htm: method, htu: window.location.origin + path,
    bht: base64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(proofBody(path, body ?? "")))) })
    .setProtectedHeader({ alg: "ES256", typ: "bff-session-proof+jwt", jwk: key.publicKey })
    .setJti(crypto.randomUUID()).setIssuedAt(Math.floor((nonce.serverTime + performance.now() - nonce.receivedAt) / 1000))
    .sign(key.privateKey);
}

/** 요청마다 새로운 증명을 만든다. nonce 갱신은 서버가 실행 전에 거절한 경우에만 한 번 재시도한다. */
// 채팅 증명 발급의 실제 경로·메서드·세션 본문도 기존 로그인 키로 서명한다.
export async function signedAuthRequest(path: `/api/auth/${string}` | `/api/gomoku/${string}` | "/api/chat/tickets", input?: object, nonceRetry = true, signal?: AbortSignal): Promise<Response> {
  // 대국 접속 확인은 5초 안에 실패를 감지해 5회 재접속 예산을 지킨다. 스트림은 서버가 20초마다 정상 종료한다.
  const timeout = path === "/api/gomoku/rooms/state" ? 5_000 : 35_000;
  // 호출자의 취소와 인증/스트림 연결 단계의 제한 시간을 합쳐 요청 전체를 중단할 수 있게 한다.
  const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout);
  try {
    signal?.throwIfAborted();
    // 프로필도 동일 경로·메서드·본문에 서명한다. 조회는 GET, 캐릭터 변경은 멱등적인 PUT을 사용한다.
    // 오목 검색은 조건도 서명하도록 POST 본문을 쓰고 생성·닫기도 같은 인증 경계를 공유한다.
    const method = path === "/api/auth/session" || path === "/api/auth/profile" && input === undefined
      ? "GET" : path === "/api/auth/profile" ? "PUT" : "POST";
    // 원격 HTTP의 dev에서는 Web Crypto를 호출하지 않는다. 일반 BFF·JWT 검증은 서버에서 유지한다.
    if (isDevHttpAuth()) {
      return await requireSuccess(await fetch(path, {
        method, credentials: "same-origin", cache: "no-store", redirect: "error",
        signal: requestSignal, ...(input !== undefined && { headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }),
      }));
    }
    const purpose = path === "/api/auth/login" ? "login" : "session";
    const key = await getBrowserKey(purpose === "login");
    signal?.throwIfAborted();
    const nonce = await nonceFor(purpose, key.thumbprint, signal);
    const body = input === undefined ? undefined : JSON.stringify(input);
    const proof = await signBoundRequest(path, method, body, key, nonce);
    signal?.throwIfAborted();
    // 동일 Origin의 BFF만 호출하며 인증 토큰을 읽거나 브라우저 저장소에 보관하지 않는다.
    return await requireSuccess(await fetch(path, {
      method, credentials: "same-origin", cache: "no-store", redirect: "error", body,
      signal: requestSignal,
      headers: { "X-Browser-Proof": proof, ...(input !== undefined && { "Content-Type": "application/json" }) },
    }));
  } catch (error) {
    // 네트워크 오류로 포장하지 않아 종료된 스트림에 대한 자동 재시도가 발생하지 않는다.
    if (signal?.aborted) throw signal.reason;
    if (nonceRetry && error instanceof AuthRequestError
      && ["BROWSER_PROOF_EXPIRED", "BROWSER_PROOF_INVALID"].includes(error.code ?? "")) {
      clearProofNonces();
      return signedAuthRequest(path, input, false, signal);
    }
    if (error instanceof AuthRequestError) throw error;
    throw new AuthRequestError("서비스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.", 0);
  }
}
