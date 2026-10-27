import {
  isProfileAvatarId,
  type ProfileAvatarId,
} from "@/features/profile/catalog";
import {
  inviteCodePattern,
  membershipIdPattern,
  isObject,
  type ForbiddenRule,
  type RoomVisibility,
} from "./contracts";
import { isMatchState, publicMatch, type MatchState } from "./game-contracts";
import { uuid as publicIdPattern } from "@/features/social/contracts";

/** 대기실에는 공개 좌석·프로필만 전달하고 내부 회원 ID와 비밀번호 해시는 받지 않는다. */
export type WaitingParticipant = Readonly<{
  seat: 1 | 2;
  nickname: string;
  // 구버전 응답은 허용하되 새 친구 진입점에는 서버의 공개 UUID만 사용한다.
  publicUserId?: string;
  avatarId: ProfileAvatarId;
  host: boolean;
  self: boolean;
  ready: boolean;
  // 서버가 확정한 온라인 전적. AI 게임과 이전 대국은 포함하지 않는다.
  wins: number;
  losses: number;
  draws: number;
}>;
export type WaitingRoom = Readonly<{
  id: number;
  title: string;
  inviteCode: string | null;
  visibility: RoomVisibility;
  undoLimit: 1 | 3 | 5;
  forbiddenRule: ForbiddenRule;
  boardSize: 20;
  turnSeconds: 30;
  revision: number;
  membershipId: string;
  allReady: boolean;
  participants: readonly WaitingParticipant[];
  // 진행 중인 판과 서버 시각을 같은 인증·참가 경계로 전달한다.
  status: "WAITING" | "PLAYING";
  serverTime: string;
  game: MatchState | null;
}>;
export type JoinRoomInput =
  | Readonly<{ roomId: number; password?: string }>
  | Readonly<{ inviteCode: string; password?: string }>;

/** 참가 요청은 상세 대기실 데이터가 아닌 최소 성공 영수증만 반환한다. */
export type JoinRoomReceipt = Readonly<{ roomId: number }>;
export function isJoinRoomReceipt(value: unknown): value is JoinRoomReceipt {
  return isObject(value) && typeof value.roomId === "number" &&
    Number.isSafeInteger(value.roomId) && value.roomId > 0;
}


export function isWaitingRoom(value: unknown): value is WaitingRoom {
  if (
    !isObject(value) ||
    !["WAITING", "PLAYING"].includes(value.status as string) ||
    typeof value.serverTime !== "string" || !Number.isFinite(Date.parse(value.serverTime)) ||
    !(value.game === null || isMatchState(value.game)) ||
    (value.status === "PLAYING") !== (value.game !== null) ||
    !Number.isSafeInteger(value.id) ||
    (value.id as number) < 1 ||
    typeof value.title !== "string" ||
    !value.title.trim() ||
    value.title.length > 30 ||
    !["PUBLIC", "PRIVATE"].includes(value.visibility as string) ||
    ![1, 3, 5].includes(value.undoLimit as number) ||
    !["NONE", "STANDARD"].includes(value.forbiddenRule as string) ||
    value.boardSize !== 20 ||
    value.turnSeconds !== 30 ||
    !Number.isSafeInteger(value.revision) ||
    (value.revision as number) < 0 ||
    typeof value.membershipId !== "string" ||
    !membershipIdPattern.test(value.membershipId) ||
    typeof value.allReady !== "boolean" ||
    !Array.isArray(value.participants) ||
    value.participants.length < 1 ||
    value.participants.length > 2
  )
    return false;
  const members = value.participants;
  if (
    !members.every(
      (p: unknown) =>
        isObject(p) &&
        [1, 2].includes(p.seat as number) &&
        typeof p.nickname === "string" &&
        (p.publicUserId == null || typeof p.publicUserId === "string" && publicIdPattern.test(p.publicUserId)) &&
        p.nickname.trim().length > 0 &&
        [...p.nickname].length <= 50 &&
        isProfileAvatarId(p.avatarId) &&
        typeof p.host === "boolean" &&
        typeof p.self === "boolean" &&
        typeof p.ready === "boolean" &&
        [p.wins, p.losses, p.draws].every(value =>
          typeof value === "number" && Number.isSafeInteger(value) && value >= 0),
    )
  )
    return false;
  return (
    new Set(members.map((p) => p.seat)).size === members.length &&
    members.filter((p) => p.self).length === 1 &&
    members.filter((p) => p.host).length === 1 &&
    // 서버와 BFF에서 방장 본인에게만 초대 코드를 제공하도록 응답 경계를 검증한다.
    (members.some((p) => p.host && p.self)
      ? typeof value.inviteCode === "string" && inviteCodePattern.test(value.inviteCode)
      : value.inviteCode === null) &&
    (value.game === null || members.length === 2 && (value.game as MatchState).undoOne <= (value.undoLimit as number)
      && (value.game as MatchState).undoTwo <= (value.undoLimit as number)) &&
    value.allReady === (members.length === 2 && members.every((p) => p.ready))
  );
}

/** BFF에서 필드를 다시 복사하여 참가자 엔티티나 향후 내부 메타데이터가 브라우저에 섞이지 않게 한다. */
export function publicWaitingRoom(room: WaitingRoom): WaitingRoom {
  return {
    id: room.id,
    title: room.title,
    inviteCode: room.inviteCode,
    visibility: room.visibility,
    undoLimit: room.undoLimit,
    forbiddenRule: room.forbiddenRule,
    boardSize: room.boardSize,
    turnSeconds: room.turnSeconds,
    revision: room.revision,
    membershipId: room.membershipId,
    allReady: room.allReady,
    participants: room.participants.map(
      ({ seat, nickname, publicUserId, avatarId, host, self, ready, wins, losses, draws }) => ({
        seat,
        nickname,
        publicUserId,
        avatarId,
        host,
        self,
        ready,
        wins,
        losses,
        draws,
      }),
    ),
    status: room.status,
    serverTime: room.serverTime,
    game: room.game === null ? null : publicMatch(room.game),
  };
}
