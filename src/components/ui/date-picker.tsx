"use client";

import { useId, useLayoutEffect, useRef, useState, type AriaAttributes, type KeyboardEvent } from "react";
import { Icon } from "./icon";
import { changeNativeValue, useFormControlValue } from "./form-control";
import { addDays, addMonths, clampDate, dateError, parseDate, todayDate } from "./calendar-date";
import { useAnchoredPopover } from "./use-anchored-popover";
import common from "./controls.module.css";
import styles from "./date-picker.module.css";

type View = "days" | "months" | "years";
type Props = Pick<AriaAttributes, "aria-invalid" | "aria-describedby"> & {
  label: string; value?: string; defaultValue?: string; onValueChange?: (value: string) => void; name?: string; id?: string;
  min?: string; max?: string; required?: boolean; disabled?: boolean; readOnly?: boolean; className?: string;
};

/** 직접 입력·연월 이동·날짜 선택을 같은 달력 UI로 제공하며 네이티브 폼 검증과 값 형식을 유지한다. */
export function DatePicker({ label, value, defaultValue = "", onValueChange, name, id, min = "0001-01-01", max = "9999-12-31", required, disabled, readOnly, className = "", ...aria }: Props) {
  const generatedId = useId(), popupId = `${generatedId}-calendar`, errorId = `${generatedId}-error`;
  const input = useRef<HTMLInputElement>(null);
  const field = useFormControlValue(input, value, defaultValue, onValueChange);
  const [expanded, setExpanded] = useState(false), [view, setView] = useState<View>("days"), [focused, setFocused] = useState("2000-01-01"), [error, setError] = useState("");
  const focusGrid = useRef(false);
  const open = expanded && !disabled && !readOnly;
  const current = parseDate(focused)!, year = current.getUTCFullYear(), month = current.getUTCMonth() + 1;
  const yearStart = Math.floor((year - 1) / 12) * 12 + 1;
  const start = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`;
  const gridStart = addDays(start, -parseDate(start)!.getUTCDay());
  const days = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  const within = (day: string) => Boolean(parseDate(day)) && day >= min && day <= max;
  // 여섯 주와 하단 동작까지 보이는 높이를 확보하고 작은 화면에서만 내부 스크롤을 허용한다.
  const { root, anchor, popup } = useAnchoredPopover<HTMLDivElement, HTMLDivElement>({ open, onClose: () => setExpanded(false), width: 20.5, maxHeight: 27 });
  useLayoutEffect(() => { input.current?.setCustomValidity(dateError(field.value, min, max, required)); }, [field.value, min, max, required]);
  useLayoutEffect(() => {
    if (!open || !focusGrid.current) return;
    const selector = view === "days" ? `[data-date="${focused}"]` : view === "months" ? `[data-month="${month}"]` : `[data-year="${year}"]`;
    popup.current?.querySelector<HTMLButtonElement>(selector)?.focus({ preventScroll: true }); focusGrid.current = false;
  }, [open, view, focused, month, year, popup]);

  function show() { if (disabled || readOnly) return; focusGrid.current = true; setFocused(clampDate(parseDate(field.value) ? field.value : todayDate(), min, max)); setView("days"); setExpanded(true); }
  function pick(day: string) { setExpanded(false); setError(""); changeNativeValue(input.current, day); input.current?.focus({ preventScroll: true }); }
  function showView(next: View) { focusGrid.current = true; setView(next); }
  function move(amount: number) { setFocused(clampDate(addMonths(focused, amount * (view === "days" ? 1 : view === "months" ? 12 : 144)), min, max)); }
  function dayKey(event: KeyboardEvent<HTMLButtonElement>, day: string) {
    let next: string | undefined;
    if (event.key === "ArrowLeft") next = addDays(day, -1);
    else if (event.key === "ArrowRight") next = addDays(day, 1);
    else if (event.key === "ArrowUp") next = addDays(day, -7);
    else if (event.key === "ArrowDown") next = addDays(day, 7);
    else if (event.key === "Home") next = addDays(day, -parseDate(day)!.getUTCDay());
    else if (event.key === "End") next = addDays(day, 6 - parseDate(day)!.getUTCDay());
    else if (event.key === "PageUp" || event.key === "PageDown") next = addMonths(day, (event.key === "PageUp" ? -1 : 1) * (event.shiftKey ? 12 : 1));
    if (next) { event.preventDefault(); focusGrid.current = true; setFocused(clampDate(next, min, max)); }
  }
  function panelKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const offset = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 }[event.key];
    if (offset === undefined && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? 11 : Math.max(0, Math.min(11, index + offset!));
    const target = view === "months" ? addMonths(focused, next + 1 - month) : addMonths(focused, (Math.min(9999, yearStart + next) - year) * 12);
    focusGrid.current = true; setFocused(clampDate(target, min, max));
  }
  const previous = addMonths(focused, -(view === "days" ? 1 : view === "months" ? 12 : 144));
  const next = addMonths(focused, view === "days" ? 1 : view === "months" ? 12 : 144);
  return <div ref={root} className={`${common.root} ${className}`} data-ui-date onBlur={event => {
    if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setExpanded(false);
  }} onKeyDown={event => {
    // 연월·날짜 탐색의 Escape는 달력만 닫고 부모 편집 모달을 유지한다.
    if (open && event.key === "Escape" && !event.defaultPrevented) { event.preventDefault(); event.stopPropagation(); setExpanded(false); input.current?.focus({ preventScroll: true }); }
  }}>
    <div ref={anchor} className={common.frame} data-focus-frame>
      <input ref={input} id={id} name={name} type="text" inputMode="numeric" autoComplete="off" maxLength={10} placeholder="YYYY-MM-DD" className={common.input}
        value={field.value} required={required} disabled={disabled} readOnly={readOnly} aria-label={label} aria-invalid={aria["aria-invalid"] || !!error || undefined}
        aria-describedby={[aria["aria-describedby"], error ? errorId : ""].filter(Boolean).join(" ") || undefined}
        onChange={event => { setError(""); field.change(event.currentTarget.value); }} onInvalid={event => {
          event.preventDefault(); setError(dateError(field.value, min, max, required)); input.current?.focus({ preventScroll: true });
        }} onKeyDown={event => { if (event.altKey && event.key === "ArrowDown") { event.preventDefault(); show(); } }} />
      <button type="button" className={common.iconButton} aria-label={`${label} 달력 열기`} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? popupId : undefined}
        disabled={disabled || readOnly} onClick={() => { if (open) setExpanded(false); else show(); }}><Icon name="calendar" /></button>
    </div>
    {error && <span id={errorId} className={common.error} role="alert">{error}</span>}
    {open && <div ref={popup} id={popupId} role="dialog" aria-label={`${label} 날짜 선택`} popover="manual" className={`${common.popup} ${styles.calendar}`}>
      <div className={styles.header}>
        <button type="button" className={styles.nav} aria-label={view === "days" ? "이전 달" : view === "months" ? "이전 연도" : "이전 연도 범위"} disabled={clampDate(previous, min, max) === focused} onClick={() => move(-1)}><Icon name="chevron" /></button>
        <div className={styles.heading}><button type="button" onClick={() => showView("years")}>{year}년</button><button type="button" onClick={() => showView("months")}>{view === "years" ? "연도 선택" : `${month}월`}</button></div>
        <button type="button" className={styles.nav} aria-label={view === "days" ? "다음 달" : view === "months" ? "다음 연도" : "다음 연도 범위"} disabled={clampDate(next, min, max) === focused} onClick={() => move(1)}><Icon name="chevron" /></button>
      </div>
      <span className={common.visuallyHidden} aria-live="polite">{view === "years" ? `${yearStart}년부터 ${Math.min(9999, yearStart + 11)}년` : `${year}년 ${month}월`}</span>
      {view === "days" ? <table role="grid" aria-label={`${year}년 ${month}월`} className={styles.days}>
        <thead><tr>{["일", "월", "화", "수", "목", "금", "토"].map(day => <th key={day} scope="col">{day}</th>)}</tr></thead>
        {/* 포인터 포커스만으로 표시 월을 바꾸면 인접 월 날짜가 클릭 전에 이동하므로 탐색은 키보드·헤더에서만 처리한다. */}
        <tbody>{Array.from({ length: 6 }, (_, week) => <tr key={week}>{days.slice(week * 7, week * 7 + 7).map(day => <td key={day} aria-selected={day === field.value}>
          <button type="button" data-date={day} data-outside={day.slice(0, 7) !== start.slice(0, 7)} data-selected={day === field.value}
            aria-label={`${day.replaceAll("-", ". ")}`} aria-current={day === todayDate() ? "date" : undefined} disabled={!within(day)} tabIndex={day === focused ? 0 : -1}
            onKeyDown={event => dayKey(event, day)} onClick={() => pick(day)}>{Number(day.slice(-2))}</button>
        </td>)}</tr>)}</tbody>
      </table> : <div className={styles.periodGrid} role="group" aria-label={view === "months" ? "월 선택" : "연도 선택"}>
        {Array.from({ length: 12 }, (_, index) => {
          const candidateYear = view === "years" ? yearStart + index : year, candidateMonth = view === "months" ? index + 1 : month;
          const candidate = `${String(candidateYear).padStart(4, "0")}-${String(candidateMonth).padStart(2, "0")}-01`;
          const unavailable = candidateYear > 9999 || (view === "months" ? candidate.slice(0, 7) < min.slice(0, 7) || candidate.slice(0, 7) > max.slice(0, 7) : candidateYear < Number(min.slice(0, 4)) || candidateYear > Number(max.slice(0, 4)));
          return <button key={index} type="button" data-month={view === "months" ? candidateMonth : undefined} data-year={view === "years" ? candidateYear : undefined}
            data-selected={view === "months" ? candidateMonth === month : candidateYear === year} disabled={unavailable}
            tabIndex={(view === "months" ? candidateMonth === month : candidateYear === year) ? 0 : -1} onKeyDown={event => panelKey(event, index)} onClick={() => {
              focusGrid.current = true; setFocused(clampDate(candidate, min, max)); setView(view === "months" ? "days" : "months");
            }}>{view === "months" ? `${candidateMonth}월` : `${candidateYear}년`}</button>;
        })}
      </div>}
      <div className={styles.footer}><button type="button" onClick={() => pick("")}>지우기</button><button type="button" disabled={!within(todayDate())} onClick={() => pick(todayDate())}>오늘</button></div>
    </div>}
  </div>;
}
