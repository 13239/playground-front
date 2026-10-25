import { isCatalogGame, isCatalogMode, gameCodePattern, type CatalogGame, type CatalogMode } from "@/features/games/contracts";

/** 화면 표시와 서버 허용 목록이 공유하는 기능 코드다. 실제 허용 여부는 매 요청 Spring이 결정한다. */
export const permissionCodes = ["ADMIN_ACCESS", "DASHBOARD_READ", "USER_READ", "USER_STATUS_UPDATE", "USER_SESSION_REVOKE",
  "USER_SENSITIVE_READ", "USER_ROLE_UPDATE", "ROLE_READ", "ROLE_WRITE", "ROLE_PERMISSION_UPDATE", "ACCESS_POLICY_READ",
  "ACCESS_POLICY_UPDATE", "ACCESS_EXEMPTION_UPDATE", "CHAT_HISTORY_READ", "ACTIVITY_LOG_READ", "ADMIN_AUDIT_READ",
  "GAME_READ", "GAME_WRITE", "GAME_AVAILABILITY_UPDATE", "SERVICE_STATUS_READ"] as const;
export type PermissionCode = typeof permissionCodes[number];
export type AdminContext = Readonly<{ userId: number; roleCode: string; roleName: string; roleVersion: number; membershipVersion: number; permissions: readonly PermissionCode[] }>;
export type Permission = Readonly<{ code: PermissionCode; name: string; category: string; superAdminOnly: boolean }>;
export type RoleSummary = Readonly<{ code: string; name: string; description: string | null; systemRole: boolean; version: number }>;
export type Role = RoleSummary & Readonly<{ editable: boolean; permissions: readonly PermissionCode[] }>;
export type Page<T> = Readonly<{ items: readonly T[]; nextCursor: string | null }>;
export type AccessPolicy = Readonly<{ enabled: boolean; message: string; exemptRoleCodes: readonly string[]; version: number; changedAt: string }>;
export type Genre = Readonly<{ code: string; name: string; enabled: boolean; sortOrder: number; version: number }>;
// 플레이 모드의 표시 순서는 백엔드 구현 정의에서 결정한다.
export type Mode = CatalogMode & Readonly<{ version: number; definitionVersion: number }>;
export type Game = Omit<CatalogGame, "genres" | "modes"> & Readonly<{ sortOrder: number; version: number; genres: readonly Genre[]; modes: readonly Mode[] }>;
export type ModeDefinition = Pick<Mode, "code" | "graphicsType" | "connectionType" | "interactionType" | "minHumanPlayers" | "maxHumanPlayers"> & Readonly<{ version: number }>;
export type Implementation = Readonly<{ code: string; registered: boolean; modes: readonly ModeDefinition[] }>;

