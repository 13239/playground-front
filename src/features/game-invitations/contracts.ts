import {
  object,
  isPerson,
  uuid,
  type Person,
} from "@/features/social/person-contracts";
import type { Snapshot } from "@/features/social/contracts";

/** 게임별 방 번호 형식은 유지하고 표시·타이머·응답 흐름은 같은 계약으로 정규화한다. */
export type InvitationGame = "gomoku" | "memory" | "shooting";
export type GameInvitation = Readonly<{
  id: string;
  game: InvitationGame;
  roomId: string | number;
  roomTitle: string;
  inviter: Person;
  target: Person;
  expiresAt: string;
  rules?: string;
}>;
export type InvitationDecision = Readonly<{
  state: "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED" | "EXPIRED";
  roomId: string | number | null;
}>;
export type InvitationAction = "accept" | "reject" | "cancel";

/** 신규 게임은 허용한 식별자와 방 번호만 통과시킨다. 서버가 임의 이동 URL을 내려주지 않는다. */
export function isGameInvitation(value: unknown): value is GameInvitation {
  return (
    object(value) &&
    typeof value.id === "string" &&
    uuid.test(value.id) &&
    value.game === "shooting" &&
    typeof value.roomId === "string" &&
    /^[A-Z2-9]{8}$/.test(value.roomId) &&
    typeof value.roomTitle === "string" &&
    value.roomTitle.length > 0 &&
    [...value.roomTitle].length <= 80 &&
    isPerson(value.inviter) &&
    isPerson(value.target) &&
    typeof value.expiresAt === "string" &&
    Number.isFinite(Date.parse(value.expiresAt))
  );
}
export function isInvitationDecision(
  value: unknown,
): value is InvitationDecision {
  return (
    object(value) &&
    ["PENDING", "ACCEPTED", "REJECTED", "CANCELLED", "EXPIRED"].includes(
      String(value.state),
    ) &&
    (value.state === "ACCEPTED"
      ? typeof value.roomId === "string" && /^[A-Z2-9]{8}$/.test(value.roomId)
      : value.roomId === null)
  );
}

/** 기존 서버 계약을 변경하지 않고 모든 게임의 초대를 한 수신 큐와 발신 창에서 사용한다. */
export function collectGameInvitations(
  data: Snapshot | null,
): GameInvitation[] {
  if (!data) return [];
  return [
    ...(data.gomokuInvitations ?? []).map((item) => ({
      ...item,
      game: "gomoku" as const,
      rules: `20 × 20 · 30초/수 · 무르기 ${item.undoLimit}회 · ${item.forbiddenRule === "STANDARD" ? "금수 적용" : "금수 없음"} · ${item.visibility === "PRIVATE" ? "비공개방" : "공개방"}`,
    })),
    ...(data.memoryInvitations ?? []).map((item) => ({
      ...item,
      game: "memory" as const,
      rules: "30장 · 15쌍 · 차례당 10초 · 최초 공개 3초",
    })),
    ...(data.gameInvitations ?? []),
  ].sort(
    (a, b) =>
      a.expiresAt.localeCompare(b.expiresAt) || a.id.localeCompare(b.id),
  );
}

/** 서버 시각과 경과 시간만 사용해 사용자 PC 시계 변경이나 백그라운드 타이머 정지로 기한이 늘어나지 않게 한다. */
export function invitationRemaining(
  expiresAt: string,
  serverTime: string | undefined,
  snapshotAt: number,
  now: number,
): number {
  if (!serverTime) return 0;
  const remaining =
    Date.parse(expiresAt) -
    Date.parse(serverTime) -
    Math.max(0, now - snapshotAt);
  return Number.isFinite(remaining) ? Math.max(0, remaining) : 0;
}
