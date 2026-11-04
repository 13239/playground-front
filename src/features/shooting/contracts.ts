import {
  ALL_MAPS,
  STAGE_MAP_IDS,
  isStageMap,
  type Mode,
  type StageMapId,
} from "@playground/shooting-shared";
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
  stars: number;
  rank: number;
  nickname: string;
  teammate?: string;
  stage: number;
  combatMillis: number;
  self: boolean;
}
export interface ShootingOverview {
  mapId: StageMapId;
  mode: Mode;
  page: number;
  totalPages: number;
  bestStage: number;
  bestMillis: number;
  rankings: RankingRow[];
  sessionId: string;
}
export interface MapProgress {
  mapId: StageMapId;
  unlocked: boolean;
  stars: number;
  singleStars: number;
  coopStars: number;
  singleMillis: number;
  coopMillis: number;
}
export interface ShootingProgress {
  totalStars: number;
  unlockedMaps: number;
  maps: MapProgress[];
  sessionId: string;
}
/** 서버가 확정한 최고 별만 받아 맵 해금·향후 무기 해금에 같은 값을 사용한다. */
export function isProgress(value: unknown): value is ShootingProgress {
  return (
    object(value) &&
    integer(value.totalStars) &&
    value.totalStars <= STAGE_MAP_IDS.length * 3 &&
    integer(value.unlockedMaps, 1) &&
    value.unlockedMaps <= ALL_MAPS &&
    Array.isArray(value.maps) &&
    value.maps.length === STAGE_MAP_IDS.length &&
    new Set(value.maps.map((row) => (object(row) ? row.mapId : ""))).size ===
      STAGE_MAP_IDS.length &&
    value.maps.every(
      (row) =>
        object(row) &&
        isStageMap(row.mapId) &&
        typeof row.unlocked === "boolean" &&
        [row.stars, row.singleStars, row.coopStars].every(
          (stars) => integer(stars) && stars <= 3,
        ) &&
        integer(row.singleMillis) &&
        integer(row.coopMillis),
    )
  );
}
/** 공개 방 목록은 초대용 방 번호와 표시 정보만 포함하고 계정·세션 내부 값은 포함하지 않는다. */
export interface ShootingRoomSummary {
  mapId: StageMapId;
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
        isStageMap(row.mapId) &&
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
        row.players === 1 &&
        typeof row.privateRoom === "boolean",
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
    // 맵·별·유한 스테이지도 응답 경계에서 확인해 이전 규칙의 기록이 섞이지 않게 한다.
    isStageMap(value.mapId) &&
    ["SINGLE", "COOP"].includes(String(value.mode)) &&
    integer(value.page, 1) &&
    integer(value.totalPages, 1) &&
    integer(value.bestStage) &&
    value.bestStage <= 10 &&
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
        row.stage <= 10 &&
        integer(row.stars) &&
        row.stars <= 3 &&
        integer(row.combatMillis) &&
        typeof row.self === "boolean" &&
        (row.teammate == null || typeof row.teammate === "string"),
    )
  );
}
