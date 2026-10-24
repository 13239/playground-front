"use client";

import { useState } from "react";
import type { Game, Mode } from "../contracts";
import { ConfirmDialog, Feedback, Field, formText, Reason, useAdminMutation, useAdminScope } from "./admin-ui";
import styles from "./admin.module.css";

/** 게임과 개별 모드는 같은 운영 계약을 사용한다. 숨김도 직접 주소의 신규 실행을 막는다. */
export function GameAvailabilityEditor({ item, path, saved, title = "공개 및 이용 상태" }: { item: Game | Mode; path: string; saved: () => void; title?: string }) {
  const { can } = useAdminScope();
  const mutation = useAdminMutation();
  const [pending, setPending] = useState<object>();
  const writable = can("GAME_AVAILABILITY_UPDATE");
  const submit = (body: object) => void mutation.run(path, "PUT", body, saved);
  return <section className={styles.inset}>
    <h3>{title}</h3>
    <form onSubmit={e => {
      e.preventDefault(); if (!writable) return;
      const form = new FormData(e.currentTarget);
      const body = { published: form.has("published"), availability: formText(form, "availability"), message: formText(form, "message"), reason: formText(form, "reason"), expectedVersion: item.version };
      if ((!body.published || body.availability !== "AVAILABLE") && item.published && item.availability === "AVAILABLE") setPending(body); else submit(body);
    }}><fieldset disabled={!writable || mutation.busy} className={styles.formFields}>
      <label className={styles.checkRow}><input name="published" type="checkbox" defaultChecked={item.published} /><span>목록에 공개<small>숨기면 직접 주소를 통한 신규 실행·입장도 차단돼요.</small></span></label>
      <Field label="이용 상태"><select name="availability" defaultValue={item.availability}><option value="AVAILABLE">이용 가능</option><option value="MAINTENANCE">점검 중</option><option value="DISABLED">이용 중지</option></select></Field>
      <Field label="이용 제한 안내 문구"><textarea name="message" rows={2} maxLength={300} defaultValue={item.unavailableMessage} /></Field>
      {writable && <Reason />}
    </fieldset>{writable && <div className={styles.actions}><button className={styles.primary} disabled={mutation.busy}>{mutation.busy ? "저장 중…" : "이용 상태 저장"}</button></div>}<Feedback error={mutation.error} success={mutation.success} /></form>
    {pending && <ConfirmDialog title="신규 게임 이용을 제한할까요?" close={() => setPending(undefined)} confirm={() => submit(pending)}><p>새 실행·입장과 재대국이 차단돼요. 이미 진행 중인 대국은 이어갈 수 있어요.</p></ConfirmDialog>}
  </section>;
}
