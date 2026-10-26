"use client";

import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode, type SyntheticEvent } from "react";
import { LobbyIcon } from "@/app/_components/lobby/lobby-icon";
import { focusWithoutRing, showModalWithoutCloseFocus } from "@/lib/client/show-modal";
import { ConfirmDialog } from "./admin-ui";
import styles from "./admin.module.css";
import grid from "./catalog-grid.module.css";
import { CatalogSaveScope } from "./catalog-dialog-state";

const CatalogDialogScope = createContext<{ changed: (form?: HTMLFormElement | null) => void; saved: () => void; navigate: (action: () => void) => void; close: () => void; dirty: boolean; busy: boolean } | null>(null);
export function useCatalogDialog() {
  const scope = useContext(CatalogDialogScope);
  if (!scope) throw new Error("Catalog dialog required");
  return scope;
}

/** 상세의 미저장 확인·Escape·포커스 복귀를 공유하고 필요한 화면은 고정 푸터에서 폼을 저장한다. */
export function CatalogDialog({ title, children, close, className = "", bodyClassName = "", footer }: {
  title: string; children: ReactNode; close: () => void; className?: string; bodyClassName?: string;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [dirty, setDirty] = useState(false);
  const [confirm, setConfirm] = useState<{ title: string; description: string; proceed: () => void; confirmLabel?: string }>();
  const [notice, setNotice] = useState<string>();
  const changedForms = useRef(new Set<HTMLFormElement>());
  const permittedSubmit = useRef<HTMLFormElement | undefined>(undefined);
  const saving = useRef(false);
  const [saveBusy, setSaveBusy] = useState(false);
  useEffect(() => {
    const dialog = ref.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const cleanup = showModalWithoutCloseFocus(dialog);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { cleanup?.(); dialog?.close(); document.body.style.overflow = overflow;
      if (previousFocus?.isConnected) focusWithoutRing(previousFocus);
    };
  }, []);
  useEffect(() => {
    if (!dirty && !saveBusy) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty, saveBusy]);
  function clearChanges() { changedForms.current.clear(); setDirty(false); setNotice(undefined); }
  function requestAction(action: () => void, title: string, description: string, confirmLabel?: string) {
    if (saving.current || ref.current?.querySelector('[data-saving="true"]')) { setNotice("저장 중이에요. 잠시만 기다려 주세요."); return; }
    setNotice(undefined);
    if (dirty) setConfirm({ title, description, confirmLabel, proceed: () => { clearChanges(); action(); } }); else action();
  }
  function requestClose() {
    requestAction(close, "수정 내용을 닫을까요?", "저장하지 않은 변경 내용은 사라져요.", "닫기");
  }
  function markChanged(form?: HTMLFormElement | null) {
    if (form) changedForms.current.add(form);
    setDirty(true);
  }
  function changed(event: SyntheticEvent) {
    const target = event.target;
    // 검색어나 탭·모드 선택은 저장 대상이 아니므로 이름이 있는 실제 편집 필드만 변경으로 취급한다.
    if ((target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) && target.name) markChanged(target.closest("form"));
  }
  function submitting(event: SyntheticEvent) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (permittedSubmit.current === form) { permittedSubmit.current = undefined; return; }
    const others = [...changedForms.current].filter(changed => changed !== form && changed.isConnected);
    if (others.length === 0) return;
    // 모드 정보와 이용 상태를 함께 편집했을 때 한쪽 저장의 상세 재조회가 다른 초안을 조용히 지우지 않게 한다.
    event.preventDefault(); event.stopPropagation();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    setConfirm({ title: "다른 수정 내용은 제외하고 저장할까요?", description: "지금 저장할 항목 외의 수정 내용은 초기화돼요. 함께 유지하려면 취소한 뒤 한 항목씩 저장해 주세요.", proceed: () => {
      if (!form.isConnected) return;
      for (const changed of others) { changed.reset(); changedForms.current.delete(changed); }
      setDirty(changedForms.current.size > 0); permittedSubmit.current = form;
      try { form.requestSubmit(submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement ? submitter : undefined); }
      finally { permittedSubmit.current = undefined; }
    } });
  }
  return <CatalogSaveScope value={{ busy: saveBusy, acquire: () => {
    if (saving.current) return false;
    saving.current = true; setSaveBusy(true); return true;
  }, release: () => { saving.current = false; setSaveBusy(false); } }}><CatalogDialogScope value={{ changed: markChanged, saved: clearChanges,
    navigate: action => requestAction(action, "수정 내용을 버리고 이동할까요?", "저장하지 않은 변경 내용은 사라져요."), close: requestClose, dirty, busy: saveBusy }}>
    <dialog ref={ref} className={`${styles.dialog} ${grid.dialog} ${className}`} aria-labelledby={titleId}
      onInputCapture={changed} onChangeCapture={changed} onSubmitCapture={submitting} onCancel={event => {
        // 내부 확인 모달의 Escape는 해당 모달만 닫고 바깥 편집 모달을 다시 취소하지 않는다.
        if (event.target === event.currentTarget) { event.preventDefault(); requestClose(); }
      }}>
      <div className={grid.dialogTop}><div><span>ADMINISTRATION</span><h2 id={titleId}>{title}</h2></div>
        <button type="button" className={styles.iconButton} aria-label={`${title} 닫기`} title="닫기" onClick={requestClose}><LobbyIcon name="close" /></button>
      </div>
      <div className={`${grid.dialogBody} ${bodyClassName}`}>{children}</div>
      <div className={grid.dialogFooter}>{notice && <p role="status">{notice}</p>}{footer ?? <button type="button" onClick={requestClose}>닫기</button>}</div>
      {confirm && <ConfirmDialog title={confirm.title} close={() => setConfirm(undefined)} confirm={confirm.proceed} confirmLabel={confirm.confirmLabel}><p>{confirm.description}</p></ConfirmDialog>}
    </dialog>
  </CatalogDialogScope></CatalogSaveScope>;
}
