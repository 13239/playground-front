"use client";

import { useState, type ReactNode } from "react";
import { focusWithoutRing } from "@/lib/client/show-modal";
import type { CatalogArea, CatalogGridPage } from "../catalog-grid-contracts";
import { useAdminResource } from "../client/use-admin-resource";
import { Loading, useAdminScope } from "./admin-ui";
import { CatalogOrderEditor } from "./catalog-order-editor";
import { NumberedPagination } from "./numbered-pagination";
import { PageSizeSelect } from "./page-size-select";
import styles from "./admin.module.css";
import grid from "./catalog-grid.module.css";

type GridItem = Readonly<{ code: string; name: string; sortOrder: number; version: number }>;
export type CatalogColumn<T> = Readonly<{ label: string; cell: (item: T) => ReactNode }>;

/** 게임·장르의 검색·번호 페이지·행 상세·순서 편집 경계를 공유한다. 편집 중에는 일반 목록을 다시 요청하지 않는다. */
export function CatalogGrid<T extends GridItem>({ area, label, columns, dialog, createAllowed = true, createLoading = false }: {
  area: CatalogArea; label: string; columns: readonly CatalogColumn<T>[];
  dialog: (code: string | null, close: () => void, saved: () => void) => ReactNode;
  createAllowed?: boolean; createLoading?: boolean;
}) {
  const { sessionId, can } = useAdminScope();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState<number>(10);
  const [selected, setSelected] = useState<string | null>();
  const [ordering, setOrdering] = useState(false);
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (query.trim()) params.set("query", query.trim());
  const list = useAdminResource<CatalogGridPage<T>>(sessionId, ordering ? "" : `${area}?${params}`);
  const writable = can("GAME_WRITE");
  const open = (code: string, row: HTMLTableRowElement) => {
    const trigger = row.querySelector<HTMLButtonElement>("button");
    if (trigger) focusWithoutRing(trigger);
    setSelected(code);
  };
  const finishOrdering = () => { setOrdering(false); list.reload(); };
  return <section className={`${styles.panel} ${grid.panel}`} aria-label={`${label} 목록`}>
    {ordering ? <CatalogOrderEditor area={area} label={label} size={size} cancel={finishOrdering} saved={finishOrdering} /> : <>
      <div className={styles.panelHeading}><div><h2>{label} 목록</h2><p>행을 선택하면 상세 정보를 확인하고 수정할 수 있어요.</p></div>
        {writable && <div className={grid.actions}><button type="button" disabled={list.loading || !list.data?.items.length}
          onClick={() => { setSearch(""); setQuery(""); setPage(1); setOrdering(true); }}>순서 변경</button>
          {createAllowed && <button type="button" className={styles.smallPrimary} disabled={createLoading} onClick={() => setSelected(null)}>+ {label === "게임" ? "등록" : "추가"}</button>}</div>}
      </div>
      <div className={grid.toolbar}>
        <form className={styles.search} data-focus-frame onSubmit={event => { event.preventDefault(); setQuery(search); setPage(1); }}>
          <input type="search" aria-label={`${label} 검색`} placeholder="이름 또는 코드 검색" maxLength={100}
            value={search} onChange={event => setSearch(event.target.value)} /><button type="submit">검색</button>
        </form>
        {/* 공통 개수 선택창에서도 기존 첫 페이지 이동과 조회 조건을 유지한다. */}
        <PageSizeSelect className={grid.pageSize} value={size} change={next => { setSize(next); setPage(1); }} />
      </div>
      <div className={grid.scroll} role="region" aria-label={`${label} 목록 그리드`} tabIndex={0} aria-busy={list.loading}>
        <table className={grid.table}>
          <caption className={styles.visuallyHidden}>{label} 목록. 이름을 선택하면 상세 정보가 열립니다.</caption>
          <thead><tr><th scope="col">순서</th><th scope="col">{label} 이름</th><th scope="col">코드</th>{columns.map(column => <th scope="col" key={column.label}>{column.label}</th>)}</tr></thead>
          <tbody>{!list.data ? <tr><td colSpan={3 + columns.length}><Loading error={list.error} retry={list.reload} /></td></tr>
            : list.data.items.length === 0 ? <tr><td colSpan={3 + columns.length}><p className={styles.empty}>검색 결과가 없어요.</p></td></tr>
            : list.data.items.map(item => <tr key={item.code} className={grid.openRow} onClick={event => open(item.code, event.currentTarget)}>
              <td>{item.sortOrder + 1}</td><td><button type="button" className={grid.openButton} aria-label={`${item.name} ${label} 상세 보기`}>{item.name}</button></td>
              <td><code>{item.code}</code></td>{columns.map(column => <td key={column.label}>{column.cell(item)}</td>)}
            </tr>)}</tbody>
        </table>
      </div>
      <div className={grid.footer}><p className={styles.hint}>{list.data ? `총 ${list.data.totalElements.toLocaleString()}개` : "목록을 불러오는 중이에요."}</p>
        <NumberedPagination page={list.data?.page ?? page} totalPages={list.data?.totalPages ?? page}
          loading={list.loading || !list.data} change={setPage} label={`${label} 목록 페이지 탐색`} /></div>
      {selected !== undefined && dialog(selected, () => setSelected(undefined), list.reload)}
    </>}
  </section>;
}
