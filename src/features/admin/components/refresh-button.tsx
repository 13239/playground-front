"use client";

import { useState } from "react";
import { LobbyIcon } from "@/app/_components/lobby/lobby-icon";
import styles from "./admin.module.css";

/** 응답 속도와 관계없이 클릭마다 시계방향 한 바퀴를 표시하고 진행 중 중복 요청은 막는다. */
export function RefreshButton({ onRefresh, loading = false, label = "새로고침" }: {
  onRefresh: () => void; loading?: boolean; label?: string;
}) {
  const [turns, setTurns] = useState(0);
  return <button type="button" className={styles.iconButton} aria-label={label} title={label}
    aria-busy={loading} disabled={loading} onClick={() => { setTurns(value => value + 1); onRefresh(); }}>
    <span className={styles.refreshIcon} style={{ transform: `rotate(${turns * 360}deg)` }}><LobbyIcon name="refresh" /></span>
  </button>;
}
