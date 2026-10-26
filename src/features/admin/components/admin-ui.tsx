"use client";

import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { AdminContext, PermissionCode } from "../contracts";
import { adminRequest, errorMessage } from "../client/api";
import { AuthRequestError } from "@/features/auth/client/api";
import { RetryButton } from "@/app/_components/retry-button";
import { invalidateAdminAccess } from "../client/use-admin-access";
import styles from "./admin.module.css";
import { CatalogSaveScope } from "./catalog-dialog-state";

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
// 인증 복구에 전달된 대기 시각은 다른 화면과 같은 기준으로 표시하고 일반 관리 데이터 조회에도 재사용한다.
export function Loading({ error, retry, retryAt, pending }: { error?: string; retry?: () => void; retryAt?: number; pending?: boolean }) {
  return <div className={styles.empty} role="status"><p>{error ?? "설정을 불러오고 있어요."}</p>{error && retry && <RetryButton label="다시 불러오기" onRetry={retry} retryAt={retryAt} pending={pending} />}</div>;
}
export function Reason() { return <Field label="변경 사유 (선택)"><input name="reason" maxLength={300} placeholder="운영 기록에 남길 내용을 입력하세요" /></Field>; }
export const formText = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
export const formNumber = (form: FormData, key: string) => Number(form.get(key));

/** 저장 실패 시 입력은 유지한다. 충돌은 재조회 후 다시 편집하게 하고, 권한 거절은 공통 진입 상태도 갱신한다. */
export function useAdminMutation() {
  const { sessionId, notifySaved } = useAdminScope();
  const catalogSave = useContext(CatalogSaveScope);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const active = useRef(false);
  async function run<T>(path: string, method: "POST" | "PUT" | "DELETE", body: object | undefined, saved: (value: T) => void, failed?: (error: unknown) => void) {
    // 카탈로그 상세의 두 폼도 저장을 직렬화한다. 다른 관리자 화면에서는 기존 폼별 동작을 유지한다.
    if (active.current || catalogSave && !catalogSave.acquire()) return;
    active.current = true; setBusy(true); setError(undefined); setSuccess(undefined);
    try { const value = await adminRequest<T>(sessionId, path, method, body); saved(value); setSuccess("저장했어요."); notifySaved(); }
    catch (error) {
      // 삭제 거절처럼 호출 화면이 팝업으로 처리할 실패는 위임하고 나머지는 기존 폼 안내를 유지한다.
      if (failed) failed(error); else setError(errorMessage(error));
      if (error instanceof AuthRequestError && error.status === 403) invalidateAdminAccess();
    } finally { active.current = false; setBusy(false); catalogSave?.release(); }
  }
  return { run, busy: busy || catalogSave?.busy === true, error, success };
}

/** 파괴적인 운영 동작은 실행 직전 확인하고 삭제 제한은 단일 확인으로 안내하며 Escape·포커스 복귀를 기본 dialog에 맡긴다. */
export function ConfirmDialog({ title, children, confirm, close, confirmLabel = "확인하고 적용", cancelLabel = "취소" }: { title: string; children: ReactNode; confirm: () => void; close: () => void; confirmLabel?: string; cancelLabel?: string | null }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const descriptionId = useId();
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} className={`${styles.dialog} ${styles.confirmDialog}`} role={cancelLabel === null ? "alertdialog" : undefined} aria-labelledby={id} aria-describedby={descriptionId} onCancel={close} onClose={event => {
    // 개발 모드의 effect 재구독에서 예약된 이전 close 이벤트가 다시 열린 확인창을 닫지 않게 한다.
    if (event.target === event.currentTarget && !event.currentTarget.open) close();
  }}>
    <h2 id={id}>{title}</h2><div id={descriptionId}>{children}</div><div className={styles.actions}>
      {/* 닫기·설정 적용은 호출 화면의 이름을 따르고 삭제 거절 안내는 확인 버튼 하나로 닫는다. */}
      {cancelLabel !== null && <button type="button" autoFocus onClick={close}>{cancelLabel}</button>}<button type="button" autoFocus={cancelLabel === null} className={styles.primary} onClick={() => { close(); confirm(); }}>{confirmLabel}</button>
    </div>
  </dialog>;
}
