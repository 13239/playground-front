"use client";

import { useCallback, useId, useLayoutEffect, useRef, useState, type AriaAttributes, type KeyboardEvent } from "react";
import { Icon } from "./icon";
import { changeNativeValue, useFormControlValue } from "./form-control";
import { useAnchoredPopover } from "./use-anchored-popover";
import styles from "./controls.module.css";

export type SelectOption = Readonly<{ value: string; label: string; disabled?: boolean; description?: string }>;
export type SelectProps = Pick<AriaAttributes, "aria-invalid" | "aria-describedby"> & {
  label: string; options: readonly SelectOption[]; value?: string; defaultValue?: string; onValueChange?: (value: string) => void;
  name?: string; id?: string; disabled?: boolean; required?: boolean; className?: string; placeholder?: string;
};

/** 모든 단일 선택은 동일한 목록·키보드 동작을 사용하며 숨긴 네이티브 컨트롤로 폼 계약을 보존한다. */
export function Select({ label, options, value, defaultValue, onValueChange, name, id, disabled, required, className = "", placeholder = "선택하세요", ...aria }: SelectProps) {
  const generatedId = useId(), listId = `${generatedId}-options`;
  const native = useRef<HTMLSelectElement>(null);
  const field = useFormControlValue(native, value, defaultValue ?? options[0]?.value ?? "", onValueChange);
  const [expanded, setExpanded] = useState(false), [active, setActive] = useState(field.value), [invalid, setInvalid] = useState(false);
  const typed = useRef({ text: "", at: 0 });
  const selected = options.find(option => option.value === field.value);
  const available = options.filter(option => !option.disabled);
  const current = available.find(option => option.value === active)?.value ?? available[0]?.value;
  const close = useCallback(() => { typed.current = { text: "", at: 0 }; setExpanded(false); }, []);
  const open = expanded && !disabled;
  const { root, anchor: trigger, popup } = useAnchoredPopover({ open, onClose: close });

  function expand(next = field.value) {
    if (trigger.current?.matches(":disabled") || !available.length) return;
    setActive(available.some(option => option.value === next) ? next : available[0].value); setExpanded(true);
  }
  function choose(next: string | undefined, restoreFocus = true) {
    close();
    if (restoreFocus) trigger.current?.focus({ preventScroll: true });
    if (next !== undefined && next !== field.value && available.some(option => option.value === next)) changeNativeValue(native.current, next);
  }
  useLayoutEffect(() => {
    const list = popup.current, option = current === undefined ? null : document.getElementById(`${listId}-${options.findIndex(item => item.value === current)}`);
    if (!open || !list || !option) return;
    // 활성 항목만 목록 안에서 스크롤하고 부모 모달·페이지의 위치는 바꾸지 않는다.
    const rect = option.getBoundingClientRect(), bounds = list.getBoundingClientRect();
    if (rect.top < bounds.top) list.scrollBy(0, rect.top - bounds.top);
    else if (rect.bottom > bounds.bottom) list.scrollBy(0, rect.bottom - bounds.bottom);
  }, [open, current, listId, options, popup]);

  function keyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.nativeEvent.isComposing) return;
    const index = Math.max(0, available.findIndex(option => option.value === current));
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault(); if (open) choose(current); else expand();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (event.altKey && event.key === "ArrowUp" && open) choose(current);
      else if (!open) expand();
      else setActive(available[Math.max(0, Math.min(available.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))]?.value ?? "");
    } else if (["Home", "End", "PageUp", "PageDown"].includes(event.key)) {
      event.preventDefault(); expand(event.key === "Home" || event.key === "PageUp" ? available[0]?.value : available.at(-1)?.value);
    } else if (event.key === "Tab" && open) choose(current, false);
    else if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.length === 1) {
      event.preventDefault();
      // 숫자·글자 연속 입력으로 항목을 찾고 입력 간격이 길어지면 새 탐색으로 시작한다.
      const now = performance.now(), previous = now - typed.current.at < 700 ? typed.current.text : "";
      const query = (previous === event.key ? event.key : previous + event.key).toLocaleLowerCase("ko-KR");
      const match = available.find(option => option.label.toLocaleLowerCase("ko-KR").startsWith(query));
      typed.current = { text: query, at: now }; if (match) expand(match.value);
    }
  }
  return <div ref={root} className={`${styles.root} ${className}`} data-ui-select onBlur={event => {
    if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) close();
  }} onKeyDownCapture={event => {
    // Escape는 펼친 선택 목록만 취소하고 바깥 모달의 닫기 동작으로 전파하지 않는다.
    if (open && event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
  }}>
    <button ref={trigger} type="button" id={id} role="combobox" className={styles.trigger} disabled={disabled} aria-label={label}
      aria-required={required || undefined} aria-invalid={aria["aria-invalid"] || invalid || undefined} aria-describedby={aria["aria-describedby"]}
      aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined}
      aria-activedescendant={open && current !== undefined ? `${listId}-${options.findIndex(option => option.value === current)}` : undefined}
      onKeyDown={keyDown} onClick={() => { if (open) close(); else expand(); }}>
      <span>{selected?.label ?? placeholder}</span><Icon name="chevron" className={styles.arrow} />
    </button>
    <select ref={native} name={name} value={field.value} disabled={disabled} required={required} tabIndex={-1} aria-hidden="true" className={styles.native}
      onChange={event => { setInvalid(false); field.change(event.currentTarget.value); }} onInvalid={event => {
        // 필수 값이 없을 때 브라우저 숨김 컨트롤 대신 실제 선택창으로 이동한다.
        event.preventDefault(); setInvalid(true); trigger.current?.focus({ preventScroll: true });
      }}>
      {!options.some(option => option.value === field.value) && <option value="">{placeholder}</option>}
      {options.map(option => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
    </select>
    {invalid && <span className={styles.error} role="alert">{label} 항목을 선택해 주세요.</span>}
    {open && <ul ref={popup} id={listId} role="listbox" aria-label={label} popover="manual" className={styles.popup}
      onClick={event => event.preventDefault()}>
      {options.length ? options.map((option, index) => <li key={option.value} id={`${listId}-${index}`} role="option" className={styles.option}
        aria-selected={option.value === field.value} aria-disabled={option.disabled || undefined} data-active={option.value === current}
        onPointerMove={event => { if (!option.disabled && event.pointerType !== "touch") setActive(option.value); }}
        onPointerDown={event => { if (event.pointerType === "mouse") event.preventDefault(); }} onClick={() => { if (!option.disabled) choose(option.value); }}>
        <span>{option.label}{option.description && <small>{option.description}</small>}</span><span className={styles.check} aria-hidden="true">{option.value === field.value && <Icon name="check" />}</span>
      </li>) : <li className={styles.option}>선택할 항목이 없어요.</li>}
    </ul>}
  </div>;
}
