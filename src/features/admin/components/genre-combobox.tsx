"use client";

import { useState } from "react";
import { Combobox } from "@/components/ui/combobox";
import { MAX_GAME_GENRES, type GenreOption } from "../genre-options-contracts";
import { useGenreOptions } from "../client/use-genre-options";
import styles from "./genre-combobox.module.css";

/** 검색 입력·선택 라벨·키보드·팝업은 공통 다중 콤보박스를 사용하고 장르 조회·저장 계약만 연결한다. */
export function GenreCombobox({ selected, change, disabled = false }: { selected: readonly GenreOption[]; change: (genres: readonly GenreOption[]) => void; disabled?: boolean }) {
  const [state, setState] = useState({ open: false, revision: 0 });
  const [search, setSearch] = useState("");
  const options = useGenreOptions(state.open && !disabled, search, state.revision);
  const item = (genre: GenreOption) => ({ value: genre.code, label: genre.name, description: genre.code, disabled: !genre.enabled });
  return <Combobox className={styles.root} label="장르" placeholder="이름 또는 코드로 장르 검색" disabled={disabled} maxSelections={MAX_GAME_GENRES}
    options={options.items.map(item)} selected={selected.map(item)} query={search} onQueryChange={setSearch} open={state.open}
    onOpenChange={open => setState(current => current.open === open ? current : { open, revision: current.revision + (open ? 1 : 0) })}
    onSelectionChange={items => change(items.map(option => ({ code: option.value, name: option.label, enabled: !option.disabled })))}
    loading={options.loading} error={options.error} onRetry={options.retry} hasMore={options.hasMore} moreBusy={options.moreBusy} moreError={options.moreError} onLoadMore={() => void options.loadMore()} />;
}
