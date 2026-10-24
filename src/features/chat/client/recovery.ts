import { AuthRequestError } from "@/features/auth/client/error";

const sessionErrors = new Set([
  "AUTHENTICATION_REQUIRED", "INVALID_SESSION", "INVALID_REFRESH_TOKEN", "REFRESH_TOKEN_REUSED",
  "BROWSER_KEY_REQUIRED", "ACCESS_RESTRICTED", "LOGIN_SESSION_CHANGED", "SESSION_REFRESH_REQUIRED", "INVALID_ACCESS_TOKEN",
]);

/** 채팅 티켓·채팅 증명 거절을 로그인 만료로 확대하지 않고 서버의 명시적인 세션 오류만 재확인한다. */
export function chatRecovery(error: unknown): "session" | "ticket" | "stop" | "retry" {
  if (!(error instanceof AuthRequestError)) return "retry";
  if (sessionErrors.has(error.code ?? "")) return "session";
  if (error.code === "CHAT_TICKET_INVALID") return "ticket";
  // 방 참가 권한·채팅 키 증명·설정 거절은 자동 요청을 반복하지 않고 해당 채팅에서 재시도를 제공한다.
  if (error.status === 401 || error.status === 403 || error.code === "CHAT_CONFIGURATION_ERROR") return "stop";
  return "retry";
}
