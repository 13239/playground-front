"use client";

import { useState,type ReactNode } from "react";
import { SiteHeader } from "@/app/_components/lobby/site-header";
import { SiteFooter } from "@/app/_components/lobby/site-footer";
import { RoomDialog } from "@/features/gomoku/components/room-dialog";
import lobby from "@/app/_components/lobby/lobby.module.css";
import styles from "./memory.module.css";

/** 사이트 공통 헤더·푸터·페이지 폭과 반응형 글꼴을 그대로 공유한다. */
export function MemoryShell({children,account}:{children:ReactNode;account:ReactNode}){
  const [notice,setNotice]=useState<{title:string;description:string}>();
  return <div className={`app-page ${lobby.screen} ${styles.screen}`} data-page-width="game">
    <a className={lobby.skipLink} href="#memory-main">본문으로 건너뛰기</a>
    <SiteHeader account={account} onNotice={setNotice}/><main id="memory-main" className={styles.main}>{children}</main><SiteFooter/>
    {notice&&<RoomDialog title={notice.title} onClose={()=>setNotice(undefined)}><p>{notice.description}</p><button className={styles.primary} onClick={()=>setNotice(undefined)}>확인</button></RoomDialog>}
  </div>;
}
