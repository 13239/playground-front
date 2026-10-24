type DiagnosticPhase = "auth-lock" | "session" | "token-refresh" | "chat-ticket" | "chat-authentication" | "chat-connection";
const phases = new Set<DiagnosticPhase>(["auth-lock", "session", "token-refresh", "chat-ticket", "chat-authentication", "chat-connection"]);
const codes = new Set([
  "AUTH_LOCK_WAIT_TIMEOUT", "AUTH_REQUEST_TIMEOUT", "AUTH_STORAGE_UNAVAILABLE", "NETWORK_UNAVAILABLE",
  "AUTH_SERVICE_UNAVAILABLE", "BACKEND_UNAVAILABLE", "BACKEND_TIMEOUT", "INVALID_BACKEND_RESPONSE", "SERVER_CONFIGURATION_ERROR",
  "CHAT_TICKET_INVALID", "CHAT_PROOF_INVALID", "CHAT_CONNECTION_TIMEOUT", "CHAT_CONNECTION_UNAVAILABLE",
  "CHAT_CONNECTION_RATE_LIMIT_EXCEEDED", "CHAT_PROTOCOL_INVALID",
  "CHAT_ROOM_ACCESS_DENIED", "CHAT_CONFIGURATION_ERROR", "CHAT_TICKET_RATE_LIMIT_EXCEEDED", "CHAT_SERVICE_UNAVAILABLE",
  "BROWSER_KEY_REQUIRED", "BROWSER_PROOF_INVALID", "BROWSER_PROOF_EXPIRED", "BROWSER_PROOF_REPLAYED", "BROWSER_PROOF_RATE_LIMIT_EXCEEDED",
  "INVALID_SESSION", "ACCESS_RESTRICTED", "AUTHENTICATION_REQUIRED", "INVALID_REFRESH_TOKEN", "REFRESH_TOKEN_REUSED",
  "LOGIN_SESSION_CHANGED", "SESSION_REFRESH_REQUIRED", "INVALID_ACCESS_TOKEN", "ACCESS_DENIED", "INVALID_ORIGIN",
]);
const logged = new Map<string, number>();

/** 고정 단계·허용한 코드·상태만 기록한다. 토큰·세션·계정·URL·메시지·예외 원문은 인자로 받지 않는다. */
export function reportConnectionIssue(phase: DiagnosticPhase, code?: string, status = 0): void {
  if (!phases.has(phase)) return;
  const safeCode = code && codes.has(code) ? code : "UNCLASSIFIED";
  const safeStatus = Number.isInteger(status) && status >= 0 && status <= 599 ? status : 0;
  const key = `${phase}:${safeCode}:${safeStatus}`;
  const now = Date.now();
  if (now - (logged.get(key) ?? Number.NEGATIVE_INFINITY) < 30_000) return;
  logged.delete(key);
  logged.set(key, now);
  // 재접속 실패가 이어져도 같은 경고는 30초에 한 번만 남기고 문서당 최대 32개 키만 유지한다.
  if (logged.size > 32) { const oldest = logged.keys().next().value; if (oldest !== undefined) logged.delete(oldest); }
  try { console.warn("[Playground connection]", { phase, code: safeCode, status: safeStatus, at: new Date(now).toISOString() }); }
  catch { /* 진단 출력을 사용할 수 없어도 로그인·채팅 복구 흐름을 바꾸지 않는다. */ }
}
