"use client";

import { useRef, useState } from "react";
import type { Game, Implementation } from "../contracts";
import type { GameGridItem } from "../catalog-grid-contracts";
import { useAdminResource } from "../client/use-admin-resource";
import { Feedback, Field, formText, Loading, useAdminMutation, useAdminScope } from "./admin-ui";
import type { GenreOption } from "../genre-options-contracts";
import { CatalogGrid, type CatalogColumn } from "./catalog-grid";
import { CatalogDialog, useCatalogDialog } from "./catalog-dialog";
import { GenreCombobox } from "./genre-combobox";
import { GameAvailabilityEditor } from "./game-availability-editor";
import { GameModeEditor } from "./game-mode-editor";
import styles from "./admin.module.css";
import grid from "./catalog-grid.module.css";

const columns: readonly CatalogColumn<GameGridItem>[] = [
  { label: "장르", cell: game => <div className={grid.badges}>{game.genres.length ? game.genres.map(genre => <span className={styles.tag} key={genre.code}>{genre.name}{!genre.enabled && " (사용 안 함)"}</span>) : "—"}</div> },
  { label: "플레이 모드", cell: game => <div className={grid.badges}>{game.modes.length ? game.modes.map(mode => <span className={styles.tag} key={mode.code}>{mode.name}</span>) : "—"}</div> },
  { label: "공개 여부", cell: game => <span className={game.published ? styles.statusGood : styles.tag}>{game.published ? "공개" : "숨김"}</span> },
  { label: "이용 상태", cell: game => <span className={game.availability === "AVAILABLE" ? styles.statusGood : game.availability === "MAINTENANCE" ? styles.statusWarning : styles.tag}>{{ AVAILABLE: "이용 가능", MAINTENANCE: "점검 중", DISABLED: "이용 중지" }[game.availability]}</span> },
];

/** 표시 정보·지원 모드·공개 상태를 각각의 기능 권한과 버전으로 관리한다. */
export function GamesPanel() {
  const { sessionId, can } = useAdminScope();
  const implementations = useAdminResource<readonly Implementation[]>(sessionId, can("GAME_WRITE") ? "game-implementations" : "");
  return <CatalogGrid<GameGridItem> area="games" label="게임" columns={columns}
    createAllowed={!implementations.data || implementations.data.some(item => !item.registered)} createLoading={implementations.loading}
    dialog={(code, close, saved) => <CatalogDialog key={code ?? "new"} title={code ? "게임 상세 정보" : "게임 등록"} close={close}>
      <GameDialogBody code={code} close={close} supplied={implementations.data}
        saved={() => { if (!code) implementations.reload(); saved(); }} />
    </CatalogDialog>} />;
}

