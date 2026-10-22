import { createUuidV4 } from "@/lib/client/uuid";
import {
  AuthRequestError,
  requestAuthenticatedApi,
} from "@/features/auth/client/api";
import {
  isHostedRoom,
  isObject,
  isRoomPage,
  publicHostedRoom,
  publicRoomPage,
  type HostedRoom,
  type RoomDraft,
  type RoomFilters,
  type RoomPage,
} from "../contracts";
import { isWaitingRoom, publicWaitingRoom, type WaitingRoom, type JoinRoomInput } from "../waiting-contracts";
import type { GameAction } from "../game-contracts";

/** 결과를 화면의 로그인 세션과 대조해 늦은 이전 계정 응답을 사용하지 않는다. */
async function readResponse(
  response: Response,
  sessionId: string,
): Promise<Record<string, unknown>> {
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    /* 공개 JSON 계약만 사용한다. */
  }
  if (!isObject(value))
    throw new AuthRequestError("방 정보를 확인하지 못했습니다.", 502);
  if (value.sessionId !== sessionId)
    throw new AuthRequestError(
      "로그인 상태가 변경되었습니다. 다시 확인해 주세요.",
      409,
      undefined,
      "LOGIN_SESSION_CHANGED",
    );
  return value;
}
export async function searchRooms(
  sessionId: string,
  filters: RoomFilters,
): Promise<RoomPage> {
  const value = await readResponse(
    await requestAuthenticatedApi("/api/gomoku/rooms/search", {
      sessionId,
      ...filters,
    }),
    sessionId,
  );
  if (!isRoomPage(value))
    throw new AuthRequestError("방 목록을 확인하지 못했습니다.", 502);
  return publicRoomPage(value);
}
export async function createRoom(
  sessionId: string,
  requestId: string,
  draft: RoomDraft,
): Promise<HostedRoom> {
  const value = await readResponse(
    await requestAuthenticatedApi("/api/gomoku/rooms", {
      sessionId,
      requestId,
      ...draft,
    }),
    sessionId,
  );
  if (!isHostedRoom(value))
    throw new AuthRequestError(
      "생성한 방을 확인하지 못했습니다. 목록에서 내 방을 확인해 주세요.",
      502,
    );
  return publicHostedRoom(value);
}
export async function closeRoom(
  sessionId: string,
  roomId: number,
): Promise<void> {
  if (
    (
      await requestAuthenticatedApi("/api/gomoku/rooms/close", {
        sessionId,
        roomId,
      })
    ).status !== 204
  )
    throw new AuthRequestError("방을 닫지 못했습니다.", 502);
}

/** 입장·조회·준비 결과를 같은 계약으로 검증하고 이전 계정의 늦은 응답을 사용하지 않는다. */
async function waitingRequest(path: "/api/gomoku/rooms/join" | "/api/gomoku/rooms/state" | "/api/gomoku/rooms/ready",
  sessionId: string, body: Readonly<Record<string, unknown>>): Promise<WaitingRoom> {
  const value = await readResponse(await requestAuthenticatedApi(path, { sessionId, ...body }), sessionId);
  if (!isWaitingRoom(value)) throw new AuthRequestError("대기실 정보를 확인하지 못했습니다.", 502);
  return publicWaitingRoom(value);
}
export const joinRoom = (sessionId: string, input: JoinRoomInput) => waitingRequest("/api/gomoku/rooms/join", sessionId, input);
export const readWaitingRoom = (sessionId: string, roomId: number, pageId?: string) => waitingRequest("/api/gomoku/rooms/state", sessionId, { roomId, ...(pageId ? { pageId } : {}) });
export const readyRoom = (sessionId: string, roomId: number, ready: boolean, pageId: string) => waitingRequest("/api/gomoku/rooms/ready", sessionId, { roomId, ready, pageId });

/** 전송 UUID와 방 순서를 고정한다. 성공 여부가 불명확하면 최신 판을 조회하고 명령을 임의 재전송하지 않는다. */
export async function sendGameAction(sessionId: string, room: WaitingRoom, action: GameAction, pageId: string): Promise<WaitingRoom> {
  if (!room.game) throw new AuthRequestError("진행 중인 대국이 없습니다.", 409);
  const value = await readResponse(await requestAuthenticatedApi("/api/gomoku/rooms/game", {
    sessionId, roomId: room.id, matchId: room.game.id, revision: room.revision, requestId: newRoomRequestId(), pageId, ...action,
  }), sessionId);
  if (!isWaitingRoom(value)) throw new AuthRequestError("대국 정보를 확인하지 못했습니다.", 502);
  return publicWaitingRoom(value);
}

/** 이벤트에는 데이터 대신 변경 알림만 있다. 현재 인증으로 판을 다시 읽고 끊긴 스트림은 취소한다. */
export async function watchRoom(sessionId: string, roomId: number, pageId: string, signal: AbortSignal, changed: () => void): Promise<void> {
  signal.throwIfAborted();
  const response = await requestAuthenticatedApi("/api/gomoku/rooms/game/events", { sessionId, roomId, pageId }, signal);
  if (!response.body || !response.headers.get("Content-Type")?.startsWith("text/event-stream")) throw new AuthRequestError("대국 알림에 연결하지 못했습니다.", 502);
  const reader = response.body.getReader();
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", cancel, { once: true });
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    if (signal.aborted) return;
    while (!signal.aborted) {
      const chunk = await reader.read();
      if (chunk.done) break;
      // CRLF가 두 청크에 나뉘어 도착해도 이벤트 구분자를 잃지 않는다.
      buffer = (buffer + decoder.decode(chunk.value, { stream: true })).replaceAll("\r\n", "\n");
      if (buffer.length > 16_384) throw new AuthRequestError("대국 알림을 확인하지 못했습니다.", 502);
      let end: number;
      while ((end = buffer.indexOf("\n\n")) >= 0) {
        const event = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (event.split("\n").some(line => /^event:\s*changed$/.test(line))) changed();
      }
    }
  } finally { signal.removeEventListener("abort", cancel); await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
export async function leaveRoom(sessionId: string, roomId: number, membershipId: string, pageId: string): Promise<void> {
  if ((await requestAuthenticatedApi("/api/gomoku/rooms/leave", { sessionId, roomId, membershipId, pageId })).status !== 204) {
    throw new AuthRequestError("방에서 나가지 못했습니다. 다시 시도해 주세요.", 502);
  }
}

/** 문서마다 다른 페이지 식별자로 참가를 이어받고 브라우저 닫기의 보류된 퇴장을 취소한다. */
export async function openRoomPage(sessionId: string, roomId: number, membershipId: string, pageId: string, tabId: string): Promise<void> {
  if ((await requestAuthenticatedApi("/api/gomoku/rooms/lifecycle", { sessionId, roomId, membershipId, pageId, tabId, action: "OPEN" })).status !== 204) {
    throw new AuthRequestError("방 접속을 확인하지 못했습니다.", 502);
  }
}

/** HTTPS에서는 randomUUID를 우선 사용하고, dev HTTP에서는 보안 난수로 UUID v4를 생성한다. */
export function newRoomRequestId(): string {
  return createUuidV4();
}
