"use client";

import {useEffect,useLayoutEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {useRouter} from "next/navigation";
import {Icon} from "@/components/ui/icon";
import {ProfileAvatar} from "@/features/profile/components/profile-avatar";
import {useSocial,useSocialStore} from "@/features/social/context";
import type {MemoryInvitation} from "@/features/social/contracts";
import {invitationRemaining} from "@/features/gomoku/invitation-contracts";
import styles from "@/features/gomoku/components/gomoku-invitation.module.css";

/** 표시 창의 타이머를 사용하되 실제 남은 시간은 서버 시각과 원본 문서의 단조 시계로 계산한다. */
export function useInvitationRemaining(invitation:MemoryInvitation|undefined,owner:Document|undefined){
  const state=useSocial();
  const [now,setNow]=useState(()=>performance.now());
  const invitationId=invitation?.id;
  useEffect(()=>{
    if(!invitationId||!owner?.defaultView)return;
    let disposed=false;
    const update=()=>{if(!disposed)setNow(performance.now());};
    queueMicrotask(update);
    const view=owner.defaultView;
    const timer=view.setInterval(update,200);
    owner.addEventListener("visibilitychange",update);view.addEventListener("focus",update);
    return()=>{disposed=true;view.clearInterval(timer);owner.removeEventListener("visibilitychange",update);view.removeEventListener("focus",update);};
  },[invitationId,owner]);
  return invitation?invitationRemaining(invitation.expiresAt,state.data?.serverTime,state.snapshotAt,now):0;
}

/** 모달·전체 화면·게임 팝업 안에서도 같은 수신 카드 한 벌만 표시하고 배경 게임의 포커스를 빼앗지 않는다. */
export function MemoryInvitationHost({owner}:{owner:Document}){
  const state=useSocial();
  const [dialog,setDialog]=useState<HTMLDialogElement|null>(null);
  useLayoutEffect(()=>{
    const update=()=>{
      const dialogs=[...owner.querySelectorAll<HTMLDialogElement>("dialog[open]")];
      const modal=dialogs.filter(item=>item.matches(":modal")).at(-1)??dialogs.at(-1)??null;
      setDialog(current=>current===modal?current:modal);
    };
    update();
    const observer=new MutationObserver(update);
    observer.observe(owner.body,{subtree:true,childList:true,attributes:true,attributeFilter:["open"]});
    return()=>observer.disconnect();
  },[owner]);
  const invitation=state.data?.memoryInvitations?.find(item=>item.target.publicId===state.data?.self.publicId);
  if(!state.authorized||!invitation)return null;
  const target=dialog?.isConnected&&dialog.ownerDocument===owner?dialog:owner.fullscreenElement??owner.body;
  return createPortal(<InvitationPrompt key={invitation.id} invitation={invitation} owner={owner}/>,target);
}

function InvitationPrompt({invitation,owner}:{invitation:MemoryInvitation;owner:Document}){
  const state=useSocial();const store=useSocialStore();const router=useRouter();
  const remaining=useInvitationRemaining(invitation,owner);
  const expired=useRef(false);
  useEffect(()=>{
    if(remaining>0||expired.current)return;
    expired.current=true;
    // 기한이 지난 카드는 즉시 숨기고 서버의 자동 거절 결과를 한 번 확인한다.
    void store.refresh(false);
  },[remaining,store]);
  const busy=state.gameInvitationBusy!==null;
  const error=state.gameInvitationError?.id===invitation.id?state.gameInvitationError.message:"";
  async function answer(action:"accept"|"reject"){
    if(remaining<=0||busy)return;
    const session=store.getSnapshot().sessionId;
    const roomId=await store.answerGameInvitation(invitation.id,action,"memory");
    // 수락 처리 도중 로그인·계정이 바뀌면 과거 계정의 방으로 이동하지 않는다.
    if(roomId&&session===store.getSnapshot().sessionId&&store.getSnapshot().authorized)router.push(`/games/memory/rooms/${roomId}`);
  }
  if(remaining<=0)return null;
  return <section className={styles.prompt} role="dialog" aria-modal="false" aria-label="같은 그림 찾기 친구 초대" data-social-ui>
    <div className={styles.heading}><h2><Icon name="board"/>같은 그림 찾기 초대</h2><span className={styles.countdown} aria-live="off">남은 시간 {Math.min(15,Math.ceil(remaining/1000))}초</span></div>
    <div className={styles.inviter}><span className={styles.avatar}><ProfileAvatar avatarId={invitation.inviter.avatarId} size={44}/></span><div className={styles.identity}><strong>{invitation.inviter.nickname}</strong><small>함께 같은 그림 찾기를 하자고 초대했어요.</small></div></div>
    <p className={styles.roomTitle}>{invitation.roomTitle}</p>
    <p className={styles.rules}>30장 · 15쌍 · 차례당 10초 · 최초 공개 3초</p>
    <div className={styles.track} role="progressbar" aria-label="초대 응답 남은 시간" aria-valuemin={0} aria-valuemax={15} aria-valuenow={Math.min(15,Math.ceil(remaining/1000))}><span style={{width:`${Math.min(100,remaining/150)}%`}}/></div>
    {error&&<p className={styles.error} role="alert">{error}</p>}
    <div className={styles.actions}><button type="button" className={styles.button} disabled={busy} onClick={()=>void answer("reject")}>거절</button><button type="button" className={`${styles.button} ${styles.primary}`} disabled={busy} onClick={()=>void answer("accept")}>{busy?"처리 중…":"수락"}</button></div>
    <p className={styles.hint}>15초 안에 응답하지 않으면 자동으로 거절돼요.</p>
  </section>;
}

