"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect,useRef,useState,type FormEvent } from "react";
import { Icon } from "@/components/ui/icon";
import { NumberedPagination } from "@/features/admin/components/numbered-pagination";
import { AuthRequestError } from "@/features/auth/client/api";
import { useGameDetails } from "@/features/games/components/game-catalog-provider";
import { catalogModeEntry } from "@/features/games/catalog-policy";
import { createUuidV4 } from "@/lib/client/uuid";
import { memoryOverview,memoryRequest } from "../client/api";
import { formatTime,type MemoryOverview } from "../contracts";
import { MemoryAuth } from "./memory-auth";
import { MemoryCover } from "./memory-cover";
import { Character, preloadCharacters } from "./character";
import { MemoryJoinDialog } from "./memory-join-dialog";
import { MemoryDialog, MemoryHostIllustration } from "./memory-dialog";
import dialogStyles from "./memory-dialog.module.css";
import lobby from "./memory-lobby.module.css";
import styles from "./memory.module.css";

/** 계정별 랭킹과 방을 읽고 게임 시작에서 1인·2인 방 생성으로 이어진다. */
export function MemoryLobby(){return <MemoryAuth>{sessionId=><Lobby key={sessionId} sessionId={sessionId}/>}</MemoryAuth>;}
function Lobby({sessionId}:{sessionId:string}){
  const router=useRouter();const catalog=useGameDetails();
  const solo=catalogModeEntry(catalog.game,"SINGLE",catalog.error),online=catalogModeEntry(catalog.game,"ONLINE",catalog.error);
  const [data,setData]=useState<MemoryOverview>();const [page,setPage]=useState(1),[roomPage,setRoomPage]=useState(1),[epoch,setEpoch]=useState(0);
  const [dialog,setDialog]=useState<"mode"|"create"|"password"|"code">();const [join,setJoin]=useState<{roomId?:number;code?:string}>();
  const [title,setTitle]=useState("함께 같은 그림 찾아요"),[privateRoom,setPrivate]=useState(false),[password,setPassword]=useState("");
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  const lock=useRef(false);const mounted=useRef(true);const request=useRef<{kind:string;id:string} | undefined>(undefined);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{
    const controller=new AbortController();
    async function load(){try{const v=await memoryOverview(sessionId,page,roomPage,controller.signal);if(!controller.signal.aborted)setData(v);}
      catch(e){if(!controller.signal.aborted)setError(e instanceof AuthRequestError?e.message:"게임 정보를 불러오지 못했어요.");}}
    void load();const timer=setInterval(()=>void load(),15000);
    return()=>{controller.abort();clearInterval(timer);};
  },[sessionId,page,roomPage,epoch]);
  async function enter(kind:"start"|"create"|"join",body:Record<string,unknown>={}){
    if(lock.current)return;lock.current=true;setBusy(true);setError("");
    if(request.current?.kind!==kind)request.current={kind,id:createUuidV4()};
    try{
      await preloadCharacters();
      const room=await memoryRequest(sessionId,kind,{...(kind!=="join"?{requestId:request.current.id}:{}),...body});
      if(mounted.current)router.push(`/games/memory/rooms/${room.roomId}`);
    }catch(e){
      if(mounted.current){setError(e instanceof AuthRequestError?e.message:"게임을 시작하지 못했어요.");
        if(kind==="join"&&e instanceof AuthRequestError&&["ROOM_PASSWORD_REQUIRED","ROOM_PASSWORD_INVALID"].includes(e.code??"")){setJoin(body);setPassword("");setDialog("password");}}
      if(e instanceof AuthRequestError&&e.status>0&&e.status<500)request.current=undefined;
    }finally{lock.current=false;if(mounted.current)setBusy(false);}
  }
  function joinRoom(roomId:number,locked:boolean){setError("");setPassword("");setJoin({roomId});if(locked)setDialog("password");else void enter("join",{roomId});}
  const submitCreate=(e:FormEvent)=>{e.preventDefault();void enter("create",{title:title.trim(),privateRoom,...(privateRoom?{password}:{})});};
  return <div className={lobby.lobby}>
    {error&&!dialog&&<p className={styles.error} role="alert">{error}<button onClick={()=>setEpoch(v=>v+1)}>다시 확인</button></p>}
    {/* A안의 가로형 소개와 하단 두 패널은 실제 가용 폭에 맞춰 함께 재배치한다. */}
    <section className={lobby.hero} aria-labelledby="memory-title">
      {/* 오목과 같은 배너 안 경로로 이동 위치를 보여 주고 별도 게임 목록 버튼은 두지 않는다. */}
      <nav className={lobby.breadcrumb} aria-label="현재 위치"><Link href="/">홈</Link><Icon name="chevronRight"/><Link href="/">게임</Link><Icon name="chevronRight"/><span aria-current="page">같은 그림 찾기</span></nav>
      <div className={lobby.heroBody}>
        <span className={lobby.eyebrow}>MEMORY MATCH</span>
        <h1 id="memory-title">{catalog.game?.name??"같은 그림 찾기"}</h1>
        <p className={lobby.summary}>{catalog.game?.summary??"귀여운 친구들을 기억하고 같은 그림을 찾아보세요."}</p>
        <div className={lobby.heroControls}>
          <button className={`${styles.primary} ${lobby.primary} ${lobby.start}`} disabled={busy||!solo.available&&!online.available} onClick={()=>{setError("");setDialog("mode");}}>
            <Icon name="gamepad"/>게임 시작<Icon name="chevronRight"/>
          </button>
          <div className={lobby.ruleChips} aria-label="게임 규칙">
            <div><Icon name="cards"/><span><strong>30장 · 15쌍</strong><small>같은 그림을 찾아요</small></span></div>
            <div><Icon name="eye"/><span><strong>처음 3초 공개</strong><small>그림을 기억해요</small></span></div>
            <div><Icon name="clock"/><span><strong>2인 차례당 10초</strong><small>정답이면 다시 10초</small></span></div>
          </div>
        </div>
        {data?.currentRoomId&&<Link className={lobby.resume} href={`/games/memory/rooms/${data.currentRoomId}`}>참여 중인 게임으로 돌아가기<Icon name="chevronRight"/></Link>}
        {!solo.available&&!online.available&&<p className={lobby.availability} role="status">{solo.message||online.message}</p>}
      </div>
      <div className={lobby.heroArt}><MemoryCover/></div>
    </section>
    <div className={lobby.panels}>
      <section className={lobby.panel} aria-labelledby="memory-rooms">
        <div className={lobby.panelHeader}>
          <div className={lobby.panelTitle}><Icon name="users"/><div><h2 id="memory-rooms">2인 대기방</h2><p>친구와 함께 같은 그림을 찾아보세요.</p></div></div>
          <div className={lobby.roomActions}>
            <button className={`${styles.secondary} ${lobby.secondary}`} disabled={busy||!online.available} onClick={()=>{setError("");setDialog("code");}}><Icon name="ticket"/>참여코드로 참가</button>
            <button className={`${styles.secondary} ${lobby.secondary}`} disabled={busy||!online.available} onClick={()=>{setError("");setDialog("create");}}><Icon name="plus"/>방 만들기</button>
          </div>
        </div>
        <div className={lobby.roomToolbar}><span>{data?`현재 페이지 ${data.rooms.length}개` : "대기방 확인 중"}</span><button className={lobby.refresh} disabled={busy} onClick={()=>setEpoch(v=>v+1)}><Icon name="refresh"/>새로고침</button></div>
        {!data?<p className={lobby.loading} role="status">대기방을 불러오는 중…</p>:data.rooms.length===0?<div className={lobby.emptyState}>
          <div className={lobby.emptyCards} aria-hidden><span><Character index={0}/></span><span><Character index={1}/></span></div>
          <h3>아직 대기 중인 방이 없어요.</h3><p>친구와 방을 만들고 함께 플레이해 보세요!</p>
        </div>:<div className={lobby.roomList}>{data.rooms.map(room=><div className={lobby.roomItem} key={room.roomId}>
          <span className={lobby.roomIcon}><Icon name={room.privateRoom?"lock":"users"}/></span><strong>{room.title}</strong><span>{room.players}/2</span>
          <button className={`${styles.secondary} ${lobby.secondary}`} disabled={busy||room.players===2||!online.available} onClick={()=>joinRoom(room.roomId,room.privateRoom)}>참가</button>
        </div>)}</div>}
        {data&&data.rooms.length>0&&<NumberedPagination page={data.roomPage} totalPages={data.roomPages} loading={busy} change={setRoomPage} label="대기방 페이지"/>}
      </section>
      <section className={`${lobby.panel} ${lobby.rankingPanel}`} aria-labelledby="memory-ranking">
        <div className={lobby.panelHeader}><div className={`${lobby.panelTitle} ${lobby.rankingTitle}`}><Icon name="trophy"/><div><h2 id="memory-ranking">1인 기록 랭킹</h2><p>혼자서 도전하고, 최고의 기록을 세워보세요.</p></div></div></div>
        <div className={lobby.personal}><span>내 최고 기록</span><strong>{data?.bestMillis==null?"—":formatTime(data.bestMillis)}</strong>{data?.rank&&<small>{data.rank.toLocaleString("ko-KR")}위</small>}</div>
        {!data?<p className={lobby.loading} role="status">랭킹을 불러오는 중…</p>:data.rankings.length===0?<div className={lobby.emptyState}>
          <div className={lobby.rankingMascot} aria-hidden><Character index={2}/><span><Icon name="trophy"/></span></div><h3>첫 기록의 주인공이 되어보세요.</h3><p>게임을 시작하고 나의 최고 기록을 남겨보세요!</p>
        </div>:<div className={styles.rankingWrap}><table className={styles.ranking}><thead><tr><th scope="col">순위</th><th scope="col">닉네임</th><th scope="col">기록</th><th scope="col">시도</th></tr></thead><tbody>{data.rankings.map((row,index)=><tr key={`${row.rank}:${index}`} data-self={row.self}><td>{row.rank}</td><td><span>{row.nickname}</span>{row.self&&<small>나</small>}</td><td>{formatTime(row.millis)}</td><td>{row.attempts}회</td></tr>)}</tbody></table></div>}
        {data&&data.rankings.length>0&&<NumberedPagination page={data.page} totalPages={data.totalPages} loading={busy} change={setPage} label="1인 랭킹 페이지"/>}
      </section>
    </div>
    {dialog==="code"&&<MemoryJoinDialog busy={busy} error={error} onClose={()=>{if(!busy){setDialog(undefined);setError("");}}} onEdit={()=>setError("")} onJoin={code=>void enter("join",{code})}/>}
    {dialog&&dialog!=="code"&&<MemoryDialog title={dialog==="mode"?"어떻게 플레이할까요?":dialog==="create"?"2인 대전 방 만들기":"비공개방 참가"}
      description={dialog==="mode"?"혼자 도전하거나 친구와 함께해요.":dialog==="create"?"친구와 함께할 방을 만들어보세요.":"방 비밀번호를 입력해 주세요."}
      illustration={dialog!=="mode"?<MemoryHostIllustration/>:undefined} wide={dialog==="mode"}
      onClose={()=>{if(!busy){setDialog(undefined);setError("");}}} busy={busy}>
      {error&&<p className={styles.error} role="alert">{error}</p>}
      {/* 선택창 A안은 카드 전체가 한 동작이며 닫기 버튼과 떨어진 캐릭터 영역을 제공한다. */}
      {dialog==="mode"?<div className={dialogStyles.modeChoices}>
        <button type="button" className={dialogStyles.modeCard} data-hover-frame disabled={busy||!solo.available} onClick={()=>void enter("start")}><span className={dialogStyles.characters}><Character index={0}/></span><strong>1인 기록 도전</strong><span>15쌍을 빠르게 찾아<br/>최고 기록에 도전해요.</span><b>혼자 시작하기<Icon name="chevronRight"/></b></button>
        <button type="button" className={dialogStyles.modeCard} data-hover-frame disabled={busy||!online.available} onClick={()=>{setError("");setDialog("create");}}><span className={dialogStyles.characters} data-pair="true"><Character index={1}/><Character index={3}/></span><strong>2인 대전</strong><span>방을 만들고 친구와<br/>기억력을 겨뤄요.</span><b>대전 방 만들기<Icon name="chevronRight"/></b></button>
      </div>
        :dialog==="create"?<form className={dialogStyles.form} onSubmit={submitCreate}>
          <label className={dialogStyles.field}>방 이름<input required disabled={busy} value={title} maxLength={30} onChange={e=>{setTitle(e.target.value);request.current=undefined;}}/></label>
          {/* 캐릭터형 B안: 공개 설정의 현재 상태와 비밀번호 필요 여부를 함께 보여 준다. */}
          <div className={dialogStyles.privacySetting}><span className={dialogStyles.privacyLabel}><Icon name="lock"/><span><strong>비공개방</strong><small>{privateRoom?"비밀번호로 방을 보호해요.":"누구나 목록에서 참가할 수 있어요."}</small></span></span><button type="button" role="switch" aria-label="비공개방" aria-checked={privateRoom} disabled={busy} className={dialogStyles.switch} onClick={()=>{setPrivate(v=>!v);setPassword("");request.current=undefined;}}><span/></button></div>
          {privateRoom&&<label className={dialogStyles.field}>비밀번호<input type="password" required disabled={busy} minLength={4} maxLength={64} placeholder="4자 이상 입력" autoComplete="new-password" value={password} onChange={e=>{setPassword(e.target.value);request.current=undefined;}}/></label>}
          <button type="submit" className={`${styles.primary} ${dialogStyles.submit}`} disabled={busy}>{busy?"만드는 중…":"방 만들기"}</button>
          <button type="button" className={dialogStyles.cancel} disabled={busy} onClick={()=>{setDialog(undefined);setError("");}}>취소</button>
        </form>
        :<form className={dialogStyles.form} onSubmit={e=>{e.preventDefault();void enter("join",{...join,password});}}><label className={dialogStyles.field}>방 비밀번호<input type="password" required disabled={busy} maxLength={64} autoComplete="off" value={password} onChange={e=>setPassword(e.target.value)}/></label><button type="submit" className={`${styles.primary} ${dialogStyles.submit}`} disabled={busy}>{busy?"참가 중…":"참가"}</button></form>}
    </MemoryDialog>}
  </div>;
}


