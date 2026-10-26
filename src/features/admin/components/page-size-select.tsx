"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { LobbyIcon } from "@/app/_components/lobby/lobby-icon";
import { PAGE_SIZES } from "../pagination-contracts";
import styles from "./page-size-select.module.css";

/** 관리자 목록의 표시 개수를 같은 UI로 제공하며 탐색 중에는 값을 바꾸지 않고 선택 시에만 반영한다. */
export function PageSizeSelect({ value, change, sizes = PAGE_SIZES, className = "" }: {
  value: number; change: (size: number) => void; sizes?: readonly number[]; className?: string;
}) {
  const id = useId();
  const listId = `${id}-options`;
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const [expanded, setExpanded] = useState(false);
  const [active, setActive] = useState(value);
  const current = sizes.includes(active) ? active : value;
  const close = useCallback(() => { typed.current = { text: "", at: 0 }; setExpanded(false); }, []);

  function open(next = value) { setActive(next); setExpanded(true); }
  function choose(next: number, restoreFocus = true) {
    close();
    if (restoreFocus) trigger.current?.focus({ preventScroll: true });
    if (sizes.includes(next) && next !== value) change(next);
  }

  useEffect(() => {
    if (!expanded) return;
    // 바깥 클릭은 선택을 바꾸지 않고 목록만 닫으며 다음 컨트롤의 포커스를 가로채지 않는다.
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) close();
    };
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  }, [expanded, close]);

  useLayoutEffect(() => {
    const element = popup.current, anchor = trigger.current;
    if (!expanded || !element?.isConnected || !anchor) return;
    // 그리드·모달에 잘리지 않도록 최상위 팝업을 사용하고 화면 가장자리에서는 위치·높이를 보정한다.
    element.showPopover();
    const position = () => {
      const rect = anchor.getBoundingClientRect();
      const viewport = window.visualViewport;
      const top = viewport?.offsetTop ?? 0, left = viewport?.offsetLeft ?? 0;
      const width = viewport?.width ?? innerWidth, height = viewport?.height ?? innerHeight;
      const unit = Number.parseFloat(getComputedStyle(anchor).fontSize);
      const gap = unit * .4, gutter = unit * .5;
      const below = top + height - rect.bottom - gap - gutter, above = rect.top - top - gap - gutter;
      const upward = below < element.scrollHeight && above > below;
      const available = Math.max(0, upward ? above : below);
      const popupWidth = Math.min(Math.max(rect.width, unit * 9), width - gutter * 2);
      element.style.maxHeight = `${available}px`;
      element.style.width = `${popupWidth}px`;
      element.style.left = `${Math.max(left + gutter, Math.min(rect.right - popupWidth, left + width - popupWidth - gutter))}px`;
      element.style.top = `${upward ? Math.max(top + gutter, rect.top - Math.min(element.scrollHeight, available) - gap) : rect.bottom + gap}px`;
    };
    position();
    const observer = new ResizeObserver(position); observer.observe(anchor);
    window.addEventListener("resize", position);
    document.addEventListener("scroll", position, true);
    window.visualViewport?.addEventListener("resize", position);
    window.visualViewport?.addEventListener("scroll", position);
    return () => {
      observer.disconnect(); window.removeEventListener("resize", position); document.removeEventListener("scroll", position, true);
      window.visualViewport?.removeEventListener("resize", position); window.visualViewport?.removeEventListener("scroll", position);
      if (element.isConnected && element.matches(":popover-open")) element.hidePopover();
    };
  }, [expanded]);

  useLayoutEffect(() => {
    const list = popup.current, option = document.getElementById(`${listId}-${current}`);
    if (!expanded || !list || !option) return;
    // 키보드 활성 항목만 목록 안에서 이동시켜 페이지나 부모 모달의 스크롤은 유지한다.
    const rect = option.getBoundingClientRect(), bounds = list.getBoundingClientRect();
    if (rect.top < bounds.top) list.scrollTop -= bounds.top - rect.top;
    else if (rect.bottom > bounds.bottom) list.scrollTop += rect.bottom - bounds.bottom;
  }, [expanded, current, listId]);

  function keyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.nativeEvent.isComposing) return;
    const index = Math.max(0, sizes.indexOf(current));
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault(); if (expanded) choose(current); else open();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (event.altKey && event.key === "ArrowUp" && expanded) choose(current);
      else if (!expanded) open();
      else setActive(sizes[Math.max(0, Math.min(sizes.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))]);
    } else if (["Home", "End", "PageUp", "PageDown"].includes(event.key)) {
      event.preventDefault(); open(event.key === "Home" || event.key === "PageUp" ? sizes[0] : sizes[sizes.length - 1]);
    } else if (event.key === "Tab" && expanded) choose(current, false);
    else if (!event.ctrlKey && !event.metaKey && !event.altKey && /^\d$/.test(event.key)) {
      event.preventDefault();
      // 숫자 연속 입력으로 항목을 찾고 입력 간격이 길어지면 새 탐색으로 시작한다.
      const now = performance.now(), text = now - typed.current.at < 700 ? typed.current.text + event.key : event.key;
      typed.current = { text, at: now };
      const next = sizes.find(size => String(size).startsWith(text));
      if (next !== undefined) open(next);
    }
  }

  return <div ref={root} className={`${styles.root} ${className}`} onBlur={event => {
    if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) close();
  }} onKeyDownCapture={event => {
    // Escape는 펼친 선택 목록만 취소하고 바깥 모달의 닫기 동작으로 전파하지 않는다.
    if (expanded && event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
  }}>
    <button ref={trigger} type="button" role="combobox" className={styles.trigger} aria-label="페이지당 표시 개수"
      aria-haspopup="listbox" aria-expanded={expanded} aria-controls={expanded ? listId : undefined}
      aria-activedescendant={expanded ? `${listId}-${current}` : undefined} onKeyDown={keyDown}
      onClick={() => { if (expanded) close(); else open(); }}>
      <span>{value}개씩</span><LobbyIcon name="chevron" className={styles.arrow} />
    </button>
    {expanded && <ul ref={popup} id={listId} role="listbox" aria-label="페이지당 표시 개수" popover="manual" className={styles.popup}>
      {sizes.map(size => <li key={size} id={`${listId}-${size}`} role="option" aria-selected={size === value} data-active={size === current}
        onPointerMove={event => { if (event.pointerType !== "touch") setActive(size); }}
        onPointerDown={event => { if (event.pointerType === "mouse") event.preventDefault(); }} onClick={() => choose(size)}>
        <span>{size}개씩</span><span className={styles.check} aria-hidden="true">{size === value && <LobbyIcon name="check" />}</span>
      </li>)}
    </ul>}
  </div>;
}
