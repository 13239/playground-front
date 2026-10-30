import {
  requestAuthenticatedApi,
  AuthRequestError,
} from "@/features/auth/client/api";
import {
  isOverview,
  isTicket,
  isShootingRooms,
  type ShootingRooms,
  type ShootingOverview,
  type ShootingTicket,
} from "../contracts";
import type { Mode } from "@playground/shooting-shared";

/** 목록 갱신도 기존 로그인 세션과 취소 신호를 공유하며 이전 계정 응답을 거절한다. */
export async function readShootingRooms(
  sessionId: string,
  page: number,
  search: string,
  friendsOnly: boolean,
  signal?: AbortSignal,
): Promise<ShootingRooms> {
  const response = await requestAuthenticatedApi(
    "/api/shooting/rooms",
    { sessionId, page, search, friendsOnly },
    signal,
  );
  const value: unknown = await response.json();
  if (!isShootingRooms(value) || value.sessionId !== sessionId)
    throw new AuthRequestError("방 목록을 확인하지 못했습니다.", 502);
  return value;
}

/** 공통 요청 증명·세션 갱신을 재사용하며 다른 계정의 지연된 응답을 표시하지 않는다. */
export async function issueTicket(
  sessionId: string,
  mode: Mode,
  signal?: AbortSignal,
  invitedRoomCode?: string,
): Promise<ShootingTicket> {
  const response = await requestAuthenticatedApi(
    "/api/shooting/ticket",
    // 비밀번호 예외는 브라우저의 접속 옵션 대신 인증된 일회용 티켓에 기록한다.
    { sessionId, mode, ...(invitedRoomCode && { invitedRoomCode }) },
    signal,
  );
  const value: unknown = await response.json();
  if (!isTicket(value) || value.sessionId !== sessionId)
    throw new AuthRequestError("게임 접속 응답을 확인하지 못했습니다.", 502);
  return value;
}
export async function readRankings(
  sessionId: string,
  mode: Mode,
  page = 1,
  signal?: AbortSignal,
): Promise<ShootingOverview> {
  const response = await requestAuthenticatedApi(
    "/api/shooting/overview",
    { sessionId, mode, page },
    signal,
  );
  const value: unknown = await response.json();
  if (!isOverview(value) || value.sessionId !== sessionId)
    throw new AuthRequestError("게임 순위를 확인하지 못했습니다.", 502);
  return value;
}

/** 인증된 변경 알림을 처리하고 비밀번호·방 상세는 별도 조회로만 받는다. */
export async function watchShootingLobby(
  sessionId: string,
  signal: AbortSignal,
  onEvent: (type: "ready" | "changed") => void,
): Promise<void> {
  signal.throwIfAborted();
  const response = await requestAuthenticatedApi(
    "/api/shooting/events",
    { sessionId },
    signal,
  );
  if (
    !response.body ||
    !response.headers.get("Content-Type")?.startsWith("text/event-stream")
  ) {
    throw new AuthRequestError("로비 변경 알림에 연결하지 못했습니다.", 502);
  }
  const reader = response.body.getReader();
  const cancel = () => {
    void reader.cancel().catch(() => {});
  };
  signal.addEventListener("abort", cancel, { once: true });
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (!signal.aborted) {
      const { value, done } = await reader.read();
      if (done) break;
      // 분할된 CRLF까지 처리하고 서버에서 전달된 명시적인 이벤트 이름 외에는 무시한다.
      buffer = (buffer + decoder.decode(value, { stream: true })).replaceAll(
        "\r\n",
        "\n",
      );
      if (buffer.length > 16_384)
        throw new AuthRequestError("로비 알림을 확인하지 못했습니다.", 502);
      let end: number;
      while ((end = buffer.indexOf("\n\n")) >= 0) {
        const event = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const lines = event.split("\n");
        if (lines.some((line) => /^event:\s*changed$/.test(line)))
          onEvent("changed");
        else if (lines.some((line) => /^event:\s*ready$/.test(line)))
          onEvent("ready");
      }
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
