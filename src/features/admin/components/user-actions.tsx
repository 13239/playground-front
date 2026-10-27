"use client";

import { useId, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Select, type SelectOption } from "@/components/ui/select";
import { USER_STATUS_LABELS, type AdminUser } from "../user-contracts";
import { ROOT_ROLE_CODE } from "../contracts";
import { useUserRoleOptions } from "../client/use-user-role-options";
import { revalidateAuthSession } from "@/features/auth/client/session-store";
import { ConfirmDialog, Feedback, formText, useAdminMutation, useAdminScope } from "./admin-ui";
import common from "./admin.module.css";
import styles from "./user-actions.module.css";

// 상태 선택은 저장 전 초안이며 현재 상태와 비교한 뒤 명시적인 변경 버튼으로만 적용한다.
const STATUS_CHOICES = ["ACTIVE", "INACTIVE", "WITHDRAWN"] as const;
type EditableStatus = (typeof STATUS_CHOICES)[number];
type PendingAction = { title: string; message: string; path: string; method: "PUT" | "POST"; body: object; logout?: boolean };

/** 업무별 기능 권한을 구분하고 실행 전에 대상·행동을 확인한다. 본인/최고 관리자 보호는 서버도 강제한다. */
export function UserActions({ user, saved }: { user: AdminUser; saved: () => void }) {
  const { can, context } = useAdminScope();
  const mutation = useAdminMutation();
  const id = useId();
  const [role, setRole] = useState<SelectOption>({ value: user.roleCode, label: user.roleName, description: user.roleCode });
  const [status, setStatus] = useState<EditableStatus>(user.status === "INACTIVE" ? "INACTIVE" : "ACTIVE");
  const [pending, setPending] = useState<PendingAction>();
  // DB 롤백 후 Redis 차단만 남은 활성 계정도 기존 재활성화 처리로 복구할 수 있게 재적용을 허용한다.
  const reapplyingActive = user.status === "ACTIVE" && status === "ACTIVE";
  // ROOT는 일반 권한 배정이나 계정 상태 변경으로 만들거나 해제할 수 없다.
  const protectedUser = user.roleCode === ROOT_ROLE_CODE;
  const canAssignRole = can("USER_ROLE_UPDATE") && !protectedUser && !user.deleted && user.status !== "WITHDRAWN";
  const roleOptions = useUserRoleOptions(canAssignRole);
  const roleErrorId = `${id}-role-error`;
  const roleDisabled = mutation.busy || roleOptions.loading || !!roleOptions.error;
  // 선택 목록은 서버의 전체 커서를 읽고 ROOT를 제외한다. 조회 중에도 현재/선택한 권한의 표시 이름을 유지한다.
  const choices: readonly SelectOption[] = [
    ...(roleOptions.items.some(item => item.code === role.value) ? [] : [role]),
    ...roleOptions.items.filter(item => item.code !== ROOT_ROLE_CODE).map(item => ({ value: item.code, label: item.name, description: item.code })),
  ];
  // 권한 이름이 바뀌어도 콤보박스·현재 값·변경 예고가 같은 최신 표시 이름을 사용한다.
  const currentRoleName = roleOptions.items.find(item => item.code === user.roleCode)?.name ?? user.roleName;
  const nextRoleName = choices.find(option => option.value === role.value)?.label ?? role.label;
  // 삭제와 탈퇴를 구분하며 두 경우 모두 일반 계정 관리로 상태를 복구하지 않는다.
  if (user.deleted) return <p className={common.empty}>삭제된 회원은 변경할 수 없어요.</p>;
  if (user.status === "WITHDRAWN") return <p className={common.empty}>탈퇴한 회원은 변경할 수 없어요.</p>;
  return <div className={styles.root} aria-busy={mutation.busy}>
    <div className={styles.heading}><h3>계정 관리</h3><p>회원의 권한, 계정 상태, 로그인 세션을 관리합니다.</p></div>
    {canAssignRole && <section className={styles.card} aria-labelledby={`${id}-role-title`}>
      <div className={styles.cardHeader}><span className={styles.cardIcon}><Icon name="shield" /></span><div>
        <h4 id={`${id}-role-title`}>권한 배정</h4><span className={styles.currentBadge}>현재 권한 · {currentRoleName}</span>
      </div></div>
      <form className={styles.form} onSubmit={event => {
        event.preventDefault();
        if (roleDisabled || role.value === user.roleCode || !role.value) return;
        // 권한 배정 사유 입력을 제거하고 역할 코드와 낙관적 잠금 버전만 전송한다.
        setPending({ title: "회원의 권한을 변경할까요?", message: `${user.nickname} 회원의 권한을 변경해요. (${currentRoleName} → ${nextRoleName}) 기존 로그인은 모두 종료돼요.`,
          path: `users/${user.id}/role`, method: "PUT", body: { roleCode: role.value, expectedVersion: user.roleVersion }, logout: user.id === context.userId });
      }}>
        <div className={styles.controlField}><label htmlFor={`${id}-role`}>배정할 권한</label>
          <Select id={`${id}-role`} label="배정할 권한" value={role.value} options={choices} disabled={roleDisabled}
            aria-describedby={roleOptions.error ? roleErrorId : undefined} onValueChange={value => {
              const next = choices.find(option => option.value === value);
              if (next) setRole(next);
            }} />
          {roleOptions.loading && <p className={styles.hint} role="status">권한 목록을 불러오고 있어요.</p>}
          {roleOptions.error && <p id={roleErrorId} className={common.error} role="alert">{roleOptions.error} <button type="button" disabled={mutation.busy} onClick={roleOptions.retry}>다시 불러오기</button></p>}
        </div>
        <ChangePreview label="권한" current={currentRoleName} next={nextRoleName} />
        <div className={styles.actionRow}><p className={styles.hint}>권한 변경 시 기존 로그인이 종료됩니다.</p>
          <button type="submit" className={common.primary} disabled={roleDisabled || role.value === user.roleCode}>권한 변경</button>
        </div>
      </form>
    </section>}
    {can("USER_STATUS_UPDATE") && !protectedUser && <section className={styles.card} aria-labelledby={`${id}-status-title`}>
      <div className={styles.cardHeader}><span className={styles.cardIcon}><Icon name="chart" /></span><div>
        <h4 id={`${id}-status-title`}>계정 상태</h4><span className={styles.currentBadge} data-active={user.status === "ACTIVE"}>현재 · {USER_STATUS_LABELS[user.status]}</span>
      </div></div>
      <form onSubmit={event => {
        event.preventDefault();
        if (mutation.busy || status === user.status && !reapplyingActive) return;
        const form = new FormData(event.currentTarget);
        const withdrawing = status === "WITHDRAWN", deactivating = status === "INACTIVE";
        // 탈퇴는 삭제 시각을 쓰지 않는 상태 변경이며 기존 확인·사유·버전 검증을 그대로 사용한다.
        setPending({
          title: withdrawing ? "회원을 탈퇴 상태로 변경할까요?" : deactivating ? "계정을 비활성화할까요?" : reapplyingActive ? "활성 상태를 다시 적용할까요?" : "계정을 활성화할까요?",
          message: withdrawing ? `${user.username} 회원의 기존 로그인을 종료하고 탈퇴 상태로 변경해요. 이 화면에서는 탈퇴를 복구할 수 없어요.`
            : deactivating ? `${user.username} 회원의 기존 로그인이 종료되고 새 로그인이 차단돼요.`
              : `${user.username} 회원의 새 로그인을 허용해요. 종료된 세션은 복원되지 않아요.`,
          path: `users/${user.id}/status`, method: "PUT", body: { status, expectedVersion: user.managementVersion, reason: formText(form, "reason") },
        });
      }} className={styles.form}>
        {/* 본인 비활성화·탈퇴 금지와 저장 중 잠금은 상태 분할 선택에서도 유지한다. */}
        {/* 승인한 시안의 분할 선택은 네이티브 라디오로 구현하고 공통 1px 포커스를 표시 영역에 적용한다. */}
        <fieldset className={styles.statusOptions} disabled={mutation.busy}>
          <legend>변경할 상태</legend><div>{STATUS_CHOICES.map(value => <label key={value} className={styles.statusChoice}>
            <input type="radio" name="status" value={value} checked={status === value} disabled={user.id === context.userId && value !== "ACTIVE"}
              onChange={() => setStatus(value)} /><span data-danger={value === "WITHDRAWN"}>{USER_STATUS_LABELS[value]}</span>
          </label>)}</div>
        </fieldset>
        <ChangePreview label="상태" current={USER_STATUS_LABELS[user.status]} next={USER_STATUS_LABELS[status]} active={user.status === "ACTIVE"} />
        <div className={styles.statusHelp} role="status"><p>{reapplyingActive ? "활성 상태를 다시 적용하면 남아 있는 로그인 차단을 해제할 수 있습니다." : "상태 변경 버튼을 누르면 적용됩니다."}</p>
          <p className={styles.hint}>{status === "WITHDRAWN" ? "탈퇴하면 모든 기기에서 로그아웃되며, 이 화면에서는 복구할 수 없습니다."
            : status === "INACTIVE" ? "비활성화하면 모든 기기에서 로그아웃되고 새 로그인이 차단됩니다."
              : "활성화하면 새 로그인을 허용합니다. 종료된 로그인은 복원되지 않습니다."}</p>
        </div>
        <ActionReason disabled={mutation.busy} label="변경 사유" placeholder="상태 변경 사유를 입력하세요" />
        <div className={styles.submitRow}><button type="submit" className={common.primary} disabled={mutation.busy || status === user.status && !reapplyingActive}>{reapplyingActive ? "활성 상태 재적용" : "상태 변경"}</button></div>
      </form>
    </section>}
    {can("USER_SESSION_REVOKE") && (!protectedUser || context.roleCode === ROOT_ROLE_CODE) && <section className={styles.card} aria-labelledby={`${id}-logout-title`}>
      <div className={styles.cardHeader}><span className={`${styles.cardIcon} ${styles.logoutIcon}`}><Icon name="exit" /></span><div>
        <h4 id={`${id}-logout-title`}>강제 로그아웃</h4><p>모든 기기에서 로그아웃되며, 계정 상태는 유지됩니다.</p>
      </div></div>
      <form className={styles.logoutForm} onSubmit={event => {
        event.preventDefault();
        if (mutation.busy) return;
        setPending({ title: "모든 기기에서 로그아웃시킬까요?", message: `${user.nickname} 회원의 현재 로그인이 모두 종료돼요.`,
          path: `users/${user.id}/sessions/revoke`, method: "POST", body: { expectedVersion: user.managementVersion, reason: formText(new FormData(event.currentTarget), "reason") }, logout: user.id === context.userId });
      }}>
        <ActionReason disabled={mutation.busy} label="강제 로그아웃 사유" placeholder="강제 로그아웃 사유를 입력하세요" />
        <button type="submit" className={styles.logoutButton} disabled={mutation.busy}>모든 로그인 종료</button>
      </form>
    </section>}
    {!can("USER_ROLE_UPDATE") && !can("USER_STATUS_UPDATE") && !can("USER_SESSION_REVOKE") && <p className={common.empty}>계정 관리 기능을 사용할 권한이 없어요.</p>}
    {protectedUser && <p className={styles.hint}>ROOT 계정의 권한과 상태는 변경할 수 없어요.</p>}
    <Feedback error={mutation.error} success={mutation.success} />
    {pending && <ConfirmDialog title={pending.title} close={() => setPending(undefined)} confirm={() => void mutation.run(pending.path, pending.method, pending.body, () => { if (pending.logout) revalidateAuthSession(); else saved(); })}><p>{pending.message}</p></ConfirmDialog>}
  </div>;
}

