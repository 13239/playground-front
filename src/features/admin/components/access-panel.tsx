"use client";

import { useState } from "react";
import type { AccessPolicy, RoleSummary } from "../contracts";
import { useAdminResource } from "../client/use-admin-resource";
import { AccessRolePicker } from "./access-role-picker";
import { ConfirmDialog, Feedback, Field, formText, Loading, Reason, useAdminMutation, useAdminScope } from "./admin-ui";
import styles from "./admin.module.css";
import access from "./access-panel.module.css";

type PolicyChange = { enabled: boolean; signUpRestricted: boolean; message: string; expectedVersion: number; reason: string };

/** 위임받은 운영 설정과 ROOT 전용 예외 역할은 별도 저장 경계로 표시한다. */
export function AccessPanel() {
  const { sessionId, can } = useAdminScope();
  const policy = useAdminResource<AccessPolicy>(sessionId, "access-policy");
  if (!policy.data) return <section className={styles.panel}><Loading error={policy.error} retry={policy.reload} /></section>;
  return <div className={styles.stack}>
    <PolicyEditor key={`policy:${policy.data.version}:${policy.revision}`} policy={policy.data} saved={policy.reload} writable={can("ACCESS_POLICY_UPDATE")} />
    {can("ACCESS_EXEMPTION_UPDATE") && <ExemptionsEditor key={`exemptions:${policy.data.version}:${policy.revision}`} policy={policy.data} saved={policy.reload} />}
  </div>;
}

function PolicyEditor({ policy, saved, writable }: { policy: AccessPolicy; saved: () => void; writable: boolean }) {
  const mutation = useAdminMutation();
  const [enabled, setEnabled] = useState(policy.enabled);
  // 로그인 제한과 가입 제한은 각각 편집하고 같은 버전으로 저장한다.
  const [signUpRestricted, setSignUpRestricted] = useState(policy.signUpRestricted);
  const [pending, setPending] = useState<PolicyChange>();
  const submit = (body: object) => void mutation.run("access-policy", "PUT", body, saved);
  return <section className={styles.panel}>
    <div className={styles.panelHeading}><div><h2>사이트 접속·회원가입 제한</h2><p>접속 제한 중에는 ROOT와 지정한 권한만 로그인할 수 있어요.</p></div>
      <div className={access.statuses}><span className={policy.enabled ? styles.statusWarning : styles.statusGood}>{policy.enabled ? "접속 제한 중" : "접속 허용 중"}</span><span className={policy.signUpRestricted ? styles.statusWarning : styles.statusGood}>{policy.signUpRestricted ? "회원가입 제한 중" : "회원가입 허용 중"}</span></div>
    </div>
    <form onSubmit={event => {
      event.preventDefault(); if (!writable) return;
      const form = new FormData(event.currentTarget);
      // 관리자 안내 본문은 임의로 다듬지 않고 서버 검증을 거쳐 원문 그대로 저장한다.
      const body = { enabled, signUpRestricted, message: String(form.get("message") ?? ""), expectedVersion: policy.version, reason: formText(form, "reason") };
      if (enabled && !policy.enabled || signUpRestricted && !policy.signUpRestricted) setPending(body); else submit(body);
    }}>
      <fieldset disabled={!writable || mutation.busy} className={styles.formFields}>
        <div className={access.switches}>
          <label className={styles.toggleRow}><span><strong>접속 제한 사용</strong><small>허용되지 않은 기존 세션 종료 및 신규 로그인 차단</small></span><input type="checkbox" role="switch" checked={enabled} onChange={e => setEnabled(e.target.checked)} /></label>
          <label className={styles.toggleRow}><span><strong>회원가입 제한 사용</strong><small>신규 회원가입 차단 · 기본 안내 메시지 표시</small></span><input type="checkbox" role="switch" checked={signUpRestricted} onChange={e => setSignUpRestricted(e.target.checked)} /></label>
        </div>
        <Field label="로그인 차단 안내 문구" hint="로그인이 차단되면 확인창에 이 문구를 그대로 표시해요. 최대 300자"><textarea name="message" rows={3} maxLength={300} required defaultValue={policy.message} /></Field>
        {writable && <Reason />}
      </fieldset>
      {/* 수동 새로고침 버튼은 없애고 저장 후에만 현재 정책을 다시 읽는다. */}
      {writable && <div className={styles.actions}><button className={styles.primary} disabled={mutation.busy}>{mutation.busy ? "적용 중…" : "설정 저장"}</button></div>}
      <Feedback error={mutation.error} success={mutation.success} />
    </form>
    {pending && <ConfirmDialog title="운영 제한 설정을 적용할까요?" close={() => setPending(undefined)} confirm={() => submit(pending)}>
      {pending.enabled && !policy.enabled && <><p>ROOT와 접속 허용 권한을 제외한 모든 사용자의 기존 로그인이 종료되고 신규 로그인도 차단돼요.</p><p>제한을 해제해도 종료된 세션은 복원되지 않아요.</p></>}
      {pending.signUpRestricted && !policy.signUpRestricted && <p>신규 회원가입이 제한되며 기본 안내 메시지가 표시돼요.</p>}
    </ConfirmDialog>}
  </section>;
}

/** 예외 권한은 별도 명령·버전으로 저장한다. 아직 불러오지 않은 다른 페이지의 선택도 집합에 보존한다. */
function ExemptionsEditor({ policy, saved }: { policy: AccessPolicy; saved: () => void }) {
  const mutation = useAdminMutation();
  const [selected, setSelected] = useState<readonly RoleSummary[]>(policy.exemptRoles);
  const [pending, setPending] = useState(false);
  const submit = () => void mutation.run("access-policy/exemptions", "PUT", { roleCodes: selected.map(role => role.code), expectedVersion: policy.version }, saved);
  return <section className={styles.panel}>
    <div className={styles.panelHeading}><div><h2>접속 허용 권한</h2><p>접속 제한 중에도 로그인할 수 있는 권한을 설정해요.</p></div><span className={access.count}>추가 선택 {selected.length}개</span></div>
    <AccessRolePicker selected={selected} change={setSelected} disabled={mutation.busy} />
    <div className={`${styles.actions} ${access.actionRow}`}><p className={access.saveHint}>선택한 권한은 저장 후 적용돼요.</p><button type="button" className={styles.primary} disabled={mutation.busy} onClick={() => policy.enabled ? setPending(true) : submit()}>{mutation.busy ? "적용 중…" : "허용 권한 저장"}</button></div>
    <Feedback error={mutation.error} success={mutation.success} />
    {pending && <ConfirmDialog title="접속 허용 권한을 변경할까요?" close={() => setPending(false)} confirm={submit}><p>현재 접속 제한 중이에요. 허용에서 제외되는 사용자의 기존 로그인이 종료돼요.</p></ConfirmDialog>}
  </section>;
}
