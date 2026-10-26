"use client";

import { useId, useState } from "react";
import { LobbyIcon } from "@/app/_components/lobby/lobby-icon";
import { filterIcons, filterTypes, filterTypeNames, type GameFilter, type GameFilterType } from "@/features/games/filter-contracts";
import { FILTER_PAGE_SIZES, type AdminGameFilter, parseFilterGrid } from "../filter-contracts";
import { useAdminResource } from "../client/use-admin-resource";
import { useFilterOptions } from "../client/use-filter-options";
import { CatalogDialog, useCatalogDialog } from "./catalog-dialog";
import { CatalogOrderEditor } from "./catalog-order-editor";
import { ConfirmDialog, Feedback, Field, Loading, useAdminMutation, useAdminScope } from "./admin-ui";
import { NumberedPagination } from "./numbered-pagination";
import common from "./admin.module.css";
import grid from "./catalog-grid.module.css";
import styles from "./game-filters-panel.module.css";

type FilterState = Readonly<{ search: string; type: GameFilterType | ""; enabled: string; page: number; size: number }>;
type FilterGrid = ReturnType<typeof parseFilterGrid>;
type FilterActions = { add: () => void; edit: (item: AdminGameFilter) => void; remove: (item: AdminGameFilter) => void; order: () => void; retry: () => void };
export const FILTER_HELP = "사용 중인 항목은 홈 필터에 표시돼요. 게임에서 선택한 라벨이 있을 때만 검색돼요.";

/** 목록·선택기·미리보기를 저장 후 함께 갱신하고 일반 편집과 전체 순서 편집을 분리한다. */
export function GameFiltersPanel() {
  const { sessionId, can } = useAdminScope();
  const [state, setState] = useState<FilterState>({ search: "", type: "", enabled: "", page: 1, size: 20 });
  const [query, setQuery] = useState("");
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<string | null>();
  const [deleting, setDeleting] = useState<AdminGameFilter>();
  const [ordering, setOrdering] = useState(false);
  const params = new URLSearchParams({ page: String(state.page), size: String(state.size) });
  if (query.trim()) params.set("query", query.trim());
  if (state.type) params.set("type", state.type);
  if (state.enabled) params.set("enabled", state.enabled);
  const list = useAdminResource<FilterGrid>(sessionId, ordering ? "" : `game-filters?${params}`);
  const options = useFilterOptions(sessionId, revision);
  const mutation = useAdminMutation();
  const reload = () => { list.reload(); setRevision(value => value + 1); };
  const change = (patch: Partial<FilterState>) => setState(current => ({ ...current, ...patch,
    ...("type" in patch || "enabled" in patch || "size" in patch ? { page: 1 } : {}) }));
  if (ordering) return <section className={`${common.panel} ${grid.panel} ${styles.orderPanel}`}>
    <CatalogOrderEditor area="game-filters" label="필터" size={state.size} cancel={() => { setOrdering(false); reload(); }} saved={() => { setOrdering(false); reload(); }} />
  </section>;
  return <>
    <FilterListView data={list.data} filters={options.items} loading={list.loading || mutation.busy} error={list.error || mutation.error || options.error}
      writable={can("GAME_WRITE")} state={state} change={change} search={() => { setQuery(state.search); change({ page: 1 }); }}
      actions={{ add: () => setSelected(null), edit: item => setSelected(item.code), remove: setDeleting,
        order: () => setOrdering(true), retry: () => { list.reload(); options.retry(); } }} />
    {selected !== undefined && <CatalogDialog title={selected ? "필터 상세 정보" : "필터 추가"} close={() => setSelected(undefined)}>
      <FilterDialogBody code={selected} close={() => setSelected(undefined)} saved={reload} />
    </CatalogDialog>}
    {deleting && <ConfirmDialog title="필터를 삭제할까요?" close={() => setDeleting(undefined)} confirm={() => {
      void mutation.run(`game-filters/${deleting.code}?expectedVersion=${deleting.version}`, "DELETE", undefined, reload);
    }}><p><strong>{deleting.name}</strong> 필터를 삭제해요.</p></ConfirmDialog>}
  </>;
}

