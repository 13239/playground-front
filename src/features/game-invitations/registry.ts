import {
  sendGomokuInvitation,
  respondGomokuInvitation,
} from "@/features/gomoku/client/invitations";
import {
  sendMemoryInvitation,
  respondMemoryInvitation,
} from "@/features/memory/client/api";
import {
  requestAuthenticatedApi,
  AuthRequestError,
} from "@/features/auth/client/api";
import { object } from "@/features/social/contracts";
import {
  isGameInvitation,
  isInvitationDecision,
  type InvitationGame,
  type InvitationAction,
  type InvitationDecision,
} from "./contracts";

/** 게임별 차이는 이름·안내·검증된 입장 경로와 서버 어댑터로 한정한다. */
export const invitationGames = {
  gomoku: {
    name: "오목",
    icon: "board",
    message: "함께 오목을 두자고 초대했어요.",
    rules: "",
    destination: (room: string | number) => `/games/gomoku/rooms/${room}`,
  },
  memory: {
    name: "같은 그림 찾기",
    icon: "board",
    message: "함께 같은 그림 찾기를 하자고 초대했어요.",
    rules: "",
    destination: (room: string | number) => `/games/memory/rooms/${room}`,
  },
  shooting: {
    name: "슈팅 서바이벌",
    icon: "target",
    message: "함께 슈팅 서바이벌을 플레이하자고 초대했어요.",
    rules: "온라인 2인 협동 · 무기 선택 후 함께 출격",
    destination: (room: string | number) =>
      `/games/shooting?room=${encodeURIComponent(room)}`,
  },
} as const;

/** 기존 서명·토큰 갱신 경계로 호출하며 이전 로그인에서 끝난 초대 응답은 재사용하지 않는다. */
async function shootingCall(
  sessionId: string,
  action: "send" | InvitationAction,
  body: object,
  signal?: AbortSignal,
) {
  const response = await requestAuthenticatedApi(
    `/api/game-invitations/${action}`,
    { sessionId, game: "shooting", ...body },
    signal,
  );
  const value: unknown = await response.json();
  if (!object(value) || value.sessionId !== sessionId)
    throw new AuthRequestError(
      "로그인 상태가 변경되었습니다. 다시 확인해 주세요.",
      409,
      undefined,
      "LOGIN_SESSION_CHANGED",
    );
  return value;
}
export async function sendGameInvitation(
  game: InvitationGame,
  sessionId: string,
  roomId: number | string,
  pageId: string,
  targetId: string,
  requestId: string,
) {
  if (game === "gomoku")
    return sendGomokuInvitation(
      sessionId,
      Number(roomId),
      pageId,
      targetId,
      requestId,
    );
  if (game === "memory")
    return sendMemoryInvitation(
      sessionId,
      Number(roomId),
      pageId,
      targetId,
      requestId,
    );
  const value = await shootingCall(sessionId, "send", {
    roomId,
    targetId,
    requestId,
  });
  if (!isGameInvitation(value))
    throw new AuthRequestError("초대 정보를 확인하지 못했습니다.", 502);
  return value;
}
export async function respondGameInvitation(
  game: InvitationGame,
  sessionId: string,
  action: InvitationAction,
  invitationId: string,
  signal?: AbortSignal,
): Promise<InvitationDecision> {
  if (game === "gomoku")
    return respondGomokuInvitation(sessionId, action, invitationId, signal);
  if (game === "memory")
    return respondMemoryInvitation(sessionId, action, invitationId, signal);
  const value = await shootingCall(sessionId, action, { invitationId }, signal);
  if (!isInvitationDecision(value))
    throw new AuthRequestError("초대 응답을 확인하지 못했습니다.", 502);
  return value;
}
