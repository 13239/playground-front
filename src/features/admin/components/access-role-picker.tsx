"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { SearchInput } from "@/components/ui/search-input";
import type { RoleSummary } from "../contracts";
import type { NumberedPage } from "../pagination-contracts";
import { useAdminResource } from "../client/use-admin-resource";
import { Loading, useAdminScope } from "./admin-ui";
import { NumberedPagination } from "./numbered-pagination";
import { PageSizeSelect } from "./page-size-select";
import common from "./admin.module.css";
import styles from "./access-panel.module.css";

/** 페이지 목록과 선택 집합을 분리해 검색·개수 변경 뒤에도 저장 전 선택과 이름을 보존한다. */
export function AccessRolePicker({ selected, change, disabled }: {
  selected: readonly RoleSummary[]; change: (roles: readonly RoleSummary[]) => void; disabled: boolean;
}) {
  const { sessionId } = useAdminScope();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const heading = useId();
  const selectionHeading = useId();
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (query.trim()) params.set("query", query.trim());
  const list = useAdminResource<NumberedPage<RoleSummary>>(sessionId, `access-policy/roles?${params}`);
  const items = list.data?.items ?? [];
  const codes = new Set(selected.map(role => role.code));
  const allChecked = items.length > 0 && items.every(role => codes.has(role.code));
  const partiallyChecked = !allChecked && items.some(role => codes.has(role.code));
  const allRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 네이티브 체크박스의 일부 선택 상태도 보조 기술에 동일하게 전달한다.
    if (allRef.current) allRef.current.indeterminate = partiallyChecked;
  }, [partiallyChecked]);

  function selectPage(checked: boolean) {
    const pageCodes = new Set(items.map(role => role.code));
    // 전체 선택·해제는 현재 페이지에만 적용하고 다른 페이지의 선택은 유지한다.
    change(checked ? [...selected, ...items.filter(role => !codes.has(role.code))] : selected.filter(role => !pageCodes.has(role.code)));
  }

  const first = list.data && list.data.totalElements > 0 ? (list.data.page - 1) * list.data.size + 1 : 0;
  const last = first === 0 ? 0 : first + items.length - 1;
  return <div className={styles.picker}>
    <div className={styles.panes}>
      <section className={styles.available} aria-labelledby={heading}>
        <div className={styles.listHeading}><h3 id={heading}>권한 목록</h3><span>{list.data ? `${query ? "검색 결과 " : "전체 "}${list.data.totalElements.toLocaleString()}개` : "조회 중"}</span></div>
        <div className={styles.toolbar}>
          <SearchInput label="접속 허용 권한 검색" placeholder="권한 이름 또는 코드 검색" maxLength={100} value={search} onChange={event => setSearch(event.target.value)} onSearch={() => { setQuery(search); setPage(1); }} />
          <PageSizeSelect value={size} change={value => { setSize(value); setPage(1); }} />
        </div>
        <fieldset className={styles.options} disabled={disabled || list.loading} aria-busy={list.loading}>
          <legend className={common.visuallyHidden}>추가로 접속을 허용할 권한 선택</legend>
          <div className={`${styles.row} ${styles.columns}`}>
            <input ref={allRef} type="checkbox" aria-label="현재 페이지 권한 전체 선택" checked={allChecked} disabled={items.length === 0} onChange={event => selectPage(event.target.checked)} />
            <span>권한 이름</span><span>권한 코드</span>
          </div>
          {!list.data ? <Loading error={list.error} retry={list.reload} /> : items.length === 0 ? <p className={common.empty}>검색된 권한이 없어요.</p>
            : items.map(role => <label key={role.code} className={styles.row} data-selected={codes.has(role.code)}>
              <input type="checkbox" aria-label={`${role.name} (${role.code}) 접속 허용`} checked={codes.has(role.code)} onChange={event => change(event.target.checked ? [...selected, role] : selected.filter(value => value.code !== role.code))} />
              <span className={styles.roleName}>{role.name}</span><code>{role.code}</code>
            </label>)}
        </fieldset>
        {/* 집계 문구의 길이와 관계없이 번호 탐색은 권한 목록의 정확한 중앙에 둔다. */}
        <div className={styles.listFooter}>
          <p className={styles.range}>{list.data ? `${first}–${last} / ${list.data.totalElements.toLocaleString()}개` : "조회 중"}</p>
          <NumberedPagination page={list.data?.page ?? page} totalPages={list.data?.totalPages ?? page} loading={list.loading || !list.data} change={setPage} label="접속 허용 권한 목록 페이지 탐색" />
        </div>
      </section>
      <section className={styles.selection} aria-labelledby={selectionHeading}>
        <div className={styles.listHeading}><h3 id={selectionHeading}>선택한 권한</h3><span className={styles.count} aria-live="polite">{selected.length}개</span></div>
        <div className={styles.rootRole}><Icon name="lock" /><div><strong>ROOT <span className={styles.count}>항상 허용</span></strong><p>ROOT는 해제할 수 없어요.</p></div></div>
        <ul className={styles.selectedList} aria-label="추가 선택한 접속 허용 권한">
          {selected.length === 0 ? <li className={styles.noSelection}>추가로 선택한 권한이 없어요.<br />ROOT만 항상 접속할 수 있어요.</li>
            : selected.map(role => <li className={styles.selectedRole} key={role.code}>
              <div><strong>{role.name}</strong><code>{role.code}</code></div>
              <button type="button" disabled={disabled} aria-label={`${role.name} (${role.code}) 선택 해제`} onClick={() => change(selected.filter(value => value.code !== role.code))}><Icon name="close" /></button>
            </li>)}
        </ul>
        <p className={styles.selectionHint}>다른 페이지에서 선택한 권한도 함께 표시돼요.</p>
      </section>
    </div>
  </div>;
}
