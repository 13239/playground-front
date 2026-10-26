"use client";

import { useState, type ReactNode } from "react";
import { SiteFooter } from "@/app/_components/lobby/site-footer";
import { SiteHeader } from "@/app/_components/lobby/site-header";
import lobby from "@/app/_components/lobby/lobby.module.css";
import { TetrisDialog } from "./tetris-dialog";
import styles from "./tetris.module.css";

/** 기존 사이트 헤더·계정을 재사용하고 게임별 크기 제한은 테트리스 본문 안에서만 적용한다. */
export function TetrisShell({
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
    <div className={`app-page ${lobby.screen} ${styles.screen}`} data-page-width="game">
      <a className={lobby.skipLink} href="#tetris-main">
        본문으로 건너뛰기
      </a>
      <SiteHeader account={account} onNotice={setNotice} />
      <main id="tetris-main" className={styles.main}>
        {children}
      </main>
      <SiteFooter />
      {notice && (
        <TetrisDialog title={notice.title} close={() => setNotice(undefined)}>
          <p>{notice.description}</p>
          <button
            className={styles.primary}
            onClick={() => setNotice(undefined)}
          >
            확인
          </button>
        </TetrisDialog>
      )}
    </div>
  );
}
