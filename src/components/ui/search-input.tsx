"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, Ref } from "react";
import { Icon } from "./icon";
import styles from "./controls.module.css";

/** 텍스트 검색 버튼을 대체하며 접근 가능한 이름과 기존 submit/button 동작을 유지한다. */
export function SearchButton({ label = "검색", className = "", ...props }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & { label?: string }) {
  return <button type="submit" {...props} className={`${styles.iconButton} ${className}`} aria-label={label} title={label}><Icon name="search" /></button>;
}

/** 검색 입력과 돋보기를 하나의 공통 1px 포커스 프레임으로 제공한다. 홈·방 검색은 사용자 요청에 따라 기존 UI를 유지한다. */
export function SearchInput({ label, className = "", onSearch, ref, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className"> & {
  label: string; className?: string; onSearch?: () => void; ref?: Ref<HTMLInputElement>;
}) {
  return <div className={`${styles.root} ${className}`} data-ui-search>
    <div className={styles.frame} data-focus-frame>
      <input {...props} ref={ref} type="search" className={styles.input} aria-label={props["aria-label"] ?? label} onKeyDown={event => {
        props.onKeyDown?.(event);
        // 중첩 폼의 코드 검색도 아이콘 클릭과 Enter가 같은 검색만 실행하도록 한다.
        if (onSearch && event.key === "Enter" && !event.defaultPrevented && !event.nativeEvent.isComposing) { event.preventDefault(); onSearch(); }
      }} />
      <SearchButton label={label} type={onSearch ? "button" : "submit"} onClick={onSearch} disabled={props.disabled} />
    </div>
  </div>;
}
