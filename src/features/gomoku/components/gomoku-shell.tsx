"use client";

import { useState, type ReactNode } from "react";
import { SiteHeader } from "@/app/_components/lobby/site-header";
import lobby from "@/app/_components/lobby/lobby.module.css";
import { RoomDialog } from "./room-dialog";
import styles from "./gomoku.module.css";

/** 공개 화면 틀과 인증 계정 영역을 분리하며 목록·생성 화면이 같은 헤더와 전체 폭 푸터를 공유한다. */
export function GomokuShell({
  children,
  account,
}: {
  children: ReactNode;
  account: ReactNode;
}) {
  const [notice, setNotice] = useState<{
    title: string;
    description: string;
  }>();
  return (
    <div className={`${lobby.screen} ${styles.screen}`}>
      <a className={lobby.skipLink} href="#gomoku-main">
        본문으로 건너뛰기
      </a>
      <SiteHeader account={account} onNotice={setNotice} />
      <main id="gomoku-main" className={styles.main}>
        {children}
      </main>
      <footer className={styles.footer}>
        <strong>Playground</strong>
        <span>함께라서 더 즐거운 우리들의 놀이터.</span>
        <small>© {new Date().getFullYear()} Playground</small>
      </footer>
      {notice && (
        <RoomDialog title={notice.title} onClose={() => setNotice(undefined)}>
          <p>{notice.description}</p>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => setNotice(undefined)}
            >
              확인
            </button>
          </div>
        </RoomDialog>
      )}
    </div>
  );
}
