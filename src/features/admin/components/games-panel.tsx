"use client";

import { useState } from "react";
import type { Game, Implementation } from "../contracts";
import { useAdminResource } from "../client/use-admin-resource";
import { AdminList, useAdminList } from "./admin-list";
import { Feedback, Field, formNumber, formText, Loading, Reason, useAdminMutation, useAdminScope } from "./admin-ui";
import { CodePicker } from "./code-picker";
import { GameAvailabilityEditor } from "./game-availability-editor";
import { GameModeEditor } from "./game-mode-editor";
import styles from "./admin.module.css";

/** 표시 정보·지원 모드·공개 상태를 각각의 기능 권한과 버전으로 관리한다. */
export function GamesPanel() {
  const { sessionId, can } = useAdminScope();
  const list = useAdminList<Game>("games");
  const [creating, setCreating] = useState(false);
  const game = useAdminResource<Game>(sessionId, list.selected && !creating ? `games/${list.selected}` : "");
  const implementations = useAdminResource<readonly Implementation[]>(sessionId, "game-implementations");
  const selectedImplementation = implementations.data?.find(i => i.code === game.data?.code);
  const reload = () => { game.reload(); list.reload(); };
  return <div className={styles.masterDetail}>
    <AdminList list={list} label="게임" onSelect={() => setCreating(false)} extra={can("GAME_WRITE") && <button className={styles.smallPrimary} type="button" onClick={() => setCreating(true)}>+ 등록</button>} detail={g => <span className={g.published && g.availability === "AVAILABLE" ? styles.statusGood : styles.tag}>{!g.published ? "숨김" : g.availability === "AVAILABLE" ? "공개" : g.availability === "MAINTENANCE" ? "점검" : "중지"}</span>} />
    <section className={styles.panel}>
      {!implementations.data ? <Loading error={implementations.error} retry={implementations.reload} /> : creating ? <NewGame implementations={implementations.data} cancel={() => setCreating(false)} saved={value => { setCreating(false); list.select(value.code); list.reload(); }} />
        : !list.selected ? <p className={styles.empty}>관리할 게임을 선택하세요.</p>
        : !game.data ? <Loading error={game.error} retry={game.reload} />
        : <><div className={styles.panelHeading}><div><h2>{game.data.name}</h2><p>{game.data.code}</p></div><button type="button" onClick={reload}>최신 내용 불러오기</button></div>
          {selectedImplementation ? <GameDetails key={game.data.code} game={game.data} implementation={selectedImplementation} saved={reload} /> : <p className={styles.error}>현재 배포에서 지원하지 않는 게임이에요. 게임 기능을 확인한 뒤 다시 관리해 주세요.</p>}
        </>}
    </section>
  </div>;
}
function NewGame({ implementations, cancel, saved }: { implementations: readonly Implementation[]; cancel: () => void; saved: (game: Game) => void }) {
  const [code, setCode] = useState(implementations[0]?.code ?? "");
  const implementation = implementations.find(i => i.code === code);
  return <><div className={styles.panelHeading}><div><h2>게임 등록</h2><p>등록 후 모드와 공개 상태를 설정하세요.</p></div><button type="button" onClick={cancel}>취소</button></div><Field label="등록할 게임"><select value={code} onChange={e => setCode(e.target.value)}>{implementations.map(i => <option key={i.code}>{i.code}</option>)}</select></Field>{implementation ? <GameMetadataEditor key={code} implementation={implementation} saved={saved} /> : <p className={styles.empty}>등록 가능한 게임이 없어요.</p>}</>;
}
function GameDetails({ game, implementation, saved }: { game: Game; implementation: Implementation; saved: () => void }) {
  const [tab, setTab] = useState("information");
  const [modeCode, setModeCode] = useState(implementation.modes[0]?.code ?? "");
  const definition = implementation.modes.find(d => d.code === modeCode);
  const mode = game.modes.find(m => m.code === modeCode);
  return <><div className={styles.tabs} role="group" aria-label="게임 설정">{[["information", "게임 정보"], ["modes", "플레이 모드"], ["availability", "공개·이용 상태"]].map(([key, name]) => <button key={key} type="button" aria-pressed={tab === key} onClick={() => setTab(key)}>{name}</button>)}</div>
    {tab === "information" ? <GameMetadataEditor key={game.version} game={game} implementation={implementation} saved={saved} /> : tab === "availability" ? <GameAvailabilityEditor key={game.version} item={game} path={`games/${game.code}/availability`} saved={saved} />
      : <div className={styles.stack}>
        {/* 모드가 늘어나도 모든 편집 폼을 한꺼번에 만들지 않고 선택한 모드만 표시한다. */}
        <Field label="관리할 모드"><select value={modeCode} onChange={e => setModeCode(e.target.value)}>{implementation.modes.map(d => { const existing = game.modes.find(m => m.code === d.code); return <option key={d.code} value={d.code}>{existing?.name ?? `${d.code} (미등록)`}</option>; })}</select></Field>
        {definition && <GameModeEditor key={`${definition.code}:${mode?.version ?? "new"}`} gameCode={game.code} mode={mode} definition={definition} saved={saved} />}
        {game.modes.filter(m => !implementation.modes.some(d => d.code === m.code)).map(m => <p key={m.code} className={styles.error}>{m.name}: 현재 지원하지 않는 모드예요.</p>)}
      </div>}
  </>;
}
function GameMetadataEditor({ game, implementation, saved }: { game?: Game; implementation: Implementation; saved: (game: Game) => void }) {
  const { can } = useAdminScope();
  const mutation = useAdminMutation();
  const [genres, setGenres] = useState<readonly string[]>(game?.genres.map(g => g.code) ?? []);
  return <form onSubmit={e => {
    e.preventDefault(); if (!can("GAME_WRITE")) return;
    const form = new FormData(e.currentTarget);
    const metadata = { name: formText(form, "name"), summary: formText(form, "summary"), description: formText(form, "description"), thumbnailKey: formText(form, "thumbnailKey"), genreCodes: genres, sortOrder: formNumber(form, "sortOrder") };
    void mutation.run<Game>(game ? `games/${game.code}` : "games", game ? "PUT" : "POST", { metadata, reason: formText(form, "reason"), ...(game ? { expectedVersion: game.version } : { code: implementation.code }) }, saved);
  }}><fieldset disabled={!can("GAME_WRITE") || mutation.busy} className={styles.formFields}>
    <Field label="게임 이름"><input name="name" maxLength={100} required defaultValue={game?.name} /></Field>
    <Field label="한 줄 소개"><input name="summary" maxLength={160} required defaultValue={game?.summary} /></Field>
    <Field label="게임 설명"><textarea name="description" rows={5} maxLength={2000} required defaultValue={game?.description} /></Field>
    <div className={styles.formColumns}><Field label="대표 이미지"><select name="thumbnailKey" defaultValue={game?.thumbnailKey}>{implementation.thumbnailKeys.map(k => <option key={k}>{k}</option>)}</select></Field><Field label="노출 순서"><input name="sortOrder" type="number" min={0} max={1000000} required defaultValue={game?.sortOrder ?? 0} /></Field></div>
  </fieldset>
    <h3>장르</h3><CodePicker area="game-genres" label="장르" selected={genres} change={setGenres} disabled={!can("GAME_WRITE") || mutation.busy} />
    {can("GAME_WRITE") && <><Reason /><div className={styles.actions}><button className={styles.primary} disabled={mutation.busy}>{mutation.busy ? "저장 중…" : game ? "게임 정보 저장" : "게임 등록"}</button></div></>}
    <Feedback error={mutation.error} success={mutation.success} />
  </form>;
}
