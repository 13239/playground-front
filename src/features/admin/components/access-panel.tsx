"use client";

import { useState } from "react";
import type { AccessPolicy } from "../contracts";
import { useAdminResource } from "../client/use-admin-resource";
import { CodePicker } from "./code-picker";
import { ConfirmDialog, Feedback, Field, formText, Loading, Reason, useAdminMutation, useAdminScope } from "./admin-ui";
import styles from "./admin.module.css";

/** 위임받은 운영 설정과 슈퍼 관리자 전용 예외 역할은 별도 저장 경계로 표시한다. */
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
  const [pending, setPending] = useState<object>();
  const submit = (body: object) => void mutation.run("access-policy", "PUT", body, saved);
  return <section className={styles.panel}>
    <div className={styles.panelHeading}><div><h2>사이트 접속 제한</h2><p>제한 중에는 슈퍼 관리자와 지정한 권한만 접속할 수 있어요.</p></div><span className={policy.enabled ? styles.statusWarning : styles.statusGood}>{policy.enabled ? "접속 제한 중" : "정상 운영 중"}</span></div>
    <form onSubmit={event => {
      event.preventDefault(); if (!writable) return;
      const form = new FormData(event.currentTarget);
      const body = { enabled, message: formText(form, "message"), expectedVersion: policy.version, reason: formText(form, "reason") };
      if (enabled && !policy.enabled) setPending(body); else submit(body);
    }}>
      <fieldset disabled={!writable || mutation.busy} className={styles.formFields}>
        <label className={styles.toggleRow}><span><strong>접속 제한 사용</strong><small>허용되지 않은 기존 세션 종료 및 신규 로그인 차단</small></span><input type="checkbox" role="switch" checked={enabled} onChange={e => setEnabled(e.target.checked)} /></label>
        <Field label="로그인 차단 안내 문구" hint="이 문구가 로그인하는 사용자에게 표시돼요. 최대 300자"><textarea name="message" rows={3} maxLength={300} required defaultValue={policy.message} /></Field>
        {writable && <Reason />}
      </fieldset>
      <div className={styles.actions}><button type="button" onClick={saved} disabled={mutation.busy}>최신 내용 불러오기</button>{writable && <button className={styles.primary} disabled={mutation.busy}>{mutation.busy ? "적용 중…" : "설정 저장"}</button>}</div>
      <Feedback error={mutation.error} success={mutation.success} />
    </form>
    {pending && <ConfirmDialog title="사이트 접속을 제한할까요?" close={() => setPending(undefined)} confirm={() => submit(pending)}><p>슈퍼 관리자와 접속 허용 권한을 제외한 모든 사용자의 기존 로그인이 종료되고 신규 로그인도 차단돼요.</p><p>제한을 해제해도 종료된 세션은 복원되지 않아요.</p></ConfirmDialog>}
  </section>;
}

/** 예외 권한은 별도 명령·버전으로 저장한다. 아직 불러오지 않은 다른 페이지의 선택도 집합에 보존한다. */
function ExemptionsEditor({ policy, saved }: { policy: AccessPolicy; saved: () => void }) {
  const mutation = useAdminMutation();
  const [selected, setSelected] = useState<readonly string[]>(policy.exemptRoleCodes);
  const [pending, setPending] = useState(false);
  const submit = () => void mutation.run("access-policy/exemptions", "PUT", { roleCodes: selected, expectedVersion: policy.version }, saved);
  return <section className={styles.panel}>
    <div className={styles.panelHeading}><div><h2>접속 허용 권한</h2><p>슈퍼 관리자는 항상 접속할 수 있어요. 추가로 허용할 권한을 선택하세요.</p></div></div>
    <CodePicker area="roles" label="접속 허용 권한" selected={selected} change={setSelected} disabled={mutation.busy} exclude={["SUPER_ADMIN"]} />
    <div className={styles.actions}><button type="button" disabled={mutation.busy} onClick={saved}>최신 내용 불러오기</button><button type="button" className={styles.primary} disabled={mutation.busy} onClick={() => policy.enabled ? setPending(true) : submit()}>{mutation.busy ? "적용 중…" : "허용 권한 저장"}</button></div>
    <Feedback error={mutation.error} success={mutation.success} />
    {pending && <ConfirmDialog title="접속 허용 권한을 변경할까요?" close={() => setPending(false)} confirm={submit}><p>현재 접속 제한 중이에요. 허용에서 제외되는 사용자의 기존 로그인이 종료돼요.</p></ConfirmDialog>}
  </section>;
}
