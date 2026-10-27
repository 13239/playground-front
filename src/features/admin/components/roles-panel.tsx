"use client";

import { useState } from "react";
import { focusWithoutRing } from "@/lib/client/show-modal";
import type { RoleSummary } from "../contracts";
import type { NumberedPage } from "../pagination-contracts";
import { useAdminResource } from "../client/use-admin-resource";
import { RoleDetailsDialog } from "./role-details-dialog";
import { NumberedPagination } from "./numbered-pagination";
import { PageSizeSelect } from "./page-size-select";
import { SearchInput } from "@/components/ui/search-input";
import { Loading, useAdminScope } from "./admin-ui";
import styles from "./admin.module.css";
import grid from "./catalog-grid.module.css";
import roles from "./roles-panel.module.css";

/** 역할 목록은 번호 페이지 그리드로, 선택한 역할의 상세·추가는 모달로 분리해 같은 편집 흐름을 사용한다. */
export function RolesPanel() {
  const { sessionId, can } = useAdminScope();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState<number>(10);
  const [selected, setSelected] = useState<string | null>();
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (query.trim()) params.set("query", query.trim());
  const list = useAdminResource<NumberedPage<RoleSummary>>(sessionId, `roles?${params}`);
  const open = (code: string, row: HTMLTableRowElement) => {
    // 행의 빈 영역을 선택해도 모달을 닫으면 해당 권한의 키보드 진입점으로 돌아온다.
    const trigger = row.querySelector<HTMLButtonElement>("button");
    if (trigger) focusWithoutRing(trigger);
    setSelected(code);
  };
  return <section className={`${styles.panel} ${grid.panel}`} aria-label="권한 목록">
    <div className={styles.panelHeading}><div><h2>권한 목록</h2><p>행을 선택하면 상세 정보를 확인하고 수정할 수 있어요.</p></div>
      {can("ROLE_WRITE") && <button type="button" className={styles.smallPrimary} onClick={() => setSelected(null)}>+ 추가</button>}
    </div>
    <div className={grid.toolbar}>
      <form className={styles.search} onSubmit={event => { event.preventDefault(); setQuery(search); setPage(1); }}>
        {/* 공통 검색 프레임의 돋보기와 Enter는 기존 검색·페이지 초기화를 함께 실행한다. */}
        <SearchInput label="권한 검색" placeholder="이름 또는 코드 검색" maxLength={100} value={search} onChange={event => setSearch(event.target.value)} />
      </form>
      {/* 표시 개수 변경은 공통 선택창을 사용하고 첫 페이지부터 다시 조회한다. */}
      <PageSizeSelect className={grid.pageSize} value={size} change={next => { setSize(next); setPage(1); }} />
    </div>
    <div className={grid.scroll} role="region" aria-label="권한 목록 그리드" tabIndex={0} aria-busy={list.loading}>
      <table className={`${grid.table} ${roles.table}`}>
        <caption className={styles.visuallyHidden}>권한 목록. 권한 이름을 선택하면 상세 정보가 열립니다.</caption>
        {/* 역할 구분 컬럼을 없애고 모든 역할에 같은 목록·상세 흐름을 제공한다. */}
        <thead><tr><th scope="col">번호</th><th scope="col">권한 이름</th><th scope="col">권한 코드</th><th scope="col">설명</th></tr></thead>
        <tbody>{!list.data ? <tr><td colSpan={4}><Loading error={list.error} retry={list.reload} /></td></tr>
          : list.data.items.length === 0 ? <tr><td colSpan={4}><p className={styles.empty}>검색 결과가 없어요.</p></td></tr>
          : list.data.items.map((role, index) => <tr key={role.code} className={grid.openRow} onClick={event => open(role.code, event.currentTarget)}>
            <td>{(list.data!.page - 1) * list.data!.size + index + 1}</td>
            <td><button type="button" className={grid.openButton} aria-label={`${role.name} 권한 상세 보기`}>{role.name}</button></td>
            <td><code>{role.code}</code></td><td>{role.description || "—"}</td>
          </tr>)}</tbody>
      </table>
    </div>
    <div className={styles.userGridFooter}><p className={styles.hint}>{list.data ? `총 ${list.data.totalElements.toLocaleString()}개` : "목록을 불러오는 중이에요."}</p>
      <NumberedPagination page={list.data?.page ?? page} totalPages={list.data?.totalPages ?? page}
        loading={list.loading || !list.data} change={setPage} label="권한 목록 페이지 탐색" /></div>
    {selected !== undefined && <RoleDetailsDialog key={`${sessionId}:${selected ?? "new"}`} code={selected} close={() => setSelected(undefined)} saved={list.reload} />}
  </section>;
}
