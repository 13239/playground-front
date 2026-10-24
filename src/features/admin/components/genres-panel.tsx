"use client";

import { useState } from "react";
import type { Genre } from "../contracts";
import { AdminList, useAdminList } from "./admin-list";
import { Feedback, Field, formNumber, formText, Reason, useAdminMutation, useAdminScope } from "./admin-ui";
import styles from "./admin.module.css";

/** 장르 목록은 커서로 탐색하고 선택한 항목의 버전만 편집해 임의 덮어쓰기를 막는다. */
export function GenresPanel() {
  const { can } = useAdminScope();
  const list = useAdminList<Genre>("game-genres");
  const [creating, setCreating] = useState(false);
  const genre = list.data?.items.find(g => g.code === list.selected);
  return <div className={styles.masterDetail}>
    <AdminList list={list} label="장르" onSelect={() => setCreating(false)} extra={can("GAME_WRITE") && <button type="button" className={styles.smallPrimary} onClick={() => setCreating(true)}>+ 추가</button>} detail={g => <span className={styles.tag}>{g.enabled ? "사용" : "사용 안 함"}</span>} />
    <section className={styles.panel}>{creating || genre ? <GenreEditor key={creating ? "new" : `${genre!.code}:${genre!.version}:${list.revision}`} genre={creating ? undefined : genre} writable={can("GAME_WRITE")} cancel={() => { setCreating(false); list.reload(); }} saved={() => { setCreating(false); list.reload(); }} /> : <p className={styles.empty}>편집할 장르를 선택하세요.</p>}</section>
  </div>;
}
function GenreEditor({ genre, writable, cancel, saved }: { genre?: Genre; writable: boolean; cancel: () => void; saved: () => void }) {
  const mutation = useAdminMutation();
  return <><div className={styles.panelHeading}><div><h2>{genre?.name ?? "장르 추가"}</h2><p>{genre?.code ?? "검색과 분류에 사용할 장르를 등록하세요."}</p></div></div>
    <form onSubmit={e => {
      e.preventDefault(); if (!writable) return;
      const form = new FormData(e.currentTarget); const code = genre?.code ?? formText(form, "code");
      void mutation.run(`game-genres/${code}`, genre ? "PUT" : "POST", { name: formText(form, "name"), sortOrder: formNumber(form, "sortOrder"), enabled: form.has("enabled"), expectedVersion: genre?.version ?? 0, reason: formText(form, "reason") }, saved);
    }}><fieldset disabled={!writable || mutation.busy} className={styles.formFields}>
      {!genre && <Field label="장르 코드" hint="영문 대문자·숫자·밑줄, 대문자로 시작"><input name="code" required maxLength={64} pattern="[A-Z][A-Z0-9_]{0,63}" /></Field>}
      <Field label="장르 이름"><input name="name" required maxLength={50} defaultValue={genre?.name} /></Field>
      <Field label="노출 순서" hint="작은 숫자가 먼저 표시돼요."><input name="sortOrder" type="number" min={0} max={1000000} required defaultValue={genre?.sortOrder ?? 0} /></Field>
      <label className={styles.checkRow}><input name="enabled" type="checkbox" defaultChecked={genre?.enabled ?? true} /><span>장르 사용<small>사용하지 않는 장르는 공개 장르 목록에서 숨겨져요. 게임의 공개 상태는 별도로 설정하세요.</small></span></label>
      {writable && <Reason />}
    </fieldset><div className={styles.actions}><button type="button" disabled={mutation.busy} onClick={cancel}>{genre ? "최신 내용 불러오기" : "취소"}</button>{writable && <button className={styles.primary} disabled={mutation.busy}>저장</button>}</div><Feedback error={mutation.error} success={mutation.success} /></form></>;
}
