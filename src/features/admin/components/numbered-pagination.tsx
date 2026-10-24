"use client";

import styles from "./admin.module.css";

/** 번호 창만 렌더링해 페이지 수가 늘어도 크기를 제한하고 모바일에서도 네 이동 버튼을 유지한다. */
export function NumberedPagination({ page, totalPages, loading = false, change, label = "페이지 탐색" }: {
  page: number; totalPages: number; loading?: boolean; change: (page: number) => void; label?: string;
}) {
  const last = Math.max(1, totalPages);
  const current = Math.min(Math.max(1, page), last);
  const start = Math.max(1, Math.min(current - 2, last - 4));
  const mobileStart = Math.max(1, Math.min(current - 1, last - 2));
  const pages = Array.from({ length: Math.min(5, last) }, (_, index) => start + index);
  return <nav className={styles.numberedPagination} aria-label={label}>
    <button type="button" aria-label="첫 페이지" title="첫 페이지" disabled={loading || current === 1} onClick={() => change(1)}><PageArrow direction="previous" edge /></button>
    <button type="button" aria-label="이전 페이지" title="이전 페이지" disabled={loading || current === 1} onClick={() => change(current - 1)}><PageArrow direction="previous" /></button>
    {pages.map(value => <button key={value} type="button" aria-label={`${value}페이지`} aria-current={value === current ? "page" : undefined}
      data-mobile-visible={value >= mobileStart && value < mobileStart + 3} disabled={loading}
      onClick={() => { if (value !== current) change(value); }}>{value}</button>)}
    <button type="button" aria-label="다음 페이지" title="다음 페이지" disabled={loading || current === last} onClick={() => change(current + 1)}><PageArrow direction="next" /></button>
    <button type="button" aria-label="마지막 페이지" title="마지막 페이지" disabled={loading || current === last} onClick={() => change(last)}><PageArrow direction="next" edge /></button>
  </nav>;
}

/** 동일한 벡터를 반전해 이전/다음과 첫/마지막 버튼의 방향·선 굵기를 맞춘다. */
function PageArrow({ direction, edge = false }: { direction: "previous" | "next"; edge?: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
    style={direction === "previous" ? { transform: "rotate(180deg)" } : undefined}>
    <path d={edge ? "m7 6 6 6-6 6M17 5v14" : "m9 6 6 6-6 6"} />
  </svg>;
}
