"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { Select } from "@/components/ui/select";
import { LobbyIcon } from "@/app/_components/lobby/lobby-icon";
import { ROOT_ROLE_CODE, type Permission, type PermissionCode, type Role } from "../contracts";
import { toggleRolePermission } from "../permission-selection";
import { useAdminResource } from "../client/use-admin-resource";
import { errorMessage } from "../client/api";
import { AuthRequestError } from "@/features/auth/client/api";
import { CatalogDialog, useCatalogDialog } from "./catalog-dialog";
import { ConfirmDialog, Feedback, Field, formText, Loading, useAdminMutation, useAdminScope } from "./admin-ui";
import admin from "./admin.module.css";
import styles from "./roles-panel.module.css";

// 서버의 안정적인 분류 코드는 유지하되 관리 화면에는 사용자가 읽을 수 있는 이름과 공통 아이콘을 표시한다.
const categories: Readonly<Record<string, { name: string; icon: Parameters<typeof LobbyIcon>[0]["name"] }>> = {
  ACCESS: { name: "관리자 접근", icon: "shield" }, DASHBOARD: { name: "대시보드", icon: "chart" },
  USER: { name: "사용자 관리", icon: "users" }, AUTHORIZATION: { name: "권한 관리", icon: "lock" },
  OPERATIONS: { name: "운영 설정", icon: "gear" }, CHAT: { name: "채팅", icon: "chat" },
  LOG: { name: "로그 · 감사", icon: "book" }, GAME: { name: "게임 관리", icon: "gamepad" },
};
const category = (code: string) => categories[code] ?? { name: code, icon: "shield" as const };

/** 상세를 열 때만 기능 목록을 조회하고 저장 후 버전을 갱신하며 모달의 미저장 변경 확인을 재사용한다. */
export function RoleDetailsDialog({ code, close, saved }: { code: string | null; close: () => void; saved: () => void }) {
  const { sessionId, can } = useAdminScope();
  const formId = useId();
  const [activeCategory, setActiveCategory] = useState("USER");
  const role = useAdminResource<Role>(sessionId, code ? `roles/${code}` : "");
  const permissions = useAdminResource<readonly Permission[]>(sessionId, "permissions");
  const ready = Boolean(permissions.data && (!code || role.data));
  const refreshing = Boolean(code) && role.loading;
  const editable = ready && can("ROLE_WRITE") && (!code || can("ROLE_PERMISSION_UPDATE")) && (role.data?.editable ?? true);
  // ROOT 자신의 역할은 편집할 수 없으므로 대상 상세·목록만 갱신해 열린 모달과 분야 선택을 보존한다.
  const refresh = () => { saved(); if (code) role.reload(); else close(); };
  return <CatalogDialog title={code ? "권한 상세 정보" : "권한 추가"} close={close} className={styles.dialog} bodyClassName={styles.dialogBody}
    footer={<RoleDialogFooter formId={formId} ready={ready} editable={editable} refreshing={refreshing} />}>
    {!permissions.data ? <Loading error={permissions.error} retry={permissions.reload} /> : code && !role.data ? <Loading error={role.error} retry={role.reload} />
      // 저장 직후 이전 버전으로 다시 수정하지 않도록 상세 재조회가 끝날 때까지 편집을 잠근다.
      : <div inert={refreshing} aria-busy={refreshing} className={styles.editor}>
        <RoleEditor key={code ? `${code}:${role.data!.version}:${role.revision}` : "new"} formId={formId} role={code ? role.data : undefined}
          permissions={permissions.data} editable={editable} activeCategory={activeCategory} changeCategory={setActiveCategory}
          saved={refresh} deleted={() => { saved(); close(); }} />
      </div>}
  </CatalogDialog>;
}

/** 모달 상태를 자식에서 구독해 저장·닫기 이벤트가 렌더링 중 실행되지 않게 한다. */
function RoleDialogFooter({ formId, ready, editable, refreshing }: { formId: string; ready: boolean; editable: boolean; refreshing: boolean }) {
  const { close, dirty, busy } = useCatalogDialog();
  return <div className={styles.dialogActions}>
    <span className={styles.saveStatus} role="status"><LobbyIcon name="shield" />{refreshing ? "저장한 내용을 확인하고 있어요." : !ready ? "권한 정보를 불러오고 있어요." : !editable ? "조회 전용 권한이에요." : dirty ? "저장하지 않은 변경 내용이 있어요." : "변경 사항 없음"}</span>
    <div className={styles.footerButtons}><button type="button" onClick={close} disabled={busy}>닫기</button>
      {editable && <button type="submit" form={formId} className={admin.primary} disabled={busy || refreshing || !dirty}>{busy ? "저장 중…" : "변경사항 저장"}</button>}
    </div>
  </div>;
}

