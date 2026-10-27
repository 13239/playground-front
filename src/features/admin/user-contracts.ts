import { isProfileAvatarId, type ProfileAvatarId } from "@/features/profile/catalog";
import { gameCodePattern } from "@/features/games/contracts";
import type { Page } from "./contracts";
import { PAGE_SIZES, parseNumberedPage } from "./pagination-contracts";
import type { NumberedPage } from "./pagination-contracts";

/** 탈퇴는 계정 상태이며 deleted 플래그는 삭제 여부만 나타낸다. 표시·필터·응답 검증이 같은 상태 목록을 사용한다. */
export const USER_STATUS_LABELS = { ACTIVE: "활성", INACTIVE: "비활성", PENDING: "가입대기", WITHDRAWN: "탈퇴" } as const;
export type UserStatus = keyof typeof USER_STATUS_LABELS;
export const isUserStatus = (value: unknown): value is UserStatus => typeof value === "string" && Object.hasOwn(USER_STATUS_LABELS, value);

/** 기본 회원 응답에 원문 개인정보나 인증 정보가 섞이지 않도록 별도 계약으로 복사한다. */
export type AdminUser = Readonly<{ id: number; username: string; nickname: string; avatarId: ProfileAvatarId; status: UserStatus;
  deleted: boolean; roleCode: string; roleName: string; createdAt: string; updatedAt: string | null; managementVersion: number; roleVersion: number }>;
export type UserDetails = Readonly<{ user: AdminUser }>;
/** 번호·마지막 페이지와 직접 이동을 지원한다. 회원/이력 외의 기존 커서 계약은 유지한다. */
export type { NumberedPage } from "./pagination-contracts";
export const USER_PAGE_SIZES = PAGE_SIZES;
/** 닉네임 변경 이력의 표시 개수는 회원 목록과 별도로 요청·응답에서 동일하게 검증한다. */
export const NICKNAME_HISTORY_PAGE_SIZES = [10, 15, 20, 30] as const;
export type UserSensitive = Readonly<{ userId: number; email: string | null; phone: string | null; birthday: string | null; gender: "M" | "F" | null; managementVersion: number }>;
export type UserRole = Readonly<{ userId: number; roleCode: string; version: number }>;
export type NicknameChange = Readonly<{ id: number; previousNickname: string; newNickname: string; changedAt: string; changedBy: "SELF" }>;
const object = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown, max: number): v is string => typeof v === "string" && [...v].length <= max;
const integer = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const code = (v: unknown): v is string => typeof v === "string" && gameCodePattern.test(v);
const nullable = (v: unknown, max: number): v is string | null => v === null || text(v, max);
const date = (v: unknown): v is string => text(v, 40) && Number.isFinite(Date.parse(v));
function assert(v: unknown): asserts v { if (!v) throw new Error("Invalid user management response"); }
export function parseAdminUser(v: unknown): AdminUser {
  assert(object(v) && integer(v.id) && v.id > 0 && text(v.username,50) && text(v.nickname,50) && isProfileAvatarId(v.avatarId)
    && isUserStatus(v.status) && typeof v.deleted === "boolean"
    && code(v.roleCode) && text(v.roleName,50) && date(v.createdAt) && (v.updatedAt === null || date(v.updatedAt)) && integer(v.managementVersion) && integer(v.roleVersion));
  return { id:v.id,username:v.username,nickname:v.nickname,avatarId:v.avatarId,status:v.status,deleted:v.deleted,roleCode:v.roleCode,roleName:v.roleName,
    createdAt:v.createdAt,updatedAt:v.updatedAt,managementVersion:v.managementVersion,roleVersion:v.roleVersion };
}
export function parseUserDetails(v: unknown): UserDetails {
  assert(object(v));
  return { user:parseAdminUser(v.user) };
}
export function parseSensitive(v: unknown): UserSensitive {
  assert(object(v) && integer(v.userId) && v.userId > 0 && nullable(v.email,100) && nullable(v.phone,30)
    && (v.birthday === null || text(v.birthday,10) && /^\d{4}-\d{2}-\d{2}$/.test(v.birthday)) && (v.gender === null || v.gender === "M" || v.gender === "F") && integer(v.managementVersion));
  return { userId:v.userId,email:v.email,phone:v.phone,birthday:v.birthday,gender:v.gender,managementVersion:v.managementVersion };
}
export function parseUserRole(v: unknown): UserRole {
  assert(object(v) && integer(v.userId) && v.userId > 0 && code(v.roleCode) && integer(v.version));
  return {userId:v.userId,roleCode:v.roleCode,version:v.version};
}
function parseNicknameChange(v: unknown): NicknameChange {
  assert(object(v) && integer(v.id) && v.id > 0 && text(v.previousNickname,50) && text(v.newNickname,50) && date(v.changedAt) && v.changedBy === "SELF");
  return {id:v.id,previousNickname:v.previousNickname,newNickname:v.newNickname,changedAt:v.changedAt,changedBy:v.changedBy};
}
/** 페이지 크기·집계의 일관성을 검증한 뒤 허용된 응답 컬럼만 복사한다. */
function numericPage<T>(v: unknown, parse: (value: unknown) => T): NumberedPage<T> {
  return parseNumberedPage(v, parse);
}
export const parseUserPage = (v: unknown) => numericPage(v,parseAdminUser);
export const parseNicknamePage = (v: unknown) => parseNumberedPage(v, parseNicknameChange, NICKNAME_HISTORY_PAGE_SIZES);
export function parseUserRoleOptions(v: unknown): Page<Readonly<{code:string;name:string}>> {
  assert(object(v) && Array.isArray(v.items) && v.items.length <= 100 && (v.nextCursor === null || code(v.nextCursor)));
  return {items:v.items.map(r=>{assert(object(r) && code(r.code) && text(r.name,50));return {code:r.code,name:r.name};}),nextCursor:v.nextCursor};
}
