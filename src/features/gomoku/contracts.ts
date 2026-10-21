import {
  isProfileAvatarId,
  type ProfileAvatarId,
} from "@/features/profile/catalog";

/** 방 화면·BFF가 같은 공개 계약과 설정 검증을 사용한다. 고정 규칙은 입력으로 받지 않는다. */
export type RoomVisibility = "PUBLIC" | "PRIVATE";
export type ForbiddenRule = "NONE" | "STANDARD";
export type RoomDraft = Readonly<{
  title: string;
  visibility: RoomVisibility;
  password: string;
  undoLimit: 1 | 3 | 5;
  forbiddenRule: ForbiddenRule;
}>;
export type RoomFilters = Readonly<{
  query: string;
  publicOnly: boolean;
  waitingOnly: boolean;
  page: number;
}>;
export type HostedRoom = Readonly<{
  id: number;
  title: string;
  inviteCode: string;
}>;
export type RoomSummary = Readonly<{
  id: number;
  title: string;
  hostNickname: string;
  hostAvatarId: ProfileAvatarId;
  visibility: RoomVisibility;
  playerCount: number;
  undoLimit: 1 | 3 | 5;
  forbiddenRule: ForbiddenRule;
  status: "WAITING" | "PLAYING";
  owned: boolean;
}>;
export type RoomPage = Readonly<{
  rooms: readonly RoomSummary[];
  page: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
  hostedRoom: HostedRoom | null;
  // 방장이 아니어도 본인이 참가한 방으로 복귀할 수 있다.
  joinedRoom: HostedRoom | null;
}>;

export const defaultRoomDraft: RoomDraft = {
  title: "함께 즐기는 오목 한 판!",
  visibility: "PUBLIC",
  password: "",
  undoLimit: 1,
  forbiddenRule: "NONE",
};
export const requestIdPattern =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export const inviteCodePattern = /^[A-HJ-NP-Z2-9]{6}$/;
export const ruleLabel = (rule: ForbiddenRule) =>
  rule === "NONE" ? "금수 없음" : "금수 적용";

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
const integer = (value: unknown, min: number, max: number) =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= min &&
  value <= max;
const text = (value: unknown, max: number) =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;

export function validateRoomDraft(
  value: Record<string, unknown>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!text(value.title, 30) || /[\p{Cc}\p{Cf}]/u.test(String(value.title)))
    errors.title = "방 이름을 제어 문자 없이 1~30자로 입력해 주세요.";
  if (value.visibility !== "PUBLIC" && value.visibility !== "PRIVATE")
    errors.visibility = "공개 여부를 선택해 주세요.";
  if (
    value.visibility === "PRIVATE" &&
    (typeof value.password !== "string" ||
      !/^[A-Za-z0-9]{4,8}$/.test(value.password))
  )
    errors.password = "비밀번호는 영문 또는 숫자 4~8자로 입력해 주세요.";
  if (
    value.visibility === "PUBLIC" &&
    value.password !== "" &&
    value.password !== undefined &&
    value.password !== null
  )
    errors.password = "공개 방에는 비밀번호를 지정할 수 없습니다.";
  if (![1, 3, 5].includes(value.undoLimit as number))
    errors.undoLimit = "무르기 횟수를 선택해 주세요.";
  if (value.forbiddenRule !== "NONE" && value.forbiddenRule !== "STANDARD")
    errors.forbiddenRule = "금수 규칙을 선택해 주세요.";
  return errors;
}

/** 외부 응답은 길이·범위·열거형을 검증하고 화면에서 허용한 필드만 사용한다. */
export function isHostedRoom(value: unknown): value is HostedRoom {
  return (
    isObject(value) &&
    integer(value.id, 1, Number.MAX_SAFE_INTEGER) &&
    text(value.title, 30) &&
    typeof value.inviteCode === "string" &&
    inviteCodePattern.test(value.inviteCode)
  );
}
export function isRoomSummary(value: unknown): value is RoomSummary {
  return (
    isObject(value) &&
    integer(value.id, 1, Number.MAX_SAFE_INTEGER) &&
    text(value.title, 30) &&
    text(value.hostNickname, 50) &&
    isProfileAvatarId(value.hostAvatarId) &&
    ["PUBLIC", "PRIVATE"].includes(value.visibility as string) &&
    integer(value.playerCount, 1, 2) &&
    [1, 3, 5].includes(value.undoLimit as number) &&
    ["NONE", "STANDARD"].includes(value.forbiddenRule as string) &&
    ["WAITING", "PLAYING"].includes(value.status as string) &&
    typeof value.owned === "boolean"
  );
}
export function isRoomPage(value: unknown): value is RoomPage {
  return (
    isObject(value) &&
    Array.isArray(value.rooms) &&
    value.rooms.length <= 6 &&
    value.rooms.every(isRoomSummary) &&
    integer(value.page, 0, 1000) &&
    value.pageSize === 6 &&
    integer(value.totalElements, 0, Number.MAX_SAFE_INTEGER) &&
    integer(value.totalPages, 0, Number.MAX_SAFE_INTEGER) &&
    (value.hostedRoom === null || isHostedRoom(value.hostedRoom)) &&
    (value.joinedRoom === null || isHostedRoom(value.joinedRoom))
  );
}

/** BFF를 통과할 때 내부 필드가 섞여 있어도 브라우저로 전달하지 않도록 명시적으로 복사한다. */
export function publicHostedRoom(value: HostedRoom): HostedRoom {
  return { id: value.id, title: value.title, inviteCode: value.inviteCode };
}
export function publicRoomPage(value: RoomPage): RoomPage {
  return {
    rooms: value.rooms.map((room) => ({
      id: room.id,
      title: room.title,
      hostNickname: room.hostNickname,
      hostAvatarId: room.hostAvatarId,
      visibility: room.visibility,
      playerCount: room.playerCount,
      undoLimit: room.undoLimit,
      forbiddenRule: room.forbiddenRule,
      status: room.status,
      owned: room.owned,
    })),
    page: value.page,
    pageSize: value.pageSize,
    totalElements: value.totalElements,
    totalPages: value.totalPages,
    hostedRoom: value.hostedRoom && publicHostedRoom(value.hostedRoom),
    joinedRoom: value.joinedRoom && publicHostedRoom(value.joinedRoom),
  };
}