/** 현재 저장된 값과 적용 전 초안을 같은 배치로 표시하고 선택만으로 저장되지 않음을 구분한다. */
function ChangePreview({ label, current, next, active = false }: { label: string; current: string; next: string; active?: boolean }) {
  return <div className={styles.preview} role="group" aria-label={`${label} 변경 전후`} aria-live="polite" aria-atomic="true">
    <div><span>현재 {label}</span><strong data-active={active}>{current}</strong></div><Icon name="arrow" />
    <div><span>변경 후 {label}</span><strong data-next>{next}</strong></div>
  </div>;
}

/** 두 운영 사유는 각각 필수이며 공백만 입력한 값도 제출 전에 거절한다. */
function ActionReason({ disabled, label, placeholder }: { disabled: boolean; label: string; placeholder: string }) {
  const id = useId();
  const [invalid, setInvalid] = useState(false);
  return <div className={styles.reasonField}>
    <label htmlFor={id}>{label}<span className={styles.required} aria-hidden="true">필수</span></label>
    <input id={id} name="reason" maxLength={300} required pattern=".*\S.*" disabled={disabled} placeholder={placeholder}
      aria-invalid={invalid || undefined} aria-describedby={invalid ? `${id}-error` : undefined}
      onInvalid={event => { event.preventDefault(); setInvalid(true); event.currentTarget.focus(); }}
      onChange={event => { if (event.currentTarget.validity.valid) setInvalid(false); }} />
    {invalid && <p id={`${id}-error`} className={styles.reasonError} role="alert">{label}를 입력해 주세요. 공백만 입력할 수 없어요.</p>}
  </div>;
}