/** 역할 수와 무관하게 선택한 한 역할의 기능만 편집한다. 전용 기능은 일반 역할에 체크할 수 없다. */
function RoleEditor({ formId, role, permissions, editable, activeCategory, changeCategory, saved, deleted }: {
  formId: string; role?: Role; permissions: readonly Permission[]; editable: boolean; activeCategory: string;
  changeCategory: (category: string) => void; saved: () => void; deleted: () => void;
}) {
  const mutation = useAdminMutation();
  const { saved: markSaved } = useCatalogDialog();
  const [selected, setSelected] = useState<readonly PermissionCode[]>(role?.permissions ?? []);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteNotice, setDeleteNotice] = useState<{ title: string; message: string }>();
  const groupCodes = [...new Set(permissions.map(permission => permission.category))];
  const current = groupCodes.includes(activeCategory) ? activeCategory : groupCodes[0];
  const currentPermissions = permissions.filter(permission => permission.category === current);
  const checkedCount = (items: readonly Permission[]) => items.filter(permission => selected.includes(permission.code)).length;
  const groupId = useId();
  const activateTab = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const direction = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 0;
    if (!direction && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? groupCodes.length - 1 : (index + direction + groupCodes.length) % groupCodes.length;
    changeCategory(groupCodes[next]);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  };
  return <>
    <form id={formId} data-saving={mutation.busy || undefined} onSubmit={event => {
      event.preventDefault(); if (!editable || mutation.busy) return;
      const form = new FormData(event.currentTarget);
      // 모든 분야의 선택을 한 번에 저장하며 기능 검색·변경 사유는 입력하거나 전송하지 않는다.
      const body = { name: formText(form, "name"), description: formText(form, "description"), permissions: selected,
        ...(role ? { expectedVersion: role.version } : { code: formText(form, "code") }) };
      void mutation.run<Role>(role ? `roles/${role.code}` : "roles", role ? "PUT" : "POST", body, () => { markSaved(); saved(); });
    }}>
      <div className={styles.basicInfo}>
        <div className={styles.identity}><div><strong>{role?.name ?? "새 권한"}</strong>{role && <code>{role.code}</code>}</div>
          {/* ROOT는 편집 가능 응답과 별개로 코드를 확인해 삭제 버튼을 만들지 않는다. */}
          {editable && role && role.code !== ROOT_ROLE_CODE && <button type="button" className={admin.danger} disabled={mutation.busy} onClick={() => setConfirmDelete(true)}>권한 삭제</button>}
        </div>
        <fieldset disabled={!editable || mutation.busy} className={`${admin.formFields} ${styles.metadata}`}>
          {!role && <div className={styles.newCode}><Field label="권한 코드" hint="영문 대문자로 시작, 대문자·숫자·밑줄만 사용"><input name="code" required maxLength={64} pattern="[A-Z][A-Z0-9_]{0,63}" autoComplete="off" /></Field></div>}
          <Field label="권한 이름"><input name="name" required maxLength={50} defaultValue={role?.name} /></Field>
          {/* 설명도 권한 이름과 같은 한 줄 입력으로 제공해 상단 필드 높이를 맞춘다. */}
          <Field label="설명"><input name="description" maxLength={255} defaultValue={role?.description ?? ""} /></Field>
          <div className={styles.total}><span>사용 가능한 기능</span><strong>{checkedCount(permissions)}<small> / {permissions.length}</small></strong></div>
        </fieldset>
      </div>
      <div className={styles.permissionWorkspace}>
        <aside className={styles.categorySidebar}>
          <div className={styles.categoryTabs} role="tablist" aria-label="기능 분야" aria-orientation="vertical">
            {groupCodes.map((code, index) => {
              const items = permissions.filter(permission => permission.category === code);
              return <button type="button" role="tab" id={`${groupId}-${code}`} aria-controls={`${groupId}-panel`} aria-selected={current === code}
                tabIndex={current === code ? 0 : -1} key={code} className={styles.categoryTab} onClick={() => changeCategory(code)} onKeyDown={event => activateTab(event, index)}>
                <LobbyIcon name={category(code).icon} /><span>{category(code).name}</span><small>{checkedCount(items)} / {items.length}</small>
                {items.every(permission => permission.superAdminOnly) && <span className={styles.categoryLock} aria-label="ROOT 전용"><LobbyIcon name="lock" /></span>}
              </button>;
            })}
          </div>
          {/* 좁은 모달은 같은 분야 선택을 공통 선택창으로 제공해 가로 넘침과 작은 터치 영역을 피한다. */}
          <label className={styles.mobileCategory}><span>기능 분야</span><Select label="기능 분야 선택" value={current} onValueChange={changeCategory}
            options={groupCodes.map(code => ({ value: code, label: `${category(code).name} (${checkedCount(permissions.filter(permission => permission.category === code))} / ${permissions.filter(permission => permission.category === code).length})` }))} /></label>
          <p className={styles.lockHint}><LobbyIcon name="lock" />잠금 기능은 ROOT 전용이에요.</p>
        </aside>
        <section className={styles.permissionPanel} id={`${groupId}-panel`} role="tabpanel" aria-labelledby={`${groupId}-${current}`} tabIndex={0}>
          <div className={styles.categoryHeading}><h3>{category(current ?? "").name}</h3><p>{checkedCount(currentPermissions)}개 기능 사용 중 ({currentPermissions.length}개 중)</p></div>
          <div className={styles.permissionRows}>{currentPermissions.map(permission => <label key={permission.code} className={styles.permissionRow} data-locked={permission.superAdminOnly || undefined}>
            <span className={styles.permissionIcon}><LobbyIcon name={category(permission.category).icon} /></span>
            <span className={styles.permissionText}><strong>{permission.name}{permission.code === "USER_SENSITIVE_READ" && <span className={styles.sensitive}>개인정보</span>}</strong>
              <small id={`${groupId}-${permission.code}-description`}>{permission.description}</small></span>
            <span className={styles.permissionControl}><input name="permissions" type="checkbox" value={permission.code} aria-label={permission.name}
              aria-describedby={`${groupId}-${permission.code}-description`} checked={selected.includes(permission.code)} disabled={!editable || mutation.busy || permission.superAdminOnly}
              onChange={event => setSelected(current => toggleRolePermission(permissions, current, permission.code, event.target.checked))} />
              {permission.superAdminOnly && <small><LobbyIcon name="lock" />ROOT 전용</small>}
            </span>
          </label>)}</div>
          {editable && <p className={styles.dependencyHint}>기능을 선택하면 필요한 접근·조회 권한도 함께 선택돼요. 해당 권한을 해제하면 연결된 기능도 함께 해제돼요.</p>}
        </section>
      </div>
      <div className={styles.feedback}><Feedback error={mutation.error} /></div>
    </form>
    {confirmDelete && role && <ConfirmDialog title="권한을 삭제할까요?" confirmLabel="삭제" close={() => setConfirmDelete(false)} confirm={() => void mutation.run(`roles/${role.code}?expectedVersion=${role.version}`, "DELETE", undefined, () => { markSaved(); deleted(); }, failure => {
      // 삭제 직전의 서버 검사 결과로 안내하며 거절된 요청은 재전송하거나 편집 초안을 지우지 않는다.
      const inUse = failure instanceof AuthRequestError && ["ROLE_IN_USE", "ROLE_ACCESS_POLICY_IN_USE", "ROLE_DEFAULT_IN_USE"].includes(failure.code ?? "");
      setDeleteNotice({ title: inUse ? "사용 중인 권한은 삭제할 수 없어요" : "권한을 삭제하지 못했어요", message: errorMessage(failure) });
    })}><p>‘{role.name}’ 권한을 삭제해요. 사용 중인 권한은 삭제할 수 없어요.</p></ConfirmDialog>}
    {deleteNotice && <ConfirmDialog title={deleteNotice.title} cancelLabel={null} confirmLabel="확인" close={() => setDeleteNotice(undefined)} confirm={() => setDeleteNotice(undefined)}><p>{deleteNotice.message}</p></ConfirmDialog>}
  </>;
}
