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

async function nonceFor(purpose: Purpose, thumbprint: string): Promise<Nonce> {
  const cached = nonces.get(purpose);
  if (cached && cached.thumbprint === thumbprint && performance.now() < cached.validUntil) return cached;
  const response = await requireSuccess(await fetch("/api/auth/proof-challenge", {
    method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error",
    signal: AbortSignal.timeout(35_000),
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
  nonces.set(purpose, result);
  return result;
}

function base64url(value: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(value))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

/** 요청마다 새로운 증명을 만든다. nonce 갱신은 서버가 실행 전에 거절한 경우에만 한 번 재시도한다. */
export async function signedAuthRequest(path: `/api/auth/${string}`, input?: object, nonceRetry = true): Promise<Response> {
  try {
    // 프로필도 동일 경로·메서드·본문에 서명한다. 조회는 GET, 캐릭터 변경은 멱등적인 PUT을 사용한다.
    const method = path === "/api/auth/session" || path === "/api/auth/profile" && input === undefined
      ? "GET" : path === "/api/auth/profile" ? "PUT" : "POST";
    // 원격 HTTP의 dev에서는 Web Crypto를 호출하지 않는다. 일반 BFF·JWT 검증은 서버에서 유지한다.
    if (isDevHttpAuth()) {
      return await requireSuccess(await fetch(path, {
        method, credentials: "same-origin", cache: "no-store", redirect: "error",
        signal: AbortSignal.timeout(35_000), ...(input !== undefined && { headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }),
      }));
    }
    const purpose = path === "/api/auth/login" ? "login" : "session";
    const key = await getBrowserKey(purpose === "login");
    const nonce = await nonceFor(purpose, key.thumbprint);
    const body = input === undefined ? undefined : JSON.stringify(input);
    const proof = await new SignJWT({ nonce: nonce.value, htm: method, htu: window.location.origin + path,
      bht: base64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(proofBody(path, body ?? "")))) })
      .setProtectedHeader({ alg: "ES256", typ: "bff-session-proof+jwt", jwk: key.publicKey })
      .setJti(crypto.randomUUID()).setIssuedAt(Math.floor((nonce.serverTime + performance.now() - nonce.receivedAt) / 1000))
      .sign(key.privateKey);
    // 동일 Origin의 BFF만 호출하며 인증 토큰을 읽거나 브라우저 저장소에 보관하지 않는다.
    return await requireSuccess(await fetch(path, {
      method, credentials: "same-origin", cache: "no-store", redirect: "error", body,
      signal: AbortSignal.timeout(35_000),
      headers: { "X-Browser-Proof": proof, ...(input !== undefined && { "Content-Type": "application/json" }) },
    }));
  } catch (error) {
    if (nonceRetry && error instanceof AuthRequestError
      && ["BROWSER_PROOF_EXPIRED", "BROWSER_PROOF_INVALID"].includes(error.code ?? "")) {
      clearProofNonces();
      return signedAuthRequest(path, input, false);
    }
    if (error instanceof AuthRequestError) throw error;
    throw new AuthRequestError("서비스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.", 0);
  }
}
