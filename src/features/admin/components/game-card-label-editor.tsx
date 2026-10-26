"use client";

import { useId } from "react";
import { MAX_GAME_CARD_LABELS, type CardLabelCode, type CardLabelOption } from "@/features/games/card-labels";
import styles from "./game-card-label-editor.module.css";

/** 실제 지원 조건에 맞는 DB 필터만 제공하고 같은 선택을 카드 표시와 홈 검색에 적용한다. */
export function GameCardLabelEditor({ options, selected, visibleCodes, disabled, onChange }: {
  options: readonly CardLabelOption[];
  selected: readonly CardLabelCode[];
  // 선택을 미리 저장할 수 있어도 홈 미리보기에는 현재 공개된 모드의 라벨만 포함한다.
  visibleCodes: readonly CardLabelCode[];
  disabled: boolean;
  onChange: (codes: readonly CardLabelCode[]) => void;
}) {
  const descriptionId = useId();
  const chosen = new Set(selected);
  const visible = new Set(visibleCodes);
  const preview = [...new Set(options.filter(option => chosen.has(option.code) && visible.has(option.code)).map(option => option.name))];
  function toggle(code: CardLabelCode, checked: boolean) {
    onChange(checked ? [...selected, code] : selected.filter(value => value !== code));
  }
  return <fieldset className={styles.editor} disabled={disabled} aria-describedby={descriptionId}>
    <legend>홈 카드 라벨</legend>
    <p id={descriptionId} className={styles.description}>선택한 라벨만 홈 게임 카드에 표시되고 해당 필터로 검색돼요. 그래픽·인원은 실제 지원하는 항목만 선택할 수 있어요.</p>
    {([["graphics", "그래픽"], ["genres", "장르"], ["players", "플레이 인원"]] as const).map(([group, name]) => {
      const choices = options.filter(option => option.group === group);
      return <fieldset key={group} className={styles.group}>
        <legend>{name}</legend>
        <div className={styles.options}>
          {choices.length ? choices.map(option => <label key={option.code} className={styles.choice}>
            <input type="checkbox" name="cardLabelCodes" value={option.code} checked={chosen.has(option.code)}
              disabled={disabled || !chosen.has(option.code) && selected.length >= MAX_GAME_CARD_LABELS}
              onChange={event => toggle(option.code, event.target.checked)} />
            <span>{option.name}</span>
          </label>) : <p className={styles.empty}>{group === "genres" ? "연결한 사용 중인 장르가 없어요." : "선택할 수 있는 항목이 없어요."}</p>}
        </div>
      </fieldset>;
    })}
    <div className={styles.previewHeading}><strong>라벨 미리보기</strong>
      <button type="button" disabled={disabled || selected.length === 0} onClick={() => onChange([])}>모두 해제</button>
    </div>
    <div className={styles.preview} role="status" aria-live="polite" aria-label="선택한 카드 라벨">
      {preview.length ? preview.map(name => <span key={name}>{name}</span>) : <p className={styles.empty}>현재 홈 카드에 표시할 라벨이 없어요.</p>}
    </div>
    {selected.some(code => !visible.has(code)) && <p className={styles.description}>공개되지 않은 모드의 라벨은 모드를 공개하면 표시돼요.</p>}
  </fieldset>;
}