/** 모달을 열 때만 상세와 지원 구현을 조회하고 저장 후 목록과 현재 상세를 함께 갱신한다. */
function GameDialogBody({ code, close, saved, supplied }: { code: string | null; close: () => void; saved: () => void; supplied?: readonly Implementation[] }) {
  const { sessionId } = useAdminScope();
  const { saved: markSaved } = useCatalogDialog();
  const game = useAdminResource<Game>(sessionId, code ? `games/${code}` : "");
  const implementations = useAdminResource<readonly Implementation[]>(sessionId, supplied ? "" : "game-implementations");
  const available = supplied ?? implementations.data;
  const selectedImplementation = available?.find(i => i.code === game.data?.code);
  const reload = () => { markSaved(); game.reload(); saved(); };
  if (!available) return <Loading error={implementations.error} retry={implementations.reload} />;
  if (!code) return <NewGame implementations={available.filter(item => !item.registered)} saved={() => { markSaved(); saved(); close(); }} />;
  if (!game.data) return <Loading error={game.error} retry={game.reload} />;
  return <><div className={styles.panelHeading}><div><h2>{game.data.name}</h2><p>{game.data.code}</p></div></div>
    {/* 저장 후 상세 재조회 동안 이전 버전의 폼에 새 입력을 받지 않고 선택한 탭·모드는 유지한다. */}
    {selectedImplementation ? <><div inert={game.loading} aria-busy={game.loading}><GameDetails key={game.data.code} game={game.data} implementation={selectedImplementation} saved={reload} /></div>
      {game.loading && <p className={styles.hint} role="status">저장한 내용을 확인하고 있어요.</p>}</>
      : <p className={styles.error}>현재 배포에서 지원하지 않는 게임이에요. 게임 기능을 확인한 뒤 다시 관리해 주세요.</p>}
  </>;
}
function NewGame({ implementations, saved }: { implementations: readonly Implementation[]; saved: (game: Game) => void }) {
  const { navigate } = useCatalogDialog();
  const [code, setCode] = useState(implementations[0]?.code ?? "");
  const implementation = implementations.find(i => i.code === code);
  // 이미 등록한 구현은 선택지에서 제외해 같은 오목을 다시 등록하는 불필요한 동작을 만들지 않는다.
  if (!implementation) return <p className={styles.empty}>등록할 수 있는 새 게임이 없어요.</p>;
  return <><p className={styles.hint}>등록 후 모드와 공개 상태를 설정하세요.</p><Field label="등록할 게임"><select value={code} onChange={e => { const next = e.target.value; if (next !== code) navigate(() => setCode(next)); }}>{implementations.map(i => <option key={i.code}>{i.code}</option>)}</select></Field><GameMetadataEditor key={code} implementation={implementation} saved={saved} /></>;
}
function GameDetails({ game, implementation, saved }: { game: Game; implementation: Implementation; saved: () => void }) {
  const { navigate } = useCatalogDialog();
  const [tab, setTab] = useState("information");
  const [modeCode, setModeCode] = useState(implementation.modes[0]?.code ?? "");
  const definition = implementation.modes.find(d => d.code === modeCode);
  const mode = game.modes.find(m => m.code === modeCode);
  return <><div className={styles.tabs} role="group" aria-label="게임 설정">{[["information", "게임 정보"], ["modes", "플레이 모드"], ["availability", "공개·이용 상태"]].map(([key, name]) => <button key={key} type="button" aria-pressed={tab === key} onClick={() => { if (tab !== key) navigate(() => setTab(key)); }}>{name}</button>)}</div>
    {tab === "information" ? <GameMetadataEditor key={game.version} game={game} implementation={implementation} saved={saved} /> : tab === "availability" ? <GameAvailabilityEditor key={game.version} item={game} path={`games/${game.code}/availability`} saved={saved} />
      : <div className={styles.stack}>
        {/* 모드가 늘어나도 모든 편집 폼을 한꺼번에 만들지 않고 선택한 모드만 표시한다. */}
        <Field label="관리할 모드"><select value={modeCode} onChange={e => { const next = e.target.value; if (next !== modeCode) navigate(() => setModeCode(next)); }}>{implementation.modes.map(d => { const existing = game.modes.find(m => m.code === d.code); return <option key={d.code} value={d.code}>{existing?.name ?? `${d.code} (미등록)`}</option>; })}</select></Field>
        {definition && <GameModeEditor key={`${definition.code}:${mode?.version ?? "new"}`} gameCode={game.code} mode={mode} definition={definition} saved={saved} />}
        {game.modes.filter(m => !implementation.modes.some(d => d.code === m.code)).map(m => <p key={m.code} className={styles.error}>{m.name}: 현재 지원하지 않는 모드예요.</p>)}
      </div>}
  </>;
}
function GameMetadataEditor({ game, implementation, saved }: { game?: Game; implementation: Implementation; saved: (game: Game) => void }) {
  const { can } = useAdminScope();
  const { changed } = useCatalogDialog();
  const formRef = useRef<HTMLFormElement>(null);
  const mutation = useAdminMutation();
  const [genres, setGenres] = useState<readonly GenreOption[]>(game?.genres ?? []);
  return <form ref={formRef} data-saving={mutation.busy || undefined} onSubmit={e => {
    e.preventDefault(); if (!can("GAME_WRITE")) return;
    const form = new FormData(e.currentTarget);
    // 게임 정보 저장으로 그리드에서 지정한 노출 순서를 덮어쓰지 않는다.
    const metadata = { name: formText(form, "name"), summary: formText(form, "summary"), description: formText(form, "description"), genreCodes: genres.map(genre => genre.code) };
    void mutation.run<Game>(game ? `games/${game.code}` : "games", game ? "PUT" : "POST", { metadata, ...(game ? { expectedVersion: game.version } : { code: implementation.code }) }, saved);
  }}><fieldset disabled={!can("GAME_WRITE") || mutation.busy} className={styles.formFields}>
    <Field label="게임 이름"><input name="name" maxLength={100} required defaultValue={game?.name} /></Field>
    <Field label="한 줄 소개"><input name="summary" maxLength={160} required defaultValue={game?.summary} /></Field>
    <Field label="게임 설명"><textarea name="description" rows={5} maxLength={2000} required defaultValue={game?.description} /></Field>
  </fieldset>
    <GenreCombobox selected={genres} change={value => { setGenres(value); changed(formRef.current); }} disabled={!can("GAME_WRITE") || mutation.busy} />
    {can("GAME_WRITE") && <div className={styles.actions}><button className={styles.primary} disabled={mutation.busy}>{mutation.busy ? "저장 중…" : game ? "게임 정보 저장" : "게임 등록"}</button></div>}
    <Feedback error={mutation.error} success={mutation.success} />
  </form>;
}
