import type { Mode } from "@playground/shooting-shared";
import {
  isProfileAvatarId,
  type ProfileAvatarId,
} from "@/features/profile/catalog";

/** 인증 티켓의 원문은 연결 수립 중 메모리에만 보관한다. 저장소·URL·게임 상태에 넣지 않는다. */
export interface ShootingTicket {
  ticket: string;
  endpoint: string;
  expiresIn: number;
  proofRequired: boolean;
  sessionId: string;
}
export interface RankingRow {
  rank: number;
  nickname: string;
  teammate?: string;
  stage: number;
  combatMillis: number;
  self: boolean;
}
export interface ShootingOverview {
  mode: Mode;
  page: number;
  totalPages: number;
  bestStage: number;
  bestMillis: number;
  rankings: RankingRow[];
  sessionId: string;
}
/** 공개 방 목록은 초대용 방 번호와 표시 정보만 포함하고 계정·세션 내부 값은 포함하지 않는다. */
export interface ShootingRoomSummary {
  privateRoom: boolean;
  id: string;
  title: string;
  hostPublicId: string;
  nickname: string;
  avatar: ProfileAvatarId;
  friend: boolean;
  players: 1;
}
export interface ShootingRooms {
  items: ShootingRoomSummary[];
  page: number;
  totalPages: number;
  total: number;
  sessionId: string;
}
export function isShootingRooms(value: unknown): value is ShootingRooms {
  return (
    object(value) &&
    integer(value.page, 1) &&
    integer(value.totalPages, 1) &&
    integer(value.total) &&
    Array.isArray(value.items) &&
    value.items.length <= 4 &&
    value.items.every(
      (row) =>
        object(row) &&
        typeof row.id === "string" &&
        /^[A-Z2-9]{8}$/.test(row.id) &&
        typeof row.title === "string" &&
        [...row.title].length <= 80 &&
        typeof row.hostPublicId === "string" &&
        /^[0-9a-f-]{36}$/.test(row.hostPublicId) &&
        typeof row.nickname === "string" &&
        [...row.nickname].length <= 50 &&
        isProfileAvatarId(row.avatar) &&
        typeof row.friend === "boolean" &&
        row.players === 1 && typeof row.privateRoom === "boolean",
    )
  );
}
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const integer = (value: unknown, min = 0): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= min;
export function isTicket(value: unknown): value is ShootingTicket {
  return (
    object(value) &&
    typeof value.ticket === "string" &&
    /^[A-Za-z0-9_-]{43}$/.test(value.ticket) &&
    typeof value.endpoint === "string" &&
    value.endpoint.length <= 2048 &&
    /^wss?:\/\//.test(value.endpoint) &&
    integer(value.expiresIn, 1) &&
    value.expiresIn <= 30_000 &&
    typeof value.proofRequired === "boolean"
  );
}
export function isOverview(value: unknown): value is ShootingOverview {
  return (
    object(value) &&
    ["SINGLE", "COOP"].includes(String(value.mode)) &&
    integer(value.page, 1) &&
    integer(value.totalPages, 1) &&
    integer(value.bestStage) &&
    integer(value.bestMillis) &&
    Array.isArray(value.rankings) &&
    value.rankings.length <= 10 &&
    value.rankings.every(
      (row) =>
        object(row) &&
        integer(row.rank, 1) &&
        typeof row.nickname === "string" &&
        row.nickname.length <= 100 &&
        integer(row.stage, 1) &&
        integer(row.combatMillis) &&
        typeof row.self === "boolean" &&
        (row.teammate == null || typeof row.teammate === "string"),
    )
  );
}
