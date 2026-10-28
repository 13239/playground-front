"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect,useRef,useState,type CSSProperties } from "react";
import { Icon } from "@/components/ui/icon";
import { ProfileAvatar } from "@/features/profile/components/profile-avatar";
import { RoomDialog } from "@/features/gomoku/components/room-dialog";
import { memoryTabId } from "../client/api";
import { useMemoryRoom } from "../client/use-memory-room";
import { useMemorySound } from "../client/use-memory-sound";
import { useMemoryPrivacy } from "../client/use-memory-privacy";
import { formatTime,type Player } from "../contracts";
import { Character,CHARACTERS,preloadCharacters } from "./character";
import { MemoryAuth } from "./memory-auth";
import { MemoryInviteDialog } from "./memory-invite-dialog";
import { MemoryDialog, MemoryFriends } from "./memory-dialog";
import dialogStyles from "./memory-dialog.module.css";
import styles from "./memory.module.css";

/** 인증된 현재 참가자만 같은 화면에서 대기→최초 공개→플레이→결과→재대결을 진행한다. */
export function MemoryRoomScreen({roomId}:{roomId:number}){return <MemoryAuth>{sessionId=><Room key={`${sessionId}:${roomId}`} sessionId={sessionId} roomId={roomId}/>}</MemoryAuth>;}
function Room({sessionId,roomId}:{sessionId:string;roomId:number}){
  const router=useRouter();const {room,now,error,busy,action,reconnect}=useMemoryRoom(sessionId,roomId);const sound=useMemorySound();
  const playing=!!room&&["PREVIEW","PLAYING","MISMATCH"].includes(room.phase);
  const { boardRef, shielded, resume }=useMemoryPrivacy(playing);
  const [loaded,setLoaded]=useState(false),[assetError,setAssetError]=useState("");
  const [invite,setInvite]=useState(false),[leaving,setLeaving]=useState(false),[dismissed,setDismissed]=useState<string|null>(null);
  const [copied,setCopied]=useState(false);const [columns,setColumns]=useState(6);const layoutMatch=useRef<string|null>(null);
  const previous=useRef<{match:string|null;score:number;phase:string}|undefined>(undefined);
  useEffect(()=>{let disposed=false;void preloadCharacters().then(()=>{if(!disposed)setLoaded(true);}).catch(()=>{if(!disposed)setAssetError("캐릭터 이미지를 불러오지 못했어요. 연결을 확인하고 새로고침해 주세요.");});return()=>{disposed=true;};},[]);
  useEffect(()=>{
    if(!room?.matchId||layoutMatch.current===room.matchId)return;
    layoutMatch.current=room.matchId;
    // 카드 위치가 기억 정보이므로 한 판 중에는 창 크기 변경으로 열 수를 바꾸지 않는다.
    queueMicrotask(()=>setColumns(window.matchMedia("(max-width: 600px) and (orientation: portrait)").matches?5:6));
  },[room?.matchId]);
  useEffect(()=>{
    if(!room)return;const old=previous.current;previous.current={match:room.matchId,score:room.scoreOne+room.scoreTwo,phase:room.phase};
    if(!old||old.match!==room.matchId)return;
    if(room.phase==="FINISHED"&&old.phase!=="FINISHED")sound.play("finish");
    else if(room.scoreOne+room.scoreTwo>old.score)sound.play("match");
    else if(room.phase==="MISMATCH"&&old.phase!=="MISMATCH")sound.play("miss");
  },[room,sound]);
  if(!room)return <section className={styles.status}><h1>같은 그림 찾기</h1><p role="status">{error||"게임을 불러오는 중…"}</p>{error&&<button className={styles.secondary} onClick={reconnect}>다시 연결</button>}<Link href="/games/memory">목록으로</Link></section>;
  const preview=room.phase==="PREVIEW"&&room.startedAt!==null&&now<Date.parse(room.startedAt);
  const mismatchExpired=room.phase==="MISMATCH"&&room.deadline!==null&&now>=Date.parse(room.deadline);
  const previewExpired=room.phase==="PREVIEW"&&!preview;
  const turnExpired=!room.solo&&room.phase==="PLAYING"&&room.deadline!==null&&now>=Date.parse(room.deadline);
  const ready=room.seat===1?room.one.ready:room.two?.ready;
  const mine=room.solo||room.turn===room.seat;
  // 가림 중 선택·노출은 차단하지만 서버 시계와 최초 공개·턴 마감은 그대로 진행한다.
  const canFlip=loaded&&!busy&&!error&&!shielded&&!room.closed&&room.phase==="PLAYING"&&mine&&!turnExpired;
  const elapsed=room.startedAt?Math.max(0,(room.finishedAt?Date.parse(room.finishedAt):now)-Date.parse(room.startedAt)):0;
  const remaining=room.deadline?Math.max(0,(Date.parse(room.deadline)-now)/1000):10;
  const title=room.winner===0?"경기가 중단되었어요":room.solo?"15쌍 모두 찾았어요!":room.winner===room.seat?"승리!":"패배";
  const me=room.seat===1?room.one:room.two;const done=room.phase==="FINISHED";
  const status=room.closed&&!done?"종료된 방이에요":room.phase==="WAITING"?room.two?"두 사람 모두 준비하면 시작해요":"친구를 초대하거나 참여코드를 알려주세요"
    :preview?`전체 공개 · ${Math.min(3,Math.ceil((Date.parse(room.startedAt!)-now)/1000))}초 동안 기억하세요`
    :done?title:room.phase==="MISMATCH"?"다른 그림이에요. 잠시 후 카드가 덮여요":room.solo?"같은 그림 두 장을 찾아보세요":mine?"내 차례예요. 카드 두 장을 선택하세요":"상대가 고르고 있어요";
  async function leave(){const result=await action("leave");if(result&&(result.closed||result.seat===0)){router.push("/games/memory");}else setLeaving(false);}
  async function copy(){try{await navigator.clipboard.writeText(room!.code);setCopied(true);setTimeout(()=>setCopied(false),2000);}catch{setCopied(false);}}
  function flip(position:number){if(!canFlip)return;sound.unlock();sound.play("flip");void action("flip",{position});}
  const endActions=<div className={styles.actions}>{!room.solo&&!room.closed&&room.two&&<button className={styles.primary} disabled={busy||!!me?.rematch} onClick={()=>{sound.unlock();void action("rematch");}}>{me?.rematch?"상대의 재대결을 기다리고 있어요":"재대결"}</button>}<button className={styles.secondary} disabled={busy} onClick={()=>void leave()}>나가기</button></div>;
  return <div className={styles.room}>
    <header className={styles.gameHeading}><div><span className={styles.eyebrow}>{room.solo?"1인 기록 도전":"2인 대전 · 단판"}</span><h1>{room.solo?"같은 그림 찾기":room.title}</h1></div><button className={styles.secondary} aria-pressed={sound.enabled} onClick={sound.toggle}>효과음 {sound.enabled?"켜짐":"꺼짐"}</button></header>
    {(error||assetError)&&<p className={styles.error} role="alert">{error||assetError}<button onClick={reconnect}>다시 연결</button></p>}
    <div className={styles.gameLayout}>
      <aside className={styles.players} aria-label="참가자" data-solo={room.solo}>
        <PlayerCard player={room.one} score={room.scoreOne} active={playing&&!preview&&room.turn===1&&!room.solo} solo={room.solo}/>
        {!room.solo&&(room.two?<PlayerCard player={room.two} score={room.scoreTwo} active={playing&&!preview&&room.turn===2} solo={false}/>:<div className={styles.emptyPlayer}><Icon name="userPlus"/><strong>친구를 기다리고 있어요</strong><span>함께 기억력을 겨뤄 보세요</span></div>)}
        {room.solo?<div className={styles.info}><span>플레이 시간</span><strong className={styles.time}>{formatTime(elapsed)}</strong><span>시도 {room.attempts}회 · 찾은 그림 {room.scoreOne}/15</span></div>
          :<div className={styles.info}><span>{preview?"기억하는 시간":"차례 제한 시간"}</span><strong className={styles.time}>{preview?Math.min(3,Math.ceil(remaining)):done||room.phase==="WAITING"?"10":Math.ceil(remaining)}<small>초</small></strong><div className={styles.timerTrack}><span style={{width:`${preview?remaining/3*100:remaining*10}%`}}/></div><span>정답을 맞추면 다시 10초!</span></div>}
      </aside>
      <section className={styles.boardPanel} aria-label="카드 게임">
        <div className={styles.boardStatus} role="status"><span data-active={preview}>{status}</span><strong>{room.scoreOne+room.scoreTwo}<small> / 15쌍</small></strong></div>
        {room.phase==="WAITING"?<div className={styles.waitingArtwork}><Character index={0}/><Character index={1}/><Character index={3}/><p>처음 3초, 친구들의 위치를 기억하세요.</p></div>
          :<div ref={boardRef} className={styles.protectedBoard} data-shielded={playing&&shielded}
            onContextMenu={event=>event.preventDefault()} onCopy={event=>event.preventDefault()} onDragStart={event=>event.preventDefault()}>
            <div className={styles.boardScroll}><div className={styles.board} data-columns={columns} style={{"--columns":columns} as CSSProperties} aria-label="30장 카드판" inert={playing&&shielded}>
            {room.cards.map((card,position)=>{
              const matched=room.owners[position]!=="0";
              const visible=card>=0&&!(playing&&shielded)&&(matched||(!previewExpired&&!mismatchExpired));
              return <button key={position} type="button" className={styles.card} data-hover-frame data-open={visible} data-matched={matched} data-owner={room.owners[position]}
                disabled={!canFlip||visible||matched} aria-label={`${position+1}번 카드${visible?`: ${CHARACTERS[card]}`:""}${matched?", 맞춘 카드":""}`} onClick={()=>flip(position)}>
                {visible?<Character index={card}/>:<span className={styles.cardBack} aria-hidden>✦</span>}
                {matched&&<span className={styles.matchMark} aria-hidden>✓</span>}
              </button>;
            })}
          </div></div>
          {playing&&shielded&&<div className={styles.privacyCurtain} role="status"><Icon name="eye"/><strong>카드를 잠시 가렸어요</strong><p>게임 화면으로 돌아오면 다시 볼 수 있어요.<br/>게임 시간은 계속 흐르고 있어요.</p><button type="button" className={styles.secondary} onClick={resume}>카드 다시 보기</button></div>}
          </div>}
        <div className={styles.gameActions}>
          {done?endActions:room.phase==="WAITING"?<div className={styles.actions}><button className={styles.primary} disabled={busy||!loaded||!room.two||room.closed} onClick={()=>{sound.unlock();void action("ready",{ready:!ready});}}>{!loaded?"이미지 준비 중…":ready?"준비 취소":"준비"}</button><button className={styles.secondary} disabled={busy} onClick={()=>setLeaving(true)}>나가기</button></div>
            :<button className={styles.textButton} disabled={busy} onClick={()=>setLeaving(true)}>기권하고 나가기</button>}
        </div>
      </section>
      {!room.solo&&room.phase==="WAITING"&&<aside className={`${styles.panel} ${styles.roomDetails}`}><h2>친구와 함께하기</h2><p>참여코드</p><div className={styles.roomCode}><strong>{room.code}</strong><button className={styles.secondary} onClick={()=>void copy()}>{copied?"복사했어요":"복사"}</button></div><p className={styles.hint}>{room.privateRoom?"비공개방 · 코드 참가 시 비밀번호가 필요해요":"공개방 · 참여코드로 바로 참가할 수 있어요"}</p>
        {room.seat===1&&!room.two&&!room.closed&&<button className={styles.primary} onClick={()=>setInvite(true)}><Icon name="userPlus"/>친구 초대</button>}
        <div className={styles.rules}><strong>게임 규칙</strong><p>처음 3초간 전체 카드 공개</p><p>오답은 1초 후 다시 덮기</p><p>정답이면 내 차례 유지</p><p>더 많은 쌍을 찾으면 승리</p></div></aside>}
    </div>
    {invite&&<MemoryInviteDialog roomId={roomId} pageId={memoryTabId()} sessionId={sessionId} onClose={()=>setInvite(false)}/>}
    {/* 캐릭터형 B안은 계속하기를 주 동작으로 두고 실제 기권·기록 규칙을 안내한다. */}
    {leaving&&<MemoryDialog title={playing?"게임에서 나갈까요?":"방에서 나갈까요?"} illustration={<MemoryFriends/>}
      description={playing?room.solo?"진행 중인 기록은 랭킹에 등록되지 않아요.":"지금 나가면 패배로 기록돼요.":"게임 목록으로 돌아가요."}
      onClose={()=>setLeaving(false)} busy={busy}><div className={dialogStyles.leaveActions}><button className={`${styles.primary} ${dialogStyles.submit}`} disabled={busy} onClick={()=>setLeaving(false)}>계속하기</button><button className={styles.secondary} disabled={busy} onClick={()=>void leave()}>{busy?"나가는 중…":"나가기"}</button></div></MemoryDialog>}
    {done&&dismissed!==room.matchId&&<RoomDialog title={title} onClose={()=>setDismissed(room.matchId)} busy={busy}><div className={styles.result}><Character index={room.winner===room.seat?11:12}/><strong>{room.solo?formatTime(elapsed):`${room.scoreOne} : ${room.scoreTwo}`}</strong><p>{room.solo?room.finishReason==="COMPLETE"?`15쌍 완료 · ${room.attempts}회 시도 · 기록이 저장되었어요`:"중도 종료한 기록은 등록되지 않아요":room.winner===0?"중단된 경기는 전적에 반영하지 않아요":room.finishReason==="DISCONNECT"?"연결 종료로 경기가 끝났어요":"경기가 끝났어요"}</p></div>{endActions}</RoomDialog>}
  </div>;
}
function PlayerCard({player,score,active,solo}:{player:Player;score:number;active:boolean;solo:boolean}){
  return <div className={styles.player} data-active={active}><ProfileAvatar avatarId={player.avatarId} size={56}/><div><strong>{player.nickname}{player.self&&<small>나</small>}</strong><span>{solo?"1인 기록 도전":`${player.wins}승 ${player.losses}패`}</span></div><b>{score}<small>쌍</small></b>{!solo&&<p>{active?"지금 차례":player.ready?"준비 완료":""}</p>}</div>;
}
