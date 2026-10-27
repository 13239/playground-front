"use client";

import { useAdminList } from "./admin-list";
import { useId } from "react";
import { Loading } from "./admin-ui";
import { SearchInput } from "@/components/ui/search-input";
import styles from "./admin.module.css";

/** 선택 집합을 페이지와 분리해 역할·장르가 계속 늘어도 다른 페이지의 선택을 보존한다. */
export function CodePicker({ area, label, selected, change, disabled = false, exclude = [], single = false }: {
  area: string; label: string; selected: readonly string[]; change: (codes: readonly string[]) => void; disabled?: boolean; exclude?: readonly string[]; single?: boolean;
}) {
  const list = useAdminList<{ code: string; name: string }>(area);
  const name = useId();
  return <div className={styles.picker}>
    {/* 검색은 부모 저장 폼을 제출하지 않고 공통 입력의 클릭·Enter로 같은 코드 조회만 실행한다. */}
    <SearchInput label={`${label} 검색`} placeholder={`${label} 검색`} maxLength={100} value={list.search} onChange={e => list.setSearch(e.target.value)} onSearch={list.submit} />
    {/* 단일 선택은 네이티브 라디오로 제공해 역할이 늘어나도 키보드 조작을 유지한다. */}
    {!list.data ? <Loading error={list.error} retry={list.reload} /> : <div className={styles.pickerOptions}>{list.data.items.filter(r => !exclude.includes(r.code)).map(r => <label className={styles.checkRow} key={r.code}><input type={single ? "radio" : "checkbox"} name={single ? name : undefined} disabled={disabled} checked={selected.includes(r.code)} onChange={e => change(single ? [r.code] : e.target.checked ? [...selected, r.code] : selected.filter(c => c !== r.code))} /><span>{r.name}<small>{r.code}</small></span></label>)}{list.data.items.filter(r => !exclude.includes(r.code)).length === 0 && <p>검색된 항목이 없어요.</p>}</div>}
    <div className={styles.pagination}><button type="button" onClick={list.previous} disabled={!list.hasPrevious}>이전</button><button type="button" onClick={list.next} disabled={!list.data?.nextCursor}>다음</button></div>
    <div className={styles.chips} aria-label={`선택한 ${label}`}>{selected.length === 0 ? <small>선택한 {label} 없음</small> : selected.map(code => <button type="button" key={code} disabled={disabled} aria-label={`${code} 선택 해제`} onClick={() => change(selected.filter(c => c !== code))}>{code} ×</button>)}</div>
  </div>;
}
