"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { AuthRequestError } from "@/features/auth/client/api";
import { revalidateAuthSession } from "@/features/auth/client/session-store";
import { admitGame } from "../client/admission";
import styles from "./game-entry-gate.module.css";

/** 로컬 렌더러를 만들기 전에 직접 주소 접근까지 현재 서버 정책을 확인한다. 진행 중에는 재검사로 판을 지우지 않는다. */
export function GameEntryGate({ game, mode, sessionId, children }: { game: string; mode: string; sessionId: string; children: ReactNode }) {
  const [attempt, setAttempt] = useState(0);
  const entry = `${game}:${mode}:${sessionId}`;
  const [state, setState] = useState<{ entry?: string; ready: boolean; message?: string }>({ ready: false });
  useEffect(() => {
    const controller = new AbortController();
    void admitGame(game, mode, sessionId, controller.signal).then(() => {
      if (!controller.signal.aborted) setState({ entry, ready: true });
    }).catch(error => {
      if (controller.signal.aborted) return;
      if (error instanceof AuthRequestError && error.status === 401) revalidateAuthSession();
      setState({ entry, ready: false, message: error instanceof AuthRequestError ? error.message : "게임 시작을 확인하지 못했습니다." });
    });
    return () => controller.abort();
  }, [game, mode, sessionId, entry, attempt]);
  // 부모가 key를 지정하지 않고 다른 모드/계정으로 바꿔도 이전 허용 결과로 새 렌더러를 열지 않는다.
  if (state.entry === entry && state.ready) return children;
  const message = state.entry === entry ? state.message : undefined;
  return <section className={styles.status} aria-busy={!message}>
    <h2>{message ? "게임을 시작할 수 없어요" : "게임 시작 확인 중"}</h2>
    <p role="status">{message ?? "잠시만 기다려 주세요."}</p>
    {message && <div>
      <button type="button" onClick={() => { setState({ entry, ready: false }); setAttempt(value => value + 1); }}>다시 확인</button>
      <Link href="/">게임 목록으로</Link>
    </div>}
  </section>;
}
