"use client";

import { useId } from "react";
import { Select, type SelectOption } from "@/components/ui/select";
import { useUserRoleOptions } from "../client/use-user-role-options";
import styles from "./admin.module.css";

const ALL_ROLES: SelectOption = { value: "", label: "전체 권한" };

/** 권한 조회만 연결하고 단일 선택·팝업·키보드 동작은 검색 입력이 없는 공통 Select를 재사용한다. */
export function UserRoleFilter({ selected, change }: { selected?: SelectOption; change: (option: SelectOption | undefined) => void }) {
  const errorId = useId();
  const options = useUserRoleOptions();
  const { error, loading } = options;
  const choices: readonly SelectOption[] = [
    { ...ALL_ROLES, label: loading && !selected ? "권한 불러오는 중…" : ALL_ROLES.label },
    // 재조회 중에도 선택 이름을 유지하고 서버에서 받은 최신 이름이 있으면 함께 사용한다.
    ...(selected && !options.items.some(role => role.code === selected.value) ? [selected] : []),
    ...options.items.map(role => ({ value: role.code, label: role.name, description: role.code })),
  ];

  return <div className={styles.userFilter}>
    <Select label="권한" value={selected?.value ?? ""} options={choices} disabled={loading || !!error}
      aria-describedby={error ? errorId : undefined} onValueChange={value => {
        // 전체 권한을 고르면 API 필터를 제거하고 같은 권한을 다시 고를 때는 목록 페이지를 유지한다.
        if ((selected?.value ?? "") !== value) change(value ? choices.find(option => option.value === value) : undefined);
      }} />
    {error && <p id={errorId} className={styles.error} role="alert">{error} <button type="button" onClick={options.retry}>다시 불러오기</button></p>}
  </div>;
}
