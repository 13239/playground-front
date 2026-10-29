"use client";
import { useState, type ReactNode } from "react";
import { SiteHeader } from "@/app/_components/lobby/site-header";
import { SiteFooter } from "@/app/_components/lobby/site-footer";
import { TetrisDialog } from "@/features/tetris/components/tetris-dialog";
import lobby from "@/app/_components/lobby/lobby.module.css";
import styles from "./shooting.module.css";

/** 공통 계정·메뉴를 유지하며 전투 영역만 실제 뷰포트에 맞춘다. */
export function ShootingShell({
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
    <div
      className={`app-page ${lobby.screen} ${styles.screen}`}
      data-page-width="game"
    >
      <a className={lobby.skipLink} href="#shooting-main">
        본문으로 건너뛰기
      </a>
      <SiteHeader account={account} onNotice={setNotice} />
      <main id="shooting-main" className={styles.main}>
        {children}
      </main>
      <SiteFooter />
      {notice && (
        <TetrisDialog title={notice.title} close={() => setNotice(undefined)}>
          <p>{notice.description}</p>
          <button onClick={() => setNotice(undefined)}>확인</button>
        </TetrisDialog>
      )}
    </div>
  );
}