/** 실제 목록과 화면 검증이 같은 표시 컴포넌트를 사용한다. 필터 전체 개수는 화면에 출력하지 않는다. */
export function FilterListView({ data, filters, loading, error, writable, state, change, search, actions }: {
  data?: FilterGrid; filters: readonly GameFilter[]; loading: boolean; error?: string; writable: boolean;
  state: FilterState; change: (patch: Partial<FilterState>) => void; search: () => void; actions: FilterActions;
}) {
  const active = filters.filter(filter => filter.enabled);
  return <section className={`${common.panel} ${grid.panel}`} aria-label="게임 필터 목록">
    <div className={common.panelHeading}>
      <div className={styles.headingTitle}><h2>필터 목록</h2><FilterHelp /></div>
      {writable && <div className={grid.actions}>
        <button type="button" disabled={loading || !filters.length} onClick={actions.order}>순서 변경</button>
        <button type="button" className={common.smallPrimary} onClick={actions.add}>+ 필터 추가</button>
      </div>}
    </div>
    <div className={styles.tabs} role="group" aria-label="필터 유형">
      {(["", ...filterTypes] as const).map(type => <button key={type} type="button" aria-pressed={state.type === type} onClick={() => change({ type })}>
        {type ? filterTypeNames[type] : "전체"}<span>{type ? filters.filter(filter => filter.type === type).length : filters.length}</span>
      </button>)}
    </div>
    <div className={`${grid.toolbar} ${styles.toolbar}`}>
      <form className={common.search} data-focus-frame onSubmit={event => { event.preventDefault(); search(); }}>
        <input type="search" aria-label="필터 검색" placeholder="이름 또는 코드 검색" maxLength={100} value={state.search} onChange={event => change({ search: event.target.value })} />
        <button type="submit">검색</button>
      </form>
      <label className={styles.status}><span className={common.visuallyHidden}>사용 여부</span><select aria-label="사용 여부" value={state.enabled} onChange={event => change({ enabled: event.target.value })}>
        <option value="">모든 상태</option><option value="true">사용</option><option value="false">미사용</option>
      </select></label>
      <label className={grid.pageSize}><span className={common.visuallyHidden}>페이지당 표시 개수</span><select aria-label="페이지당 표시 개수" value={state.size} onChange={event => change({ size: Number(event.target.value) })}>
        {FILTER_PAGE_SIZES.map(value => <option key={value} value={value}>{value}개씩</option>)}
      </select></label>
    </div>
    {error && <p className={common.error} role="alert">{error} <button type="button" onClick={actions.retry}>다시 확인</button></p>}
    <div className={grid.scroll} role="region" aria-label="필터 목록 그리드" tabIndex={0} aria-busy={loading}>
      <table className={`${grid.table} ${styles.table}`}>
        <caption className={common.visuallyHidden}>게임 필터 목록. 이름을 선택하면 상세 정보가 열립니다.</caption>
        <thead><tr>{["순서", "아이콘", "필터 이름", "유형", "코드", "사용 여부", "연결 게임", "관리"].map(name => <th key={name} scope="col">{name}</th>)}</tr></thead>
        <tbody>{!data ? <tr><td colSpan={8}><Loading error={error} retry={actions.retry} /></td></tr>
          : !data.items.length ? <tr><td colSpan={8}><p className={common.empty}>검색 결과가 없어요.</p></td></tr>
            : data.items.map(filter => <tr key={filter.code}>
              <td>{filter.sortOrder + 1}</td><td><span className={styles.filterIcon}><LobbyIcon name={filter.icon} /></span></td>
              <td><button type="button" className={grid.openButton} onClick={() => actions.edit(filter)}>{filter.name}</button></td>
              <td><span className={styles.typeBadge} data-type={filter.type}>{filterTypeNames[filter.type]}</span></td><td><code>{filter.code}</code></td>
              <td><span className={filter.enabled ? common.statusGood : common.tag}>{filter.enabled ? "사용" : "미사용"}</span></td><td>{filter.gameCount.toLocaleString()}개</td>
              <td><div className={styles.rowActions}>
                <button type="button" aria-label={`${filter.name} ${writable ? "수정" : "상세 보기"}`} title={writable ? "수정" : "상세 보기"} onClick={() => actions.edit(filter)}><EditIcon /></button>
                {writable && <button type="button" aria-label={`${filter.name} 삭제`} title={filter.gameCount ? "연결된 게임이 있어 삭제할 수 없어요" : "삭제"} disabled={loading || filter.gameCount > 0} onClick={() => actions.remove(filter)}><TrashIcon /></button>}
              </div></td>
            </tr>)}</tbody>
      </table>
    </div>
    <section className={styles.preview} aria-label="홈 필터 미리보기">
      <h3>홈 필터 미리보기</h3>
      <div className={styles.previewItems}>{active.length ? active.map(filter => <span key={filter.code}><LobbyIcon name={filter.icon} />{filter.name}</span>) : <p className={common.hint}>사용 중인 필터가 없어요.</p>}</div>
    </section>
    <div className={styles.pagination}><NumberedPagination page={data?.page ?? state.page} totalPages={data?.totalPages ?? 1}
      loading={loading || !data} change={page => change({ page })} label="게임 필터 목록 페이지 탐색" /></div>
  </section>;
}

