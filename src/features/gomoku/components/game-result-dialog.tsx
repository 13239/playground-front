"use client";

import Image from "next/image";
import { useEffect, useId, useRef } from "react";
import { LobbyIcon } from "@/app/_components/lobby/lobby-icon";
import { showModalWithoutCloseFocus } from "@/lib/client/show-modal";
import styles from "./game-room.module.css";

/** 시안의 귀여운 캐릭터 팝업을 승리·패배에 공통 적용한다. 문구·버튼은 이미지와 분리해 선명하게 제공한다. */
export function GameResultDialog({ result, reason, rematchRequested, pending, onRematch, onLeave, onDismiss }: {
  result: "victory" | "defeat" | "draw"; reason: string; rematchRequested: boolean; pending: boolean;
  onRematch: () => void; onLeave: () => void; onDismiss: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const title = useId();
  useEffect(() => showModalWithoutCloseFocus(ref.current), []);
  return <dialog ref={ref} className={styles.resultDialog} aria-labelledby={title} onClose={onDismiss}>
    <button type="button" className={styles.resultClose} aria-label="결과 닫기" onClick={onDismiss}><LobbyIcon name="close" /></button>
    <Image className={styles.resultMascot} src={`/images/gomoku/result-${result === "defeat" ? "defeat" : "victory"}.png`}
      width={720} height={405} sizes="(max-width: 600px) 80vw, 400px" alt={result === "victory" ? "두 팔을 들고 기뻐하는 하얀 캐릭터" : result === "defeat" ? "아쉬워하며 엎드린 하얀 캐릭터" : "응원하는 하얀 캐릭터"} />
    <h2 id={title}>{result === "victory" ? "승리!" : result === "defeat" ? "패배" : "무승부"}</h2>
    <p>{result === "victory" ? "멋진 대국이었어요! 한 판 더 도전해볼까요?" : result === "defeat" ? "다음 판에서 다시 도전해보세요." : "두 분 모두 수고했어요. 다시 도전해볼까요?"}</p>
    <small>{reason}</small>
    <div className={styles.resultActions}>
      <button type="button" className={styles.primaryButton} disabled={pending || rematchRequested} onClick={onRematch}>
        <LobbyIcon name="undo" />{rematchRequested ? "상대 기다리는 중…" : "다시하기"}</button>
      <button type="button" className={styles.secondaryButton} disabled={pending} onClick={onLeave}><LobbyIcon name="exit" />나가기</button>
    </div>
  </dialog>;
}
