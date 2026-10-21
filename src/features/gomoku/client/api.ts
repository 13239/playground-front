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
export const readWaitingRoom = (sessionId: string, roomId: number) => waitingRequest("/api/gomoku/rooms/state", sessionId, { roomId });
export const readyRoom = (sessionId: string, roomId: number, ready: boolean) => waitingRequest("/api/gomoku/rooms/ready", sessionId, { roomId, ready });
export async function leaveRoom(sessionId: string, roomId: number): Promise<void> {
  if ((await requestAuthenticatedApi("/api/gomoku/rooms/leave", { sessionId, roomId })).status !== 204) {
    throw new AuthRequestError("방에서 나가지 못했습니다. 다시 시도해 주세요.", 502);
  }
}

/** randomUUID가 없는 dev HTTP도 지원한다. 보안 난수만 사용하고 서버의 중복 생성 방지 ID로 한 번 보낸다. */
export function newRoomRequestId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const value = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}
