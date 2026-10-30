import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, unlink, writeFile, stat, chmod } from "node:fs/promises";
import path from "node:path";
import { ApiError } from "@/lib/server/api-error";
import { backendFetch } from "@/lib/server/backend-transport";
import { getAppEnvironment, getBackendOrigin, getDevBffSecret } from "@/lib/server/env";

export type LoginFailureReport = Readonly<{
  eventId: string; attemptId: string; occurredAt: string; source: "BFF" | "BROWSER";
  stage: string; reason: string; durationMillis: number; httpStatus: number;
  environment: "local" | "dev" | "prod" | "unknown"; release: string;
  username?: string; clientIp?: string; userAgent?: string; exceptionType?: string;
}>;

const directory = () => path.resolve(process.env.LOGIN_AUDIT_OUTBOX_DIR || ".data/login-audit");
let draining = false;
let started = false;
const MAX_PENDING = 2000;
const safeCode = (value: string) => /^[A-Z][A-Z0-9_]{0,79}$/.test(value) ? value : "UNEXPECTED_FAILURE";
export const safeLoginUsername = (value: unknown): string | undefined => typeof value === "string"
  && [...value].length <= 50 && !/[\p{Cc}\p{Cf}]/u.test(value) ? value : undefined;

/** 자격 증명·쿠키·증명·예외 메시지를 받지 않는 진단 필드만 선택한다. */
export function newLoginReport(input: {
  attemptId: string; started: number; stage: string; error: unknown; source?: "BFF" | "BROWSER";
  username?: string; clientIp?: string; userAgent?: string;
}): LoginFailureReport {
  let environment: LoginFailureReport["environment"] = "unknown";
  try { environment = getAppEnvironment(); } catch { /* 잘못된 환경 설정 자체도 기록 대상이다. */ }
  const error = input.error;
  const name = error instanceof Error && /^[A-Za-z0-9_.$]{1,120}$/.test(error.name) ? error.name : undefined;
  const release = process.env.APP_RELEASE_TAG || "local";
  return {
    eventId: randomUUID(), attemptId: input.attemptId, occurredAt: new Date(input.started).toISOString(),
    source: input.source ?? "BFF", stage: safeCode(input.stage),
    reason: error instanceof ApiError ? safeCode(error.code) : "UNEXPECTED_EXCEPTION",
    durationMillis: Math.min(86400000, Math.max(0, Date.now() - input.started)),
    httpStatus: input.source === "BROWSER" ? 0 : 503, environment,
    release: /^[A-Za-z0-9_.-]{1,128}$/.test(release) ? release : "unknown",
    ...(safeLoginUsername(input.username) !== undefined && { username: safeLoginUsername(input.username) }),
    ...(input.clientIp && /^[0-9a-fA-F:.]{1,45}$/.test(input.clientIp) && { clientIp: input.clientIp }),
    ...(input.userAgent && { userAgent: input.userAgent.replace(/[\p{Cc}\p{Cf}]/gu, "").slice(0, 255) }),
    ...(name && { exceptionType: name }),
  };
}

export async function queueLoginFailure(report: LoginFailureReport): Promise<void> {
  let selected = false;
  try {
    report = selectReport(report);
    selected = true;
    const root = directory();
    await mkdir(root, { recursive: true, mode: 0o700 });
    await chmod(root, 0o700);
    if ((await readdir(root)).length >= MAX_PENDING) throw new Error("audit capacity");
    const data = JSON.stringify(report);
    if (Buffer.byteLength(data) > 8192 || !/^[a-f0-9-]{36}$/.test(report.eventId)) throw new Error("audit format");
    const pending = path.join(root, `${report.eventId}.pending`);
    await writeFile(pending, data, { mode: 0o600 });
    await rename(pending, path.join(root, `${report.eventId}.json`));
    startLoginAuditDelivery();
    void drainLoginFailures();
  } catch {
    // 보고 객체는 위의 명시적인 필드만 포함한다. 비밀값·예외 원문은 출력하지 않는다.
    if (selected) console.error("LOGIN_AUDIT_FALLBACK", JSON.stringify(report));
    else console.error("LOGIN_AUDIT_INVALID_RECORD_DROPPED");
  }
}

export function startLoginAuditDelivery(): void {
  if (started) return;
  started = true;
  setInterval(() => void drainLoginFailures(), 10000).unref();
  void drainLoginFailures();
}

export async function drainLoginFailures(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    const root = directory();
    const names = (await readdir(root)).filter(name => /^[a-f0-9-]{36}\.(json|pending)$/.test(name)).sort().slice(0, 20);
    for (const name of names) {
      const file = path.join(root, name);
      const info = await stat(file);
      if (name.endsWith(".pending") && info.mtimeMs > Date.now() - 60000) continue;
      if (info.size > 8192) { await rename(file, `${file}.invalid`); console.error("LOGIN_AUDIT_INVALID_RECORD", name); continue; }
      let record: LoginFailureReport;
      try { record = selectReport(JSON.parse(await readFile(file, "utf8")) as LoginFailureReport); }
      catch { await rename(file, `${file}.invalid`); console.error("LOGIN_AUDIT_INVALID_RECORD", name); continue; }
      const origin = getBackendOrigin();
      const url = new URL("/internal/auth/login-failures", origin);
      const headers = new Headers({ "Content-Type": "application/json", Accept: "application/json" });
      if (getAppEnvironment() === "dev" && url.protocol === "http:") headers.set("X-BFF-Dev-Secret", getDevBffSecret());
      const response = await backendFetch(url, { method: "POST", headers, body: JSON.stringify(record), signal: AbortSignal.timeout(1500) });
      await response.body?.cancel();
      if (response.ok) await unlink(file);
      else if (response.status === 400) { console.error("LOGIN_AUDIT_REJECTED_RECORD", name); await unlink(file); }
      else break;
    }
  } catch { /* 시작·설정·연결 장애 중에는 디스크에 남겨 복구 후 재전송한다. */ }
  finally { draining = false; }
}

/** 구조적 타입에 다른 키가 섞여도 요청 본문·비밀번호·쿠키·토큰을 디스크에 저장하지 않는다. */
function selectReport(value: LoginFailureReport): LoginFailureReport {
  if (!/^[a-f0-9-]{36}$/.test(value.eventId) || !/^[a-f0-9-]{36}$/.test(value.attemptId)
    || !["BFF", "BROWSER"].includes(value.source) || !/^[A-Z][A-Z0-9_]{0,79}$/.test(value.stage)
    || !/^[A-Z][A-Z0-9_]{0,79}$/.test(value.reason) || !Number.isFinite(Date.parse(value.occurredAt))) throw new Error("Invalid audit record");
  return { eventId: value.eventId, attemptId: value.attemptId, occurredAt: value.occurredAt, source: value.source,
    stage: value.stage, reason: value.reason, durationMillis: value.durationMillis, httpStatus: value.httpStatus,
    environment: value.environment, release: value.release,
    ...(safeLoginUsername(value.username) !== undefined && { username: value.username }),
    ...(value.clientIp && /^[0-9a-fA-F:.]{1,45}$/.test(value.clientIp) && { clientIp: value.clientIp }),
    ...(value.userAgent && { userAgent: value.userAgent.replace(/[\p{Cc}\p{Cf}]/gu, "").slice(0, 255) }),
    ...(value.exceptionType && /^[A-Za-z0-9_.$]{1,120}$/.test(value.exceptionType) && { exceptionType: value.exceptionType }),
  };
}
