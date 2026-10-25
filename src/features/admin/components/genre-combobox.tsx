"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { MAX_GAME_GENRES, type GenreOption } from "../genre-options-contracts";
import { useGenreOptions } from "../client/use-genre-options";
import styles from "./genre-combobox.module.css";

/** 검색 입력은 포커스를 유지하고 선택한 장르는 이름 라벨로 별도 보존하는 다중 선택 콤보박스다. */
export function GenreCombobox({ selected, change, disabled = false }: {
  selected: readonly GenreOption[]; change: (genres: readonly GenreOption[]) => void; disabled?: boolean;
}) {
  const id = useId();
  const listId = `${id}-options`, hintId = `${id}-hint`;
  const [state, setState] = useState({ open: false, revision: 0 });
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<{ key: string; code: string }>();
  const [notice, setNotice] = useState<string>();
  const root = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const expanded = state.open && !disabled;
  const options = useGenreOptions(expanded, search, state.revision);
  const current = options.items.find(item => active?.key === options.key && active.code === item.code)
    ?? options.items.find(item => selected.some(genre => genre.code === item.code)) ?? options.items[0];
  const optionId = (code: string) => `${listId}-${code}`;

  function open() { setState(value => value.open ? value : { open: true, revision: value.revision + 1 }); }
  const close = useCallback(() => { setState(value => ({ ...value, open: false })); setSearch(""); setNotice(undefined); }, []);
  function toggle(item: GenreOption) {
    if (disabled) return;
    const exists = selected.some(genre => genre.code === item.code);
    if (!exists && !item.enabled) return;
    if (!exists && selected.length >= MAX_GAME_GENRES) { setNotice(`장르는 최대 ${MAX_GAME_GENRES}개까지 선택할 수 있어요.`); return; }
    setActive({ key: options.key, code: item.code });
    change(exists ? selected.filter(genre => genre.code !== item.code) : [...selected, item]);
    setNotice(undefined);
  }

  useEffect(() => {
    if (!expanded) return;
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !root.current?.contains(event.target)) close(); };
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  }, [expanded, close]);

  useLayoutEffect(() => {
    const element = popup.current, anchor = frame.current;
    if (!expanded || !element || !anchor || typeof element.showPopover !== "function") return;
    // 모달의 스크롤 영역에 잘리지 않도록 네이티브 최상위 팝업을 사용하고 공간이 부족하면 위쪽으로 연다.
    element.showPopover();
    const position = () => {
      const rect = anchor.getBoundingClientRect();
      const labelsBottom = root.current?.getBoundingClientRect().bottom ?? rect.bottom;
      const viewport = window.visualViewport;
      const top = viewport?.offsetTop ?? 0, left = viewport?.offsetLeft ?? 0;
      const width = viewport?.width ?? window.innerWidth, height = viewport?.height ?? window.innerHeight;
      // 선택 라벨 아래 또는 검색창 위에 배치해 열린 목록이 라벨의 해제 버튼을 가리지 않게 한다.
      const below = top + height - labelsBottom - 12, above = rect.top - top - 12;
      const upward = below < 180 && above > below;
      const available = Math.min(320, Math.max(80, upward ? above : below));
      const popupWidth = Math.min(rect.width, width - 16);
      element.style.setProperty("--genre-popup-height", `${available}px`);
      element.style.position = "fixed";
      element.style.width = `${popupWidth}px`;
      element.style.left = `${Math.max(left + 8, Math.min(rect.left, left + width - popupWidth - 8))}px`;
      element.style.top = `${upward ? Math.max(top + 8, rect.top - Math.min(element.scrollHeight, available) - 6) : labelsBottom + 6}px`;
    };
    position();
    const observer = new ResizeObserver(position); observer.observe(anchor);
    if (root.current) observer.observe(root.current);
    window.addEventListener("resize", position);
    window.visualViewport?.addEventListener("resize", position);
    document.addEventListener("scroll", position, true);
    return () => { observer.disconnect(); window.removeEventListener("resize", position);
      window.visualViewport?.removeEventListener("resize", position); document.removeEventListener("scroll", position, true);
      if (element.isConnected && element.matches(":popover-open")) element.hidePopover();
    };
  }, [expanded, options.items, options.loading, options.error, options.hasMore, options.moreError]);

  useEffect(() => {
    if (!expanded || !current) return;
    const option = document.getElementById(`${listId}-${current.code}`), container = list.current;
    if (!option || !container) return;
    // 활성 항목만 목록 안에서 스크롤해 키보드 탐색이 모달이나 페이지의 스크롤을 움직이지 않게 한다.
    const rect = option.getBoundingClientRect(), bounds = container.getBoundingClientRect();
    if (rect.top < bounds.top) container.scrollTop -= bounds.top - rect.top;
    else if (rect.bottom > bounds.bottom) container.scrollTop += rect.bottom - bounds.bottom;
  }, [expanded, current, listId]);

  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault(); open();
      if (!expanded || options.loading || !options.items.length) return;
      const index = options.items.findIndex(item => item.code === current?.code);
      if (event.key === "ArrowDown" && index === options.items.length - 1 && options.hasMore) { void options.loadMore(); return; }
      const next = Math.max(0, Math.min(options.items.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)));
      setActive({ key: options.key, code: options.items[next].code });
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (!expanded) open();
      else if (options.error) options.retry();
      else if (!options.loading && current) toggle(current);
    } else if (event.key === "Tab") close();
  }

  return <div ref={root} className={styles.root} onBlur={event => {
    if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) close();
  }} onKeyDownCapture={event => {
    if (event.nativeEvent.isComposing) return;
    // 첫 Escape는 선택 목록만 닫고 바깥 상세 모달의 Escape 처리까지 전파하지 않는다.
    if (event.key === "Escape" && expanded) { event.preventDefault(); event.stopPropagation(); input.current?.focus(); close(); }
  }}>
    <label className={styles.label} htmlFor={`${id}-search`}>장르</label>
    <div ref={frame} className={styles.inputFrame} data-focus-frame>
      <input ref={input} id={`${id}-search`} role="combobox" type="text" autoComplete="off" spellCheck={false}
        aria-label="장르 검색 및 선택" aria-expanded={expanded} aria-controls={expanded ? listId : undefined} aria-autocomplete="list"
        aria-activedescendant={expanded && !options.loading && current ? optionId(current.code) : undefined} aria-describedby={hintId}
        placeholder="이름 또는 코드로 장르 검색" maxLength={100} value={search} disabled={disabled}
        onFocus={open} onClick={open} onChange={event => { setSearch(event.target.value); open(); }} onKeyDown={keyDown} />
      <button type="button" tabIndex={-1} disabled={disabled} aria-label={expanded ? "장르 목록 닫기" : "장르 목록 열기"}
        onPointerDown={event => event.preventDefault()} onClick={() => { if (expanded) close(); else { input.current?.focus(); open(); } }}>
        <svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m5 7 5 5 5-5" /></svg>
      </button>
    </div>
    <p id={hintId} className={styles.hint}>여러 장르를 선택할 수 있어요. 방향키로 이동하고 Enter로 선택하세요.</p>
    {expanded && <div ref={popup} popover="manual" className={styles.popup}>
      <ul ref={list} id={listId} role="listbox" aria-label="장르 검색 결과" aria-multiselectable="true" aria-busy={options.loading || options.moreBusy}>
        {options.items.map(item => {
          const checked = selected.some(genre => genre.code === item.code);
          const unavailable = !item.enabled && !checked;
          return <li key={item.code} id={optionId(item.code)} role="option" tabIndex={-1} aria-selected={checked} aria-disabled={unavailable || undefined}
            data-active={current?.code === item.code} onPointerDown={event => event.preventDefault()} onClick={() => toggle(item)}
            onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle(item); input.current?.focus(); } }}>
            <span className={styles.check} aria-hidden="true">{checked && "✓"}</span><span>{item.name}<small>{item.code}</small></span>
            {!item.enabled && <span className={styles.disabledLabel}>사용 안 함</span>}
          </li>;
        })}
      </ul>
      {options.loading ? <p className={styles.message} role="status">장르를 불러오는 중이에요.</p>
        : options.error ? <div className={styles.message}><p role="alert">{options.error}</p><button type="button" tabIndex={-1} onPointerDown={event => event.preventDefault()} onClick={options.retry}>다시 불러오기</button></div>
        : options.items.length === 0 ? <p className={styles.message} role="status">검색된 장르가 없어요.</p> : null}
      {options.moreError && <p className={styles.message} role="alert">{options.moreError}</p>}
      {options.hasMore && <button type="button" tabIndex={-1} className={styles.more} disabled={options.moreBusy}
        onPointerDown={event => event.preventDefault()} onClick={() => void options.loadMore()}>{options.moreBusy ? "불러오는 중…" : "장르 더 불러오기"}</button>}
    </div>}
    <div className={styles.chips} role="group" aria-label="선택한 장르">{selected.length === 0 ? <span className={styles.empty}>선택한 장르가 없어요.</span>
      : selected.map(genre => { const latest = options.items.find(item => item.code === genre.code) ?? genre;
        return <button key={genre.code} type="button" disabled={disabled} aria-label={`${latest.name} 선택 해제`} onClick={() => toggle(latest)}>
          {latest.name}{!latest.enabled && <small>사용 안 함</small>}<span aria-hidden="true">×</span>
        </button>;
      })}</div>
    {notice && <p className={styles.limit} role="status">{notice}</p>}
  </div>;
}