const object = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown, max: number): v is string => typeof v === "string" && v.length <= max;
const integer = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const code = (v: unknown): v is string => typeof v === "string" && gameCodePattern.test(v);
const permission = (v: unknown): v is PermissionCode => typeof v === "string" && permissionCodes.some(p => p === v);
const array = <T>(v: unknown, parse: (v: unknown) => T): T[] => {
  if (!Array.isArray(v) || v.length > 1000) throw new Error("Invalid admin response");
  return v.map(parse);
};
function assert(v: unknown): asserts v { if (!v) throw new Error("Invalid admin response"); }
export function parseContext(v: unknown): AdminContext {
  assert(object(v) && integer(v.userId) && v.userId > 0 && code(v.roleCode) && text(v.roleName, 50) && integer(v.roleVersion) && integer(v.membershipVersion));
  return { userId: v.userId, roleCode: v.roleCode, roleName: v.roleName, roleVersion: v.roleVersion, membershipVersion: v.membershipVersion,
    permissions: array(v.permissions, p => { assert(permission(p)); return p; }) };
}
export function parsePermission(v: unknown): Permission {
  assert(object(v) && permission(v.code) && text(v.name, 100) && text(v.category, 100) && typeof v.superAdminOnly === "boolean");
  return { code: v.code, name: v.name, category: v.category, superAdminOnly: v.superAdminOnly };
}
export function parseRoleSummary(v: unknown): RoleSummary {
  assert(object(v) && code(v.code) && text(v.name, 50) && (v.description === null || text(v.description, 255)) && typeof v.systemRole === "boolean" && integer(v.version));
  return { code: v.code, name: v.name, description: v.description, systemRole: v.systemRole, version: v.version };
}
export function parseRole(v: unknown): Role {
  const base = parseRoleSummary(v);
  assert(object(v) && typeof v.editable === "boolean");
  return { ...base, editable: v.editable, permissions: array(v.permissions, p => { assert(permission(p)); return p; }) };
}
export function parsePolicy(v: unknown): AccessPolicy {
  assert(object(v) && typeof v.enabled === "boolean" && text(v.message, 300) && integer(v.version) && text(v.changedAt, 60) && Number.isFinite(Date.parse(v.changedAt)));
  return { enabled: v.enabled, message: v.message, version: v.version, changedAt: v.changedAt, exemptRoleCodes: array(v.exemptRoleCodes, c => { assert(code(c)); return c; }) };
}
export function parseGenre(v: unknown): Genre {
  assert(object(v) && code(v.code) && text(v.name, 50) && typeof v.enabled === "boolean" && integer(v.sortOrder) && v.sortOrder <= 1000000 && integer(v.version));
  return { code: v.code, name: v.name, enabled: v.enabled, sortOrder: v.sortOrder, version: v.version };
}
export function parseMode(v: unknown): Mode {
  assert(object(v) && integer(v.version) && integer(v.definitionVersion));
  const extra = { version: v.version, definitionVersion: v.definitionVersion };
  assert(isCatalogMode(v));
  return { code: v.code, name: v.name, graphicsType: v.graphicsType, connectionType: v.connectionType, interactionType: v.interactionType,
    minHumanPlayers: v.minHumanPlayers, maxHumanPlayers: v.maxHumanPlayers, published: v.published, availability: v.availability,
    unavailableMessage: v.unavailableMessage, supported: v.supported, ...extra };
}
export function parseGame(v: unknown): Game {
  assert(object(v) && integer(v.sortOrder) && integer(v.version));
  const extra = { sortOrder: v.sortOrder, version: v.version };
  assert(isCatalogGame(v));
  return { code: v.code, name: v.name, summary: v.summary, description: v.description, published: v.published,
    availability: v.availability, unavailableMessage: v.unavailableMessage, firstPublishedAt: v.firstPublishedAt, ...extra,
    genres: array(v.genres, parseGenre), modes: array(v.modes, parseMode) };
}
export function parseImplementation(v: unknown): Implementation {
  assert(object(v) && code(v.code) && typeof v.registered === "boolean");
  return { code: v.code, registered: v.registered, modes: array(v.modes, m => {
    assert(object(m) && code(m.code) && ["TWO_D", "THREE_D"].includes(String(m.graphicsType)) && ["LOCAL", "ONLINE"].includes(String(m.connectionType))
      && ["SOLO", "COMPETITIVE", "COOPERATIVE"].includes(String(m.interactionType)) && integer(m.minHumanPlayers) && m.minHumanPlayers >= 1
      && integer(m.maxHumanPlayers) && m.maxHumanPlayers >= m.minHumanPlayers && m.maxHumanPlayers <= 10000 && integer(m.version));
    return { code: m.code, graphicsType: m.graphicsType as Mode["graphicsType"], connectionType: m.connectionType as Mode["connectionType"],
      interactionType: m.interactionType as Mode["interactionType"], minHumanPlayers: m.minHumanPlayers, maxHumanPlayers: m.maxHumanPlayers, version: m.version };
  }) };
}
/** 알 수 없는 응답 필드는 복사하지 않고, 커서는 종류별 문법과 최대 페이지 크기를 검증한다. */
export function parsePage<T>(v: unknown, parse: (v: unknown) => T, role = false): Page<T> {
  assert(object(v) && Array.isArray(v.items) && v.items.length <= 100
    && (v.nextCursor === null || typeof v.nextCursor === "string" && (role ? gameCodePattern : /^\d{1,7}:\d{1,19}$/).test(v.nextCursor)));
  return { items: v.items.map(parse), nextCursor: v.nextCursor };
}
export const parsePermissions = (v: unknown) => array(v, parsePermission);
export const parseImplementations = (v: unknown) => array(v, parseImplementation);
