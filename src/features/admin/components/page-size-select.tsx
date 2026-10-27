"use client";

import { Select } from "@/components/ui/select";
import { PAGE_SIZES } from "../pagination-contracts";
import styles from "./page-size-select.module.css";

/** 표시 개수도 전역 단일 선택 UI를 사용하며 기존 목록별 개수·첫 페이지 전환 계약을 유지한다. */
export function PageSizeSelect({ value, change, sizes = PAGE_SIZES, className = "" }: {
  value: number; change: (size: number) => void; sizes?: readonly number[]; className?: string;
}) {
  return <Select className={`${styles.root} ${className}`} label="페이지당 표시 개수" value={String(value)}
    onValueChange={next => change(Number(next))} options={sizes.map(size => ({ value: String(size), label: `${size}개씩` }))} />;
}
