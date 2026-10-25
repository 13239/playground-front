"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LobbyIcon } from "@/app/_components/lobby/lobby-icon";
import { aiDifficulties, aiRules, RENJU_DESCRIPTION, type AiDifficulty, type AiRule } from "../ai/contracts";
import { RoomDialog } from "./room-dialog";
import shared from "./gomoku.module.css";
import styles from "./ai-difficulty-dialog.module.css";
import { useGomokuCatalog } from "../client/use-gomoku-catalog";

/** 확정 시안의 난이도 카드 다음에 규칙을 선택하고 방 생성 없이 해당 AI 대국으로 이동한다. */
export function AiDifficultyDialog({ onClose }: { onClose: () => void }) {
  const { ai } = useGomokuCatalog();
  const [difficulty, setDifficulty] = useState<AiDifficulty>("normal");
  const [rule, setRule] = useState<AiRule>("freestyle");
  const [step, setStep] = useState<"difficulty" | "rule">("difficulty");
  const [starting, startTransition] = useTransition();
  const name = useId();
  const router = useRouter();
  function start() {
    if (starting || !ai.available) return;
    // 이동 완료·실패는 라우터 전환 상태를 따르므로 실패한 뒤에도 닫기와 재시도를 할 수 있다.
    startTransition(() => router.push(`/games/gomoku/ai?difficulty=${difficulty}&rule=${rule}`));
  }
  return <RoomDialog title={step === "difficulty" ? "난이도를 선택해 주세요" : "규칙을 선택해 주세요"} onClose={onClose} busy={starting} className={styles.dialog}>
    {/* 모드명은 관리 정보를 사용하고 선택 중 점검으로 바뀌면 새 실행만 막는다. */}
    <p>{ai.mode?.name ?? "게임 모드"}</p>
    {!ai.available && <p role="status">{ai.message}</p>}
    {step === "difficulty" ? <fieldset className={styles.options} aria-label="난이도" disabled={starting}>
      {(["normal", "hard"] as const).map(level => <label key={level} className={styles.option} data-selected={difficulty === level} data-hover-frame>
        <input type="radio" name={name} value={level} checked={difficulty === level} onChange={() => setDifficulty(level)} />
        <span className={styles.symbol} data-difficulty={level}><LobbyIcon name={level === "normal" ? "swords" : "flame"} /></span>
        <span className={styles.name}>{aiDifficulties[level].label}</span>
      </label>)}
    </fieldset> : <fieldset className={`${styles.options} ${styles.ruleOptions}`} aria-label="대국 규칙" disabled={starting}>
      {(["freestyle", "renju"] as const).map(value => <label key={value} className={`${styles.option} ${styles.ruleOption}`} data-selected={rule === value} data-hover-frame>
        <input type="radio" name={`${name}-rule`} value={value} checked={rule === value} onChange={() => setRule(value)} aria-describedby={value === "renju" ? `${name}-renju-description` : undefined} />
        <span className={styles.symbol}><LobbyIcon name={value === "freestyle" ? "board" : "scale"} /></span>
        <span className={styles.ruleContent}><span className={styles.name}>{aiRules[value].label}</span>
          {value === "renju" && <span id={`${name}-renju-description`} className={styles.description}>{RENJU_DESCRIPTION}</span>}
        </span>
      </label>)}
    </fieldset>}
    <div className={`${shared.actions} ${styles.actions}`}>
      <button type="button" className={shared.secondaryButton} disabled={starting} onClick={() => step === "difficulty" ? onClose() : setStep("difficulty")}>{step === "difficulty" ? "취소" : "이전"}</button>
      <button type="button" className={shared.primaryButton} disabled={starting || !ai.available} onClick={() => step === "difficulty" ? setStep("rule") : start()}>
        <LobbyIcon name="chevron" />{starting ? "시작하는 중…" : step === "difficulty" ? "다음" : "게임 시작"}
      </button>
    </div>
  </RoomDialog>;
}
