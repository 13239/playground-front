"use client";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuthSession } from "@/features/auth/client/session-store";
import { SocialContext } from "./context";
import { SocialStore } from "./social-store";
import { SocialOverlayHost } from "./social-ui";
/** 페이지 셸보다 위에서 연결을 유지하되 로그인 세대가 바뀌면 이전 계정의 모든 메모리를 비운다. */
export function SocialProvider({children}:{children:ReactNode}){
  const [store]=useState(()=>new SocialStore());const auth=useAuthSession();const path=usePathname();
  const session=auth.status==="authenticated"?auth.session.sessionId:null;
  useEffect(()=>{if(session)store.start(session);else if(auth.status==="anonymous")store.stop();else store.suspend();},[store,session,auth.status]);
  useEffect(()=>()=>store.stop(),[store]);
  useEffect(()=>{if(path!=="/")store.floatFromHome();},[path,store]);
  return <SocialContext value={store}>{children}<SocialOverlayHost/></SocialContext>;
}

