"use client";

import { AuthRequestError } from "./error";

const allowed = new Set(["BROWSER_KEY_REQUIRED", "AUTH_STORAGE_UNAVAILABLE", "AUTH_LOCK_WAIT_TIMEOUT",
  "AUTH_REQUEST_TIMEOUT", "LOGIN_SESSION_CHANGED", "BROWSER_PROOF_INVALID", "BACKEND_UNAVAILABLE",
  "BACKEND_TIMEOUT", "AUTH_SERVICE_UNAVAILABLE", "NETWORK_ERROR", "UNEXPECTED_LOGIN_FAILURE"]);
const pending: { username?: string; reason: string }[] = [];
let sending = false, listening = false;
let retry: ReturnType<typeof setTimeout> | undefined;

/** 브라우저 준비 실패만 보고한다. 비밀번호는 인자로 받지 않고 브라우저 영속 저장소도 사용하지 않는다. */
export function reportLoginPreparationFailure(username: string, error: unknown): void {
  const code = error instanceof AuthRequestError ? error.code : undefined;
  const reason = code && allowed.has(code) ? code : error instanceof AuthRequestError && error.status === 0 ? "NETWORK_ERROR" : "UNEXPECTED_LOGIN_FAILURE";
  if (pending.length >= 20) pending.shift();
  pending.push({ ...(username.length <= 50 && !/[\p{Cc}\p{Cf}]/u.test(username) && { username }), reason });
  if (!listening) { window.addEventListener("online", () => void deliver()); listening = true; }
  void deliver();
}
async function deliver(): Promise<void> {
  if (sending || !pending.length) return;
  sending = true;
  try {
    while (pending.length) {
      const response = await fetch("/api/auth/login-failure", { method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(pending[0]), keepalive: true, signal: AbortSignal.timeout(3000) });
      if (response.ok || response.status >= 400 && response.status < 500) pending.shift(); else break;
    }
  } catch { /* 연결 복구 후 같은 문서가 살아 있는 동안만 다시 시도한다. */ }
  finally {
    sending = false;
    if (pending.length && !retry) retry = setTimeout(() => { retry = undefined; void deliver(); }, 15000);
  }
}