/** 마우스 호버·키보드 포커스·모바일 탭에서 같은 안내를 열고 Escape로 닫는다. */
function FilterHelp() {
  const id = useId();
  const [open, setOpen] = useState(false), [dismissed, setDismissed] = useState(false);
  return <span className={styles.help} data-open={open} data-dismissed={dismissed} onMouseEnter={() => setDismissed(false)} onBlur={() => setOpen(false)}>
    <button type="button" className={styles.infoButton} aria-label="게임 필터 안내" aria-describedby={id} onFocus={() => setDismissed(false)}
      onClick={() => { setOpen(value => !value); setDismissed(false); }} onKeyDown={event => { if (event.key === "Escape") { setOpen(false); setDismissed(true); } }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 10v7" /><circle cx="12" cy="7" r=".7" fill="currentColor" stroke="none" /></svg>
    </button><span id={id} role="tooltip" className={styles.tooltip}>{FILTER_HELP}</span>
  </span>;
}

function FilterDialogBody({ code, close, saved }: { code: string | null; close: () => void; saved: () => void }) {
  const { sessionId } = useAdminScope();
  const { saved: markSaved } = useCatalogDialog();
  const detail = useAdminResource<AdminGameFilter>(sessionId, code ? `game-filters/${code}` : "");
  if (code && !detail.data) return <Loading error={detail.error} retry={detail.reload} />;
  return <div inert={detail.loading && !!code} aria-busy={detail.loading && !!code}>
    <FilterEditor key={code ? `${code}:${detail.data!.version}` : "new"} item={code ? detail.data : undefined} saved={() => { markSaved(); saved(); if (code) detail.reload(); else close(); }} />
  </div>;
}

/** 코드·유형은 신규 등록 때만 정하고 표시 정보·사용 여부와 조건은 기존 버전으로 저장한다. */
function FilterEditor({ item, saved }: { item?: AdminGameFilter; saved: () => void }) {
  const { can } = useAdminScope();
  const mutation = useAdminMutation();
  const [type, setType] = useState<GameFilterType>(item?.type ?? "GENRE");
  const [icon, setIcon] = useState(item?.icon ?? "gamepad");
  const icons = { gamepad: "게임", puzzle: "퍼즐", car: "자동차", swords: "액션", board: "보드", city: "도시", user: "1인", users: "인원", "2d": "2D", cube: "3D", grid: "격자" };
  return <form data-saving={mutation.busy || undefined} onSubmit={event => {
    event.preventDefault(); if (!can("GAME_WRITE")) return;
    const form = new FormData(event.currentTarget), code = item?.code ?? String(form.get("code") ?? "").trim();
    const body = { name: String(form.get("name") ?? "").trim(), type, icon, enabled: form.has("enabled"), expectedVersion: item?.version ?? 0,
      minPlayers: type === "PLAYERS" ? Number(form.get("minPlayers")) : null, maxPlayers: type === "PLAYERS" ? Number(form.get("maxPlayers")) : null,
      graphicsType: type === "GRAPHICS" ? String(form.get("graphicsType")) : null };
    void mutation.run(`game-filters/${code}`, item ? "PUT" : "POST", body, saved);
  }}><fieldset className={common.formFields} disabled={!can("GAME_WRITE") || mutation.busy}>
    <div className={common.formColumns}>
      <Field label="필터 유형"><select value={type} disabled={!!item} onChange={event => setType(event.target.value as GameFilterType)}>{filterTypes.map(value => <option key={value} value={value}>{filterTypeNames[value]}</option>)}</select></Field>
      <Field label="필터 코드" hint="영문 대문자·숫자·밑줄, 대문자로 시작"><input name="code" required maxLength={64} pattern="[A-Z][A-Z0-9_]{0,63}" defaultValue={item?.code} disabled={!!item} /></Field>
    </div>
    <Field label="필터 이름"><input name="name" required maxLength={50} defaultValue={item?.name} /></Field>
    <Field label="아이콘"><span className={styles.iconPicker}><LobbyIcon name={icon} /><select value={icon} onChange={event => setIcon(event.target.value as typeof icon)}>{filterIcons.map(value => <option key={value} value={value}>{icons[value]}</option>)}</select></span></Field>
    {type === "PLAYERS" && <div className={common.formColumns}>
      <Field label="최소 인원"><input type="number" name="minPlayers" min={1} max={10000} required defaultValue={item?.minPlayers ?? 1} /></Field>
      <Field label="최대 인원"><input type="number" name="maxPlayers" min={1} max={10000} required defaultValue={item?.maxPlayers ?? 1} /></Field>
    </div>}
    {type === "GRAPHICS" && <Field label="그래픽 조건"><select name="graphicsType" defaultValue={item?.graphicsType ?? "TWO_D"}><option value="TWO_D">2D</option><option value="THREE_D">3D</option></select></Field>}
    <label className={common.checkRow}><input name="enabled" type="checkbox" defaultChecked={item?.enabled ?? true} /><span>사용</span></label>
  </fieldset>
    {can("GAME_WRITE") && <div className={common.actions}><button className={common.primary} disabled={mutation.busy}>{mutation.busy ? "저장 중…" : item ? "필터 저장" : "필터 추가"}</button></div>}
    <Feedback error={mutation.error} success={mutation.success} />
  </form>;
}
function EditIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15l-1 6Z" /></svg>; }
function TrashIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 10v8M14 10v8" /></svg>; }
