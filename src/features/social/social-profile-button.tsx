"use client";
import type { ReactNode } from "react";
import { useSocialStore } from "./context";
import styles from "./social.module.css";
import { uuid } from "./contracts";
/** 채팅·게임의 같은 공개 프로필 버튼이다. 팝업은 이미지·닉네임·주 동작 하나만 보여준다. */
export function SocialProfileButton({publicId,nickname,children,className="",disabled=false}:{publicId?:string;nickname:string;children:ReactNode;className?:string;disabled?:boolean}){
  const store=useSocialStore();
  return <button type="button" className={`${styles.profileTrigger} ${className}`} disabled={!publicId||!uuid.test(publicId)||disabled}
    aria-label={`${nickname} 프로필 보기`} aria-haspopup="dialog"
    onClick={event=>{event.stopPropagation();if(publicId)void store.showProfile(publicId,event.currentTarget);}}>{children}</button>;
}

