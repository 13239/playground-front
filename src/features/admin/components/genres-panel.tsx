"use client";

import type { GenreGridItem } from "../catalog-grid-contracts";
import { useAdminResource } from "../client/use-admin-resource";
import { Feedback, Field, formText, Loading, useAdminMutation, useAdminScope } from "./admin-ui";
import { CatalogGrid, type CatalogColumn } from "./catalog-grid";
import { CatalogDialog, useCatalogDialog } from "./catalog-dialog";
import styles from "./admin.module.css";

const columns: readonly CatalogColumn<GenreGridItem>[] = [
  { label: "사용 여부", cell: genre => <span className={genre.enabled ? styles.statusGood : styles.tag}>{genre.enabled ? "사용" : "사용 안 함"}</span> },
  { label: "연결 게임", cell: genre => `${genre.gameCount.toLocaleString()}개` },
];

/** 장르 목록은 번호 페이지로 탐색하고 선택한 항목의 버전만 모달에서 편집해 임의 덮어쓰기를 막는다. */
export function GenresPanel() {
  return <CatalogGrid<GenreGridItem> area="game-genres" label="장르" columns={columns}
    dialog={(code, close, saved) => <CatalogDialog key={code ?? "new"} title={code ? "장르 상세 정보" : "장르 추가"} close={close}>
      <GenreDialogBody code={code} close={close} saved={saved} />
    </CatalogDialog>} />;
}
function GenreDialogBody({ code, close, saved }: { code: string | null; close: () => void; saved: () => void }) {
  const { sessionId, can } = useAdminScope();
  const { saved: markSaved } = useCatalogDialog();
  const details = useAdminResource<GenreGridItem>(sessionId, code ? `game-genres/${code}` : "");
  const reload = () => { markSaved(); saved(); if (code) details.reload(); else close(); };
  if (code && !details.data) return <Loading error={details.error} retry={details.reload} />;
  // 저장 후 이전 버전의 폼이 잠깐 다시 편집되거나 재조회 결과에 새 입력이 지워지지 않게 한다.
  const refreshing = Boolean(code) && details.loading;
  return <><div inert={refreshing} aria-busy={refreshing}><GenreEditor key={code ? `${code}:${details.data!.version}` : "new"} genre={code ? details.data : undefined} writable={can("GAME_WRITE")} saved={reload} /></div>
    {refreshing && <p className={styles.hint} role="status">저장한 내용을 확인하고 있어요.</p>}</>;
}
function GenreEditor({ genre, writable, saved }: { genre?: GenreGridItem; writable: boolean; saved: () => void }) {
  const mutation = useAdminMutation();
  return <><div className={styles.panelHeading}><div><h2>{genre?.name ?? "장르 추가"}</h2><p>{genre?.code ?? "검색과 분류에 사용할 장르를 등록하세요."}</p></div></div>
    {genre && <p className={styles.hint}>연결된 게임 {genre.gameCount.toLocaleString()}개</p>}
    <form data-saving={mutation.busy || undefined} onSubmit={e => {
      e.preventDefault(); if (!writable) return;
      const form = new FormData(e.currentTarget); const code = genre?.code ?? formText(form, "code");
      // 장르의 순서는 별도 그리드 저장에서만 변경하고 여기서는 표시 정보와 사용 여부만 저장한다.
      void mutation.run(`game-genres/${code}`, genre ? "PUT" : "POST", { name: formText(form, "name"), enabled: form.has("enabled"), expectedVersion: genre?.version ?? 0 }, saved);
    }}><fieldset disabled={!writable || mutation.busy} className={styles.formFields}>
      {!genre && <Field label="장르 코드" hint="영문 대문자·숫자·밑줄, 대문자로 시작"><input name="code" required maxLength={64} pattern="[A-Z][A-Z0-9_]{0,63}" /></Field>}
      <Field label="장르 이름"><input name="name" required maxLength={50} defaultValue={genre?.name} /></Field>
      <label className={styles.checkRow}><input name="enabled" type="checkbox" defaultChecked={genre?.enabled ?? true} /><span>장르 사용<small>사용하지 않는 장르는 공개 장르 목록에서 숨겨져요. 게임의 공개 상태는 별도로 설정하세요.</small></span></label>
    </fieldset><div className={styles.actions}>{writable && <button className={styles.primary} disabled={mutation.busy}>저장</button>}</div><Feedback error={mutation.error} success={mutation.success} /></form></>;
}
