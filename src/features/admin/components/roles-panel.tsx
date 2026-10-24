"use client";

import { useState } from "react";
import type { Permission, PermissionCode, Role, RoleSummary } from "../contracts";
import { useAdminResource } from "../client/use-admin-resource";
import { invalidateAdminAccess } from "../client/use-admin-access";
import { AdminList, useAdminList } from "./admin-list";
import { ConfirmDialog, Feedback, Field, formText, Loading, Reason, useAdminMutation, useAdminScope } from "./admin-ui";
import styles from "./admin.module.css";

// 서버의 안정적인 분류 코드는 유지하되 관리 화면에는 사용자가 읽을 수 있는 이름을 표시한다.
const categoryNames: Readonly<Record<string, string>> = { ACCESS: "관리자 접근", DASHBOARD: "대시보드", USER: "사용자 관리", AUTHORIZATION: "권한 관리", OPERATIONS: "운영 설정", CHAT: "채팅", LOG: "로그 · 감사", GAME: "게임 관리" };

/** 역할 목록과 상세를 분리해 역할 개수와 관계없이 같은 편집 흐름을 사용한다. */
export function RolesPanel() {
  const { sessionId, can } = useAdminScope();
  const list = useAdminList<RoleSummary>("roles");
  const [creating, setCreating] = useState(false);
  const role = useAdminResource<Role>(sessionId, list.selected && !creating ? `roles/${list.selected}` : "");
  const permissions = useAdminResource<readonly Permission[]>(sessionId, "permissions");
  const writable = can("ROLE_WRITE") && can("ROLE_PERMISSION_UPDATE");
  return <div className={styles.masterDetail}>
    <AdminList list={list} label="권한" onSelect={() => setCreating(false)} extra={can("ROLE_WRITE") && <button type="button" className={styles.smallPrimary} onClick={() => setCreating(true)}>+ 추가</button>} detail={item => item.systemRole ? <span className={styles.tag}>기본</span> : null} />
    <section className={styles.panel}>
      {!permissions.data ? <Loading error={permissions.error} retry={permissions.reload} /> : creating ? <RoleEditor key="new" permissions={permissions.data} writable={can("ROLE_WRITE")} cancel={() => setCreating(false)} saved={value => { setCreating(false); list.select(value.code); list.reload(); }} />
        : !list.selected ? <div className={styles.empty}>편집할 권한을 선택하세요.</div>
        : !role.data ? <Loading error={role.error} retry={role.reload} />
        : <RoleEditor key={`${role.data.code}:${role.data.version}:${role.revision}`} role={role.data} permissions={permissions.data} writable={writable} cancel={role.reload}
          saved={() => { role.reload(); list.reload(); invalidateAdminAccess(); }} deleted={() => { list.select(undefined); list.reload(); }} />}
    </section>
  </div>;
}

/** 역할 수와 무관하게 선택한 한 역할의 기능만 편집한다. 전용 기능은 일반 역할에 체크할 수 없다. */
function RoleEditor({ role, permissions, writable, cancel, saved, deleted }: {
  role?: Role; permissions: readonly Permission[]; writable: boolean; cancel: () => void; saved: (value: Role) => void; deleted?: () => void;
}) {
  const mutation = useAdminMutation();
  const [selected, setSelected] = useState<readonly PermissionCode[]>(role?.permissions ?? []);
  const [query, setQuery] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editable = writable && (role?.editable ?? true);
  const visible = permissions.filter(p => `${p.name} ${categoryNames[p.category] ?? p.category}`.includes(query.trim()));
  const categories = [...new Set(visible.map(p => p.category))];
  return <>
    <div className={styles.panelHeading}><div><h2>{role ? role.name : "새 권한 추가"}</h2><p>{role?.code ?? "필요한 기능을 선택해 새 역할을 만드세요."}</p></div>{role && <button type="button" disabled={mutation.busy} onClick={cancel}>새로고침</button>}</div>
    <form onSubmit={event => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      if (!editable) return;
      const body = { name: formText(form, "name"), description: formText(form, "description"), permissions: selected, reason: formText(form, "reason"),
        ...(role ? { expectedVersion: role.version } : { code: formText(form, "code") }) };
      void mutation.run<Role>(role ? `roles/${role.code}` : "roles", role ? "PUT" : "POST", body, saved);
    }}>
      <fieldset disabled={!editable || mutation.busy} className={styles.formFields}>
        {!role && <Field label="권한 코드" hint="영문 대문자로 시작, 대문자·숫자·밑줄만 사용"><input name="code" required maxLength={64} pattern="[A-Z][A-Z0-9_]{0,63}" autoComplete="off" /></Field>}
        <Field label="권한 이름"><input name="name" required maxLength={50} defaultValue={role?.name} /></Field>
        <Field label="설명"><textarea name="description" rows={2} maxLength={255} defaultValue={role?.description ?? ""} /></Field>
      </fieldset>
      <div className={styles.subheading}><h3>사용할 수 있는 기능</h3><input type="search" aria-label="기능 검색" placeholder="기능 검색" value={query} onChange={e => setQuery(e.target.value)} /></div>
      {categories.length === 0 && <p className={styles.empty}>검색된 기능이 없어요.</p>}
      <div className={styles.permissionGroups}>{categories.map(category => <fieldset key={category} className={styles.permissionGroup}><legend>{categoryNames[category] ?? category}</legend>{visible.filter(p => p.category === category).map(p => <label key={p.code} className={styles.checkRow}>
        <input type="checkbox" checked={selected.includes(p.code)} disabled={!editable || mutation.busy || p.superAdminOnly} onChange={e => setSelected(current => e.target.checked ? [...current, p.code] : current.filter(c => c !== p.code))} />
        <span>{p.name}{p.superAdminOnly && <small>슈퍼 관리자 전용</small>}</span>
      </label>)}</fieldset>)}</div>
      {editable && <><Reason /><div className={styles.actions}>{role && !role.systemRole && <button type="button" className={styles.danger} disabled={mutation.busy} onClick={() => setConfirmDelete(true)}>권한 삭제</button>}<button type="button" onClick={cancel} disabled={mutation.busy}>{role ? "최신 내용 불러오기" : "취소"}</button><button className={styles.primary} disabled={mutation.busy}>{mutation.busy ? "저장 중…" : "저장"}</button></div></>}
      <Feedback error={mutation.error} success={mutation.success} />
    </form>
    {confirmDelete && role && <ConfirmDialog title="권한을 삭제할까요?" close={() => setConfirmDelete(false)} confirm={() => void mutation.run(`roles/${role.code}?expectedVersion=${role.version}`, "DELETE", undefined, () => { deleted?.(); invalidateAdminAccess(); })}><p>‘{role.name}’ 권한을 삭제해요. 사용 중인 권한은 서버에서 삭제를 거절해요.</p></ConfirmDialog>}
  </>;
}
