"use client";

import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { AdminContext, PermissionCode } from "../contracts";
import { adminRequest, errorMessage } from "../client/api";
import { AuthRequestError } from "@/features/auth/client/api";
import { invalidateAdminAccess } from "../client/use-admin-access";
import styles from "./admin.module.css";

export const AdminScope = createContext<{ sessionId: string; context: AdminContext; notifySaved: () => void } | null>(null);
export function useAdminScope() {
  const scope = useContext(AdminScope);
  if (!scope) throw new Error("Admin scope required");
  return { ...scope, can: (permission: PermissionCode) => scope.context.permissions.includes(permission) };
}
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className={styles.field}><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}
export function Feedback({ error, success }: { error?: string; success?: string }) {
  return error ? <p className={styles.error} role="alert">{error}</p> : success ? <p className={styles.success} role="status">{success}</p> : null;
}
export function Loading({ error, retry }: { error?: string; retry?: () => void }) {
  return <div className={styles.empty} role="status"><p>{error ?? "설정을 불러오고 있어요."}</p>{error && retry && <button onClick={retry}>다시 불러오기</button>}</div>;
}
export function Reason() { return <Field label="변경 사유 (선택)"><input name="reason" maxLength={300} placeholder="운영 기록에 남길 내용을 입력하세요" /></Field>; }
export const formText = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
export const formNumber = (form: FormData, key: string) => Number(form.get(key));

/** 저장 실패 시 입력은 유지한다. 충돌은 재조회 후 다시 편집하게 하고, 권한 거절은 공통 진입 상태도 갱신한다. */
export function useAdminMutation() {
  const { sessionId, notifySaved } = useAdminScope();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const active = useRef(false);
  async function run<T>(path: string, method: "POST" | "PUT" | "DELETE", body: object | undefined, saved: (value: T) => void) {
    if (active.current) return;
    active.current = true; setBusy(true); setError(undefined); setSuccess(undefined);
    try { const value = await adminRequest<T>(sessionId, path, method, body); saved(value); setSuccess("저장했어요."); notifySaved(); }
    catch (error) {
      setError(errorMessage(error));
      if (error instanceof AuthRequestError && error.status === 403) invalidateAdminAccess();
    } finally { active.current = false; setBusy(false); }
  }
  return { run, busy, error, success };
}

/** 파괴적인 운영 동작은 실행 직전 구체적인 안내로 확인하며 Escape·포커스 복귀를 기본 dialog에 맡긴다. */
export function ConfirmDialog({ title, children, confirm, close }: { title: string; children: ReactNode; confirm: () => void; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} className={styles.dialog} aria-labelledby={id} onCancel={close} onClose={close}>
    <h2 id={id}>{title}</h2><div>{children}</div><div className={styles.actions}>
      <button type="button" autoFocus onClick={close}>취소</button><button type="button" className={styles.primary} onClick={() => { close(); confirm(); }}>확인하고 적용</button>
    </div>
  </dialog>;
}
