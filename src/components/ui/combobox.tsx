"use client";

import { useCallback, useId, useLayoutEffect, useState, type KeyboardEvent } from "react";
import { Icon } from "./icon";
import { SearchInput } from "./search-input";
import { useAnchoredPopover } from "./use-anchored-popover";
import type { SelectOption } from "./select";
import common from "./controls.module.css";
import styles from "./combobox.module.css";

type Props = {
  label: string; options: readonly SelectOption[]; selected: readonly SelectOption[]; onSelectionChange: (value: readonly SelectOption[]) => void;
  query: string; onQueryChange: (value: string) => void; open: boolean; onOpenChange: (open: boolean) => void;
  disabled?: boolean; maxSelections?: number; placeholder?: string; loading?: boolean; error?: string; onRetry?: () => void;
  hasMore?: boolean; moreBusy?: boolean; moreError?: string; onLoadMore?: () => void; className?: string;
};

/** 검색 입력의 포커스와 검색 결과와 별도로 보존한 선택 라벨을 제공한다. 조회·권한·저장 규칙은 기능별 호출자가 소유한다. */
export function Combobox({ label, options, selected, onSelectionChange, query, onQueryChange, open, onOpenChange, disabled, maxSelections = 128, placeholder, loading, error, onRetry, hasMore, moreBusy, moreError, onLoadMore, className = "" }: Props) {
  const id = useId(), listId = `${id}-options`, hintId = `${id}-hint`;
  const [active, setActive] = useState<string>(), [notice, setNotice] = useState<string>();
  const expanded = open && !disabled;
  const close = useCallback(() => { onOpenChange(false); onQueryChange(""); setNotice(undefined); }, [onOpenChange, onQueryChange]);
  const { root, anchor: input, popup } = useAnchoredPopover<HTMLInputElement, HTMLDivElement>({ open: expanded, onClose: close, belowContent: true });
  const current = options.find(option => option.value === active) ?? options.find(option => selected.some(item => item.value === option.value)) ?? options[0];
  const optionId = (value: string) => `${listId}-${options.findIndex(option => option.value === value)}`;
  function toggle(option: SelectOption) {
    if (disabled) return;
    const exists = selected.some(item => item.value === option.value);
    if (!exists && option.disabled) return;
    if (!exists && selected.length >= maxSelections) { setNotice(`${label} 항목은 최대 ${maxSelections}개까지 선택할 수 있어요.`); return; }
    setActive(option.value); setNotice(undefined);
    onSelectionChange(exists ? selected.filter(item => item.value !== option.value) : [...selected, option]);
  }
  useLayoutEffect(() => {
    const list = popup.current?.querySelector<HTMLElement>('[role="listbox"]'), option = current ? document.getElementById(optionId(current.value)) : null;
    if (!expanded || !list || !option) return;
    // 활성 항목만 목록 안에서 스크롤해 키보드 탐색이 모달이나 페이지를 이동시키지 않게 한다.
    const rect = option.getBoundingClientRect(), bounds = list.getBoundingClientRect();
    if (rect.top < bounds.top) list.scrollTop -= bounds.top - rect.top;
    else if (rect.bottom > bounds.bottom) list.scrollTop += rect.bottom - bounds.bottom;
  });
  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault(); onOpenChange(true);
      if (!expanded || loading || !options.length) return;
      const index = options.findIndex(option => option.value === current?.value);
      if (event.key === "ArrowDown" && index === options.length - 1 && hasMore) { onLoadMore?.(); return; }
      setActive(options[Math.max(0, Math.min(options.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))].value);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (!expanded) onOpenChange(true); else if (error) onRetry?.(); else if (!loading && current) toggle(current);
    } else if (event.key === "Tab") close();
  }
  return <div ref={root} className={`${styles.root} ${className}`} onBlur={event => {
    if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) close();
  }} onKeyDownCapture={event => {
    // 첫 Escape는 검색 선택 목록만 닫고 바깥 상세 모달은 유지한다.
    if (expanded && event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); input.current?.focus({ preventScroll: true }); }
  }}>
    <label className={styles.label} htmlFor={`${id}-search`}>{label}</label>
    <SearchInput ref={input} id={`${id}-search`} role="combobox" label={`${label} 검색 및 선택`} placeholder={placeholder} value={query} disabled={disabled}
      aria-expanded={expanded} aria-controls={expanded ? listId : undefined} aria-autocomplete="list" aria-describedby={hintId}
      aria-activedescendant={expanded && !loading && current ? optionId(current.value) : undefined} autoComplete="off" spellCheck={false} maxLength={100}
      onFocus={() => onOpenChange(true)} onClick={() => onOpenChange(true)} onSearch={() => onOpenChange(true)} onKeyDown={keyDown}
      onChange={event => { setActive(undefined); onQueryChange(event.target.value); onOpenChange(true); }} />
    <p id={hintId} className={styles.hint}>여러 항목을 선택할 수 있어요. 방향키로 이동하고 Enter로 선택하세요.</p>
    {expanded && <div ref={popup} popover="manual" className={`${common.popup} ${styles.popup}`}>
      <ul id={listId} role="listbox" aria-label={`${label} 검색 결과`} aria-multiselectable="true" aria-busy={loading || moreBusy}>
        {options.map(option => {
          const checked = selected.some(item => item.value === option.value), unavailable = option.disabled && !checked;
          return <li key={option.value} id={optionId(option.value)} role="option" className={common.option} aria-selected={checked} aria-disabled={unavailable || undefined}
            data-active={current?.value === option.value} onPointerDown={event => { if (event.pointerType === "mouse") event.preventDefault(); }} onClick={() => toggle(option)}>
            <span>{option.label}{option.description && <small>{option.description}</small>}</span>
            {option.disabled && <small>사용 안 함</small>}<span className={common.check} aria-hidden="true">{checked && <Icon name="check" />}</span>
          </li>;
        })}
      </ul>
      {loading ? <p className={styles.message} role="status">목록을 불러오는 중이에요.</p> : error ? <div className={styles.message}><p role="alert">{error}</p><button type="button" onClick={onRetry}>다시 불러오기</button></div>
        : !options.length ? <p className={styles.message} role="status">검색된 항목이 없어요.</p> : null}
      {moreError && <p className={styles.message} role="alert">{moreError}</p>}
      {hasMore && <button type="button" className={styles.more} disabled={moreBusy} onClick={onLoadMore}>{moreBusy ? "불러오는 중…" : "더 불러오기"}</button>}
    </div>}
    <div className={styles.chips} role="group" aria-label={`선택한 ${label}`}>
      {!selected.length ? <span className={styles.hint}>선택한 항목이 없어요.</span> : selected.map(item => {
        const latest = options.find(option => option.value === item.value) ?? item;
        return <button key={item.value} type="button" disabled={disabled} aria-label={`${latest.label} 선택 해제`} onClick={() => toggle(latest)}>{latest.label}{latest.disabled && <small>사용 안 함</small>}<Icon name="close" /></button>;
      })}
    </div>
    {notice && <p className={styles.message} role="status">{notice}</p>}
  </div>;
}
