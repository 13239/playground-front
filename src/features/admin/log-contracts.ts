import { isProfileAvatarId, type ProfileAvatarId } from "@/features/profile/catalog";
import { parseNumberedPage } from "./pagination-contracts";

/** 두 로그 종류는 별도 권한·응답을 사용하며 원문 JSON을 브라우저 계약에 포함하지 않는다. */
export type LogKind = "activities" | "audits";
export type LogPerson = Readonly<{ id: number | null; username: string | null; nickname: string | null; avatarId: ProfileAvatarId }>;
export type ActivityLog = Readonly<{ id: number; occurredAt: string; member: LogPerson; type: string; typeName: string; result: "SUCCESS" | "FAILURE";
  resultName: string; clientIp: string | null; failureCode: string | null; failureMessage: string | null }>;
export type AuditLog = Readonly<{ id: number; occurredAt: string; actor: LogPerson; actorRoleCode: string | null; actorRoleName: string | null;
  action: string; actionName: string; targetType: string; targetId: string; targetName: string; reason: string | null }>;
export type LogAttribute = Readonly<{ label: string; value: string }>;
export type LogChange = Readonly<{ label: string; before: string | null; after: string | null }>;
export type LoginLogDiagnostics = Readonly<{ attemptId: string; source: string; stage: string; stageName: string; reason: string; reasonName: string;
  context: readonly LogAttribute[]; steps: readonly Readonly<{ stage: string; stageName: string; outcome: "SUCCESS" | "FAILURE"; durationMillis: number }>[] }>;
export type ActivityLogDetails = Readonly<{ entry: ActivityLog; userAgent: string | null; attributes: readonly LogAttribute[]; loginDiagnostics: LoginLogDiagnostics | null }>;
export type AuditLogDetails = Readonly<{ entry: AuditLog; changes: readonly LogChange[]; attributes: readonly LogAttribute[] }>;
export type LogDetails = ActivityLogDetails | AuditLogDetails;
export type LogOption = Readonly<{ code: string; label: string }>;
export type LogOptions = Readonly<{ types: readonly LogOption[]; results: readonly LogOption[]; targets: readonly LogOption[] }>;
const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown, limit: number): value is string => typeof value === "string" && [...value].length <= limit;
const nullable = (value: unknown, limit: number): value is string | null => value === null || text(value, limit);
const id = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const code = (value: unknown): value is string => typeof value === "string" && /^[A-Z][A-Z0-9_]{0,63}$/.test(value);
const dateTime = (value: unknown): value is string => text(value, 40) && Number.isFinite(Date.parse(value));
function assert(value: unknown): asserts value { if (!value) throw new Error("Invalid admin log response"); }
function person(value: unknown): LogPerson {
  assert(object(value) && (value.id === null || id(value.id)) && nullable(value.username, 50) && nullable(value.nickname, 50) && isProfileAvatarId(value.avatarId));
  return { id: value.id, username: value.username, nickname: value.nickname, avatarId: value.avatarId };
}
export function parseActivityLog(value: unknown): ActivityLog {
  assert(object(value) && id(value.id) && dateTime(value.occurredAt) && code(value.type) && text(value.typeName, 100)
    && (value.result === "SUCCESS" || value.result === "FAILURE") && text(value.resultName, 100) && nullable(value.clientIp, 45)
    && (value.failureCode === null || code(value.failureCode)) && nullable(value.failureMessage, 1000));
  return { id: value.id, occurredAt: value.occurredAt, member: person(value.member), type: value.type, typeName: value.typeName,
    result: value.result, resultName: value.resultName, clientIp: value.clientIp, failureCode: value.failureCode, failureMessage: value.failureMessage };
}
export function parseAuditLog(value: unknown): AuditLog {
  assert(object(value) && id(value.id) && dateTime(value.occurredAt) && (value.actorRoleCode === null || code(value.actorRoleCode))
    && nullable(value.actorRoleName, 100) && code(value.action) && text(value.actionName, 100) && code(value.targetType)
    && text(value.targetId, 64) && text(value.targetName, 320) && nullable(value.reason, 300));
  return { id: value.id, occurredAt: value.occurredAt, actor: person(value.actor), actorRoleCode: value.actorRoleCode, actorRoleName: value.actorRoleName,
    action: value.action, actionName: value.actionName, targetType: value.targetType, targetId: value.targetId, targetName: value.targetName, reason: value.reason };
}
function attributes(value: unknown): readonly LogAttribute[] {
  assert(Array.isArray(value) && value.length <= 32);
  return value.map(item => { assert(object(item) && text(item.label, 100) && text(item.value, 32768)); return { label: item.label, value: item.value }; });
}
export function parseActivityLogDetails(value: unknown): ActivityLogDetails {
  assert(object(value) && nullable(value.userAgent, 255));
  return { entry: parseActivityLog(value.entry), userAgent: value.userAgent, attributes: attributes(value.attributes), loginDiagnostics: loginDiagnostics(value.loginDiagnostics) };
}
function loginDiagnostics(value: unknown): LoginLogDiagnostics | null {
  if (value === null || value === undefined) return null;
  assert(object(value) && text(value.attemptId, 36) && /^[a-f0-9-]{36}$/.test(value.attemptId) && text(value.source, 100)
    && text(value.stage, 80) && text(value.stageName, 100) && text(value.reason, 80) && text(value.reasonName, 1000)
    && Array.isArray(value.steps) && value.steps.length <= 32);
  const steps = value.steps.map(step => {
    assert(object(step) && text(step.stage, 80) && text(step.stageName, 100) && (step.outcome === "SUCCESS" || step.outcome === "FAILURE")
      && typeof step.durationMillis === "number" && Number.isSafeInteger(step.durationMillis) && step.durationMillis >= 0 && step.durationMillis <= 86400000);
    return { stage: step.stage, stageName: step.stageName, outcome: step.outcome, durationMillis: step.durationMillis } as const;
  });
  return { attemptId: value.attemptId, source: value.source, stage: value.stage, stageName: value.stageName, reason: value.reason,
    reasonName: value.reasonName, context: attributes(value.context), steps };
}
export function parseAuditLogDetails(value: unknown): AuditLogDetails {
  assert(object(value) && Array.isArray(value.changes) && value.changes.length <= 32);
  return { entry: parseAuditLog(value.entry), attributes: attributes(value.attributes), changes: value.changes.map(item => {
    assert(object(item) && text(item.label, 100) && nullable(item.before, 32768) && nullable(item.after, 32768));
    return { label: item.label, before: item.before, after: item.after };
  }) };
}
export const parseActivityLogPage = (value: unknown) => parseNumberedPage(value, parseActivityLog);
export const parseAuditLogPage = (value: unknown) => parseNumberedPage(value, parseAuditLog);
export function parseLogOptions(value: unknown): LogOptions {
  assert(object(value));
  function options(items: unknown): readonly LogOption[] {
    assert(Array.isArray(items) && items.length <= 200);
    const seen = new Set<string>();
    return items.map(item => { assert(object(item) && code(item.code) && text(item.label, 100) && !seen.has(item.code)); seen.add(item.code); return { code: item.code, label: item.label }; });
  }
  return { types: options(value.types), results: options(value.results), targets: options(value.targets) };
}
