"use client";

import { useState, type ReactNode } from "react";
import { useAdminResource } from "../client/use-admin-resource";
import { listPath } from "../client/api";
import type { Page } from "../contracts";
import { useAdminScope, Loading } from "./admin-ui";
import styles from "./admin.module.css";

/** 전체 건수를 세지 않고 서버 커서로 이동한다. 검색 변경 시 선택·페이지를 함께 초기화한다. */
export function useAdminList<T extends { code: string }>(area: string) {
  const { sessionId } = useAdminScope();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [cursors, setCursors] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>();
  const resource = useAdminResource<Page<T>>(sessionId, listPath(area, query, cursors.at(-1)));
  return { ...resource, search, setSearch, selected: selected ?? resource.data?.items[0]?.code, select: setSelected,
    submit: () => { setQuery(search); setCursors([]); setSelected(undefined); },
    hasPrevious: cursors.length > 0,
    previous: () => { setCursors(c => c.slice(0, -1)); setSelected(undefined); },
    next: () => { if (resource.data?.nextCursor) setCursors(c => [...c, resource.data!.nextCursor!]); setSelected(undefined); },
  };
}
type ListState<T extends { code: string }> = ReturnType<typeof useAdminList<T>>;
export function AdminList<T extends { code: string; name: string }>({ list, label, extra, detail, onSelect }: {
  list: ListState<T>; label: string; extra?: ReactNode; detail?: (item: T) => ReactNode; onSelect?: () => void;
}) {
  return <section className={styles.listPanel} aria-label={`${label} 목록`}>
    <div className={styles.listHeading}><h2>{label} 목록</h2>{extra}</div>
    <form className={styles.search} data-focus-frame onSubmit={event => { event.preventDefault(); list.submit(); }}>
      <input aria-label={`${label} 검색`} placeholder="이름 또는 코드 검색" maxLength={100} value={list.search} onChange={event => list.setSearch(event.target.value)} />
      <button type="submit">검색</button>
    </form>
    {!list.data ? <Loading error={list.error} retry={list.reload} /> : list.data.items.length === 0 ? <p className={styles.empty}>검색 결과가 없어요.</p>
      : <div className={styles.listItems}>{list.data.items.map(item => <button type="button" key={item.code} className={styles.listItem} aria-pressed={list.selected === item.code} onClick={() => { onSelect?.(); list.select(item.code); }}><span><strong>{item.name}</strong><small>{item.code}</small></span>{detail?.(item)}</button>)}</div>}
    <div className={styles.pagination}><button type="button" disabled={!list.hasPrevious} onClick={list.previous}>이전</button><button type="button" disabled={!list.data?.nextCursor} onClick={list.next}>다음</button></div>
  </section>;
}
