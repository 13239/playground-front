"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { useAuthSession,revalidateAuthSession } from "@/features/auth/client/session-store";
import styles from "./memory.module.css";

/** 인증 확인 중이나 계정 전환 시 이전 판·랭킹을 즉시 숨긴다. */
export function MemoryAuth({children}:{children:(sessionId:string)=>ReactNode}){
  const auth=useAuthSession();
  if(auth.status==="authenticated")return <div key={auth.session.sessionId}>{children(auth.session.sessionId)}</div>;
  return <section className={styles.status}><h1>같은 그림 찾기</h1><p role="status">{auth.status==="anonymous"?"로그인 후 게임을 즐겨 주세요.":auth.status==="error"?auth.message:"로그인 상태를 확인하고 있어요."}</p>
    {auth.status==="anonymous"?<Link href="/login">로그인하기</Link>:auth.status==="error"?<button onClick={revalidateAuthSession}>다시 확인</button>:null}</section>;
}
