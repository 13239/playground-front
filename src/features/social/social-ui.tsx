"use client";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/ui/icon";
import { SearchInput } from "@/components/ui/search-input";
import { ProfileAvatar } from "@/features/profile/components/profile-avatar";
import { getGamePopup, subscribeToGamePopup } from "@/features/games/client/game-popup";
import { useSocial, useSocialStore } from "./context";
import { SocialProfileButton } from "./social-profile-button";
import { isRoom, type Page, type Person } from "./contracts";
import styles from "./social.module.css";

const badge=(n:number)=>n>99?"99+":n.toLocaleString("ko-KR");
const subscribeHydration=()=>()=>{};

/** 현재 게임 문서의 전체 화면 전환을 구독하고 기존 게임 툴바 자리에 공통 버튼을 표시한다. */
function subscribeFullscreen(listener:()=>void){
  let documents:Document[]=[];
  const bind=()=>{documents.forEach(doc=>doc.removeEventListener("fullscreenchange",listener));documents=[document,...(getGamePopup()?[getGamePopup()!.document]:[])];documents.forEach(doc=>doc.addEventListener("fullscreenchange",listener));};
  bind();const stop=subscribeToGamePopup(()=>{bind();listener();});return()=>{stop();documents.forEach(doc=>doc.removeEventListener("fullscreenchange",listener));};
}
function fullscreenSnapshot(){return typeof document!=="undefined"&&!!(getGamePopup()?.document??document).fullscreenElement;}
export function SocialGameActions({popup=false}:{popup?:boolean}){
  const full=useSyncExternalStore(subscribeFullscreen,fullscreenSnapshot,()=>false);
  return popup||full?<SocialHeaderActions/>:null;
}

function ago(value:string){const elapsed=Math.max(0,Date.now()-Date.parse(value));return elapsed<60000?"방금":elapsed<3600000?`${Math.floor(elapsed/60000)}분 전`:elapsed<86400000?`${Math.floor(elapsed/3600000)}시간 전`:new Date(value).toLocaleDateString("ko-KR",{month:"short",day:"numeric"});}
function micros(value:string){const fraction=(value.split(".")[1]??"").split("Z")[0];return Date.parse(value)*1000+Number(fraction.padEnd(6,"0").slice(3,6));}
function Avatar({person,size=40}:{person:Pick<Person,"avatarId"|"nickname">;size?:number}){return <span className={styles.avatar}><ProfileAvatar avatarId={person.avatarId} size={size}/></span>;}
/** 헤더에는 아이콘과 배지만 표시한다. 친구 문구는 시각적으로 추가하지 않고 접근 가능한 이름으로 제공한다. */
export function SocialHeaderActions(){
  const state=useSocial();const store=useSocialStore();
  if(!state.sessionId||!state.authorized)return null;
  const unread=Object.values(state.summaries).reduce((sum,s)=>sum+s.unread,0);
  const launch=(surface:"friends"|"notifications",source:Document)=>{const target=getGamePopup()?.document??source;target.defaultView?.focus();store.launch(surface,target);};
  return <div className={styles.headerActions} data-social-ui data-social-header-actions>
    <button type="button" data-social-launcher className={styles.headerButton} data-active={state.surface==="friends"} title="친구 및 대화"
      aria-label={`친구 및 대화${unread?`, 안 읽은 메시지 ${unread}개`:""}`} aria-expanded={state.surface==="friends"}
      onClick={event=>launch("friends",event.currentTarget.ownerDocument)}><Icon name="users"/>{unread>0&&<span className={styles.badge}>{badge(unread)}</span>}</button>
    <button type="button" className={styles.headerButton} data-active={state.surface==="notifications"} title="알림"
      aria-label={`알림${state.data?.unreadNotifications?`, 안 읽은 알림 ${state.data.unreadNotifications}개`:""}`} aria-expanded={state.surface==="notifications"}
      onClick={event=>launch("notifications",event.currentTarget.ownerDocument)}><Icon name="bell"/>{!!state.data?.unreadNotifications&&<span className={styles.badge}>{badge(state.data.unreadNotifications)}</span>}</button>
  </div>;
}
/** 모든 새 목록의 페이지 이동은 처음/이전/번호/다음/마지막을 제공한다. */
function Pagination({value,onChange,label}:{value:Pick<Page<unknown>,"total"|"page"|"pageSize">;onChange:(page:number)=>void;label:string}){
  const pages=Math.max(1,Math.ceil(value.total/value.pageSize));if(pages<=1)return null;
  const current=Math.min(value.page,pages);const start=Math.max(1,Math.min(current-2,pages-4));const numbers=Array.from({length:Math.min(5,pages)},(_,i)=>start+i);
  return <nav className={styles.pagination} aria-label={label}>
    <button type="button" aria-label="첫 페이지" disabled={current===1} onClick={()=>onChange(1)}>«</button>
    <button type="button" aria-label="이전 페이지" disabled={current===1} onClick={()=>onChange(current-1)}>‹</button>
    {numbers.map(p=><button type="button" key={p} aria-label={`${p}페이지`} aria-current={p===current?"page":undefined} onClick={()=>onChange(p)}>{p}</button>)}
    <button type="button" aria-label="다음 페이지" disabled={current===pages} onClick={()=>onChange(current+1)}>›</button>
    <button type="button" aria-label="마지막 페이지" disabled={current===pages} onClick={()=>onChange(pages)}>»</button>
  </nav>;
}
function FriendsList(){
  const s=useSocial();const store=useSocialStore();const [search,setSearch]=useState(s.pages.search);
  const friends=s.data?.friends;
  return <div className={styles.scroll}>
    <div className={styles.sectionTitle}><h3>친구 <span>{friends?.total??0}</span></h3><button type="button" className={`${styles.secondary} ${styles.requestButton}`} onClick={()=>store.requests()}><Icon name="userPlus"/>요청{!!s.data?.received.total&&<span className={styles.count}>{badge(s.data.received.total)}</span>}<Icon name="chevronRight"/></button></div>
    <SearchInput label="친구 검색" placeholder="친구 검색" value={search} onChange={e=>setSearch(e.target.value)} maxLength={50} onSearch={()=>store.search(search)}/>
    {friends?.total===0&&<p className={styles.empty}>{s.pages.search?"검색한 친구가 없어요.":"전체 채팅이나 함께한 게임에서 친구를 추가해 보세요."}</p>}
    {[true,false].map(online=>{
      const people=friends?.items.filter(p=>!!p.online===online)??[];if(!people.length)return null;
      return <section key={String(online)} className={styles.section}><h4>{online?"온라인":"오프라인"}</h4>
        {people.map(person=><div key={person.publicId} className={styles.personRow}>
          <SocialProfileButton publicId={person.publicId} nickname={person.nickname}><Avatar person={person}/></SocialProfileButton>
          <div className={styles.identity}><strong title={person.nickname}>{person.nickname}</strong><small data-online={online}><i/>{online?"온라인":"오프라인"}</small></div>
          <button type="button" className={styles.secondary} disabled={!!s.busy} onClick={()=>void store.openDirect(person)} aria-label={`${person.nickname}님과 대화`}><Icon name="chat"/><span>대화</span></button>
          <details className={styles.menu}><summary aria-label={`${person.nickname} 친구 관리`}>⋮</summary><div>
            <button type="button" disabled={!!s.busy} onClick={()=>void store.command("friend-remove",{targetId:person.publicId},person.publicId)}>친구 삭제</button>
            <button type="button" disabled={!!s.busy} onClick={()=>void store.command("block",{targetId:person.publicId},person.publicId)}>차단</button>
          </div></details>
        </div>)}
      </section>;
    })}
    {friends&&<Pagination value={friends} label="친구 목록 페이지" onChange={page=>store.setPage("friendPage",page)}/>}
  </div>;
}
/** 확정 A안: 받은 요청과 보낸 요청을 한 화면에서 분리해 표시한다. */
function Requests(){
  const s=useSocial();const store=useSocialStore();const rowRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(s.highlight)rowRef.current?.querySelector<HTMLElement>('[data-highlight="true"]')?.scrollIntoView({block:"nearest"});},[s.highlight,s.data]);
  return <div className={styles.scroll} ref={rowRef}>
    <div className={styles.backHeading}><button type="button" className={styles.icon} aria-label="친구 목록으로" onClick={()=>store.view("list")}><Icon name="arrowLeft"/></button><h3>친구 요청</h3></div>
    {(["received","sent"] as const).map(direction=>{
      const page=s.data?.[direction];const sent=direction==="sent";
      return <section className={styles.section} key={direction}><h4>{sent?"보낸 요청":"받은 요청"} <span className={styles.count}>{page?.total??0}</span></h4>
        {page?.items.map(request=><div key={request.id} className={styles.requestRow} data-highlight={request.id===s.highlight}>
          <SocialProfileButton publicId={request.person.publicId} nickname={request.person.nickname}><Avatar person={request.person}/></SocialProfileButton>
          <div className={styles.identity}><strong title={request.person.nickname}>{request.person.nickname}</strong><small>{sent?"수락 대기 중":ago(request.createdAt)}</small></div>
          <div className={styles.rowActions}>{sent?<button type="button" className={styles.secondary} disabled={!!s.busy} onClick={()=>void store.command("friend-cancel",{requestId:request.id},request.id)}>요청 취소</button>:<>
            <button type="button" className={styles.quiet} disabled={!!s.busy} onClick={()=>void store.command("friend-reject",{requestId:request.id},request.id)}>거절</button>
            <button type="button" className={styles.primary} disabled={!!s.busy} onClick={()=>void store.command("friend-accept",{requestId:request.id},request.id)}>수락</button></>}</div>
        </div>)}
        {page?.total===0&&<p className={styles.empty}>{sent?"보낸 요청이 없어요.":"받은 요청이 없어요."}</p>}
        {page&&<Pagination value={page} label={sent?"보낸 요청 페이지":"받은 요청 페이지"} onChange={p=>store.setPage(sent?"sentPage":"requestPage",p)}/>}
      </section>;
    })}
  </div>;
}
function Conversations(){
  const s=useSocial();const store=useSocialStore();const rooms=s.data?.rooms;
  const invitations=s.data?.invitations??[];
  // 초대도 번호형 페이지를 사용하고 알림에서 연 항목이 있는 페이지를 처음 표시한다.
  const [invitationPage,setInvitationPage]=useState(()=>Math.max(1,Math.floor(invitations.findIndex(i=>i.id===s.highlight)/12)+1));
  const currentInvitationPage=Math.min(invitationPage,Math.max(1,Math.ceil(invitations.length/12)));
  const sorted=[...(rooms?.items??[])].sort((a,b)=>(s.summaries[b.id]?.createdAt??"").localeCompare(s.summaries[a.id]?.createdAt??""));
  return <div className={styles.scroll}>
    <div className={styles.sectionTitle}><h3>대화</h3><button type="button" className={styles.secondary} onClick={()=>store.view("create")}><Icon name="plus"/>그룹 만들기</button></div>
    {!!s.data?.invitations.length&&<section className={styles.invitations}><h4>그룹 초대 <span className={styles.count}>{s.data.invitations.length}</span></h4>
      {invitations.slice((currentInvitationPage-1)*12,currentInvitationPage*12).map(invite=><div key={invite.id} className={styles.inviteRow} data-highlight={s.highlight===invite.id}><Avatar person={invite.inviter}/><div className={styles.identity}><strong>{invite.roomName}</strong><small>{invite.inviter.nickname}님의 초대</small><div className={styles.rowActions}>
        <button type="button" className={styles.quiet} disabled={!!s.busy} onClick={()=>void store.command("invitation-reject",{invitationId:invite.id},invite.id)}>거절</button>
        <button type="button" className={styles.primary} disabled={!!s.busy} onClick={()=>void store.command("invitation-accept",{invitationId:invite.id},invite.id).then(result=>{if(isRoom(result))store.openRoom(result);})}>참여</button>
      </div></div></div>)}
      <Pagination value={{page:currentInvitationPage,pageSize:12,total:invitations.length}} label="그룹 초대 페이지" onChange={setInvitationPage}/>
    </section>}
    {sorted.map(room=>{
      const summary=s.summaries[room.id];const person=room.members.find(m=>!m.self)?.person??s.data?.self;
      return <button type="button" key={room.id} className={styles.conversationRow} onClick={()=>store.openRoom(room)}>
        {room.kind==="GROUP"?<span className={styles.groupAvatar}><Icon name="users"/></span>:person&&<Avatar person={person}/>}
        <span className={styles.identity}><strong>{room.name}{room.kind==="GROUP"&&<small> · {room.members.length}명</small>}</strong><small>{summary?.preview??(room.kind==="GROUP"?"친구의 참여를 기다리고 있어요.":"첫 대화를 시작해 보세요.")}</small></span>
        <span className={styles.lastActivity}>{summary?.createdAt&&<time>{ago(summary.createdAt)}</time>}{!!summary?.unread&&<span className={styles.count}>{badge(summary.unread)}</span>}</span>
      </button>;
    })}
    {rooms?.total===0&&<p className={styles.empty}>친구를 선택해 대화를 시작해 보세요.</p>}
    {rooms&&<Pagination value={rooms} label="대화 목록 페이지" onChange={p=>store.setPage("roomPage",p)}/>}
  </div>;
}
function Conversation(){
  const s=useSocial();const store=useSocialStore();const body=useRef<HTMLDivElement>(null);const room=s.room;
  const atBottom=useRef(true);const restored=useRef<string|null>(null);const readTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  // 실제 보이는 문서·현재 방·최신 페이지·맨 아래에서만 읽음 처리한다. 다른 게임 창이나 숨은 탭은 제외한다.
  useEffect(()=>{
    const el=body.current;const doc=el?.ownerDocument;
    if(!el||!doc||!room||s.loading||s.history.page!==1||doc.visibilityState!=="visible"||!doc.hasFocus()||!el.getClientRects().length||!atBottom.current)return;
    const message=s.messages.at(-1);if(!message)return;
    clearTimeout(readTimer.current);readTimer.current=setTimeout(()=>{if(doc.hasFocus()&&doc.visibilityState==="visible")store.read(message);},550);
    return()=>clearTimeout(readTimer.current);
  },[s.messages,s.loading,s.history.page,store,room]);
  useLayoutEffect(()=>{
    const el=body.current;if(!el||!room)return;
    const key=room.id+":"+s.history.page;
    if(restored.current!==key){const saved=store.scrollTop(key);if(saved!==undefined){el.scrollTop=saved;atBottom.current=el.scrollHeight-el.scrollTop-el.clientHeight<50;}restored.current=key;}
    if(atBottom.current&&s.history.page===1)el.scrollTop=el.scrollHeight;
  },[s.messages,s.pending,s.history.page,room,store]);
  if(!room)return <Conversations/>;
  const peer=room.members.find(m=>!m.self)?.person;
  const draft=s.drafts[room.id]??"";
  const disabled=!room.writable||s.status!=="connected"||s.history.page!==1;
  return <div className={styles.conversation}>
    <div className={styles.conversationHeader}><button type="button" className={styles.icon} aria-label="대화 목록으로" onClick={()=>store.view("list")}><Icon name="arrowLeft"/></button>
      {room.kind==="DIRECT"&&peer?<SocialProfileButton publicId={peer.publicId} nickname={peer.nickname}><Avatar person={peer}/></SocialProfileButton>:<span className={styles.groupAvatar}><Icon name="users"/></span>}
      <div className={styles.identity}><strong title={room.name}>{room.name}</strong><small>{room.kind==="GROUP"?`참여자 ${room.members.length}명`:room.writable?"친구와의 대화":"기존 기록만 볼 수 있어요."}</small></div>
      <details className={styles.menu}><summary aria-label="대화 설정">⋮</summary><div>
        <button type="button" onClick={()=>void store.command("room-mute",{roomId:room.id,muted:!room.muted})}>{room.muted?"알림 켜기":"알림 끄기"}</button>
        {room.kind==="GROUP"?<>
          <button type="button" onClick={()=>store.view("members")}>참여자 관리</button>
          <button type="button" onClick={()=>store.view("invite")}>친구 초대</button>
          <button type="button" disabled={!!s.busy} onClick={()=>void store.command("room-leave",{roomId:room.id}).then(r=>{if(r)store.exitRoom();})}>그룹 나가기</button>
        </>:peer&&<>
          <button type="button" disabled={!!s.busy} onClick={()=>void store.command("friend-remove",{targetId:peer.publicId})}>친구 삭제</button>
          <button type="button" disabled={!!s.busy} onClick={()=>void store.command("block",{targetId:peer.publicId})}>차단</button>
        </>}
      </div></details>
    </div>
    <div className={styles.messages} role="log" aria-label="친구 대화 메시지" aria-live="off" ref={body} onScroll={event=>{const el=event.currentTarget;atBottom.current=el.scrollHeight-el.scrollTop-el.clientHeight<50;store.rememberScroll(room.id+":"+s.history.page,el.scrollTop);}}>
      {s.loading&&<p className={styles.empty}>대화를 불러오고 있어요…</p>}
      {!s.loading&&s.messages.length===0&&<p className={styles.empty}>반가운 인사로 대화를 시작해 보세요.</p>}
      {s.messages.map(message=><div key={message.id} className={styles.message} data-own={message.ownMessage}>
        {!message.ownMessage&&<SocialProfileButton publicId={message.publicUserId} nickname={message.nickname}><Avatar person={message} size={32}/></SocialProfileButton>}
        <div className={styles.bubbleGroup}>{!message.ownMessage&&<strong>{message.nickname}</strong>}<p>{message.content}</p><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"})}{message.ownMessage&&room.kind==="DIRECT"&&s.peerReadAt>=micros(message.createdAt)&&<span> · 읽음</span>}</time></div>
      </div>)}
      {s.pending.filter(p=>p.roomId===room.id).map(p=><div key={p.id} className={styles.message} data-own={true}><div className={styles.bubbleGroup}><p>{p.content}</p><small>{p.state==="queued"?"저장 확인 중":"전송 상태 확인 필요"}</small>{p.state==="uncertain"&&<button type="button" className={styles.quiet} disabled={s.status!=="connected"} onClick={()=>store.retry(p.id)}>확인 후 다시 보내기</button>}</div></div>)}
    </div>
    <Pagination value={s.history} label="대화 이력 페이지" onChange={p=>{atBottom.current=true;store.history(p);}}/>
    {s.history.page>1&&<button type="button" className={styles.latest} onClick={()=>{atBottom.current=true;store.history(1);}}>최신 대화 보기</button>}
    <form className={styles.composer} data-focus-frame onSubmit={event=>{event.preventDefault();atBottom.current=true;store.send();}}>
      <Icon name="smile"/><textarea rows={1} aria-label="친구에게 보낼 메시지" placeholder={!room.writable?"친구·참가 상태를 확인해 주세요.":s.status!=="connected"?"연결 후 입력할 수 있어요.":"메시지를 입력하세요…"} value={draft} maxLength={2000} disabled={disabled}
        onChange={event=>store.draft(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();if(!disabled){atBottom.current=true;store.send();}}}}/>
      <button type="submit" className={styles.send} disabled={disabled||!draft.trim()||[...draft].length>1000} aria-label="메시지 전송"><Icon name="send"/></button>
    </form>
  </div>;
}
function GroupForm({inviting=false}:{inviting?:boolean}){
  const s=useSocial();const store=useSocialStore();const [selected,setSelected]=useState<ReadonlySet<string>>(new Set());const [name,setName]=useState("");const [search,setSearch]=useState("");
  const members=new Set(s.room?.members.map(m=>m.person.publicId)??[]);const friends=s.data?.friends;
  return <form className={styles.scroll} onSubmit={event=>{event.preventDefault();void store.command(inviting?"group-invite":"group-create",inviting?{roomId:s.room?.id,userIds:[...selected]}:{name,userIds:[...selected]}).then(result=>{if(isRoom(result))store.openRoom(result);else if(result)store.view("members");});}}>
    <div className={styles.backHeading}><button type="button" className={styles.icon} aria-label="뒤로" onClick={()=>store.view(inviting?"conversation":"list")}><Icon name="arrowLeft"/></button><h3>{inviting?"친구 초대":"그룹 만들기"}</h3></div>
    {!inviting&&<label className={styles.field}>그룹 이름<input value={name} onChange={e=>setName(e.target.value)} maxLength={50} required placeholder="그룹 이름을 입력하세요"/></label>}
    <h4>초대할 친구</h4><p className={styles.hint}>내 친구만 초대할 수 있어요. 나 포함 최대 10명</p>
    <SearchInput label="초대할 친구 검색" placeholder="친구 검색" value={search} maxLength={50} onChange={e=>setSearch(e.target.value)} onSearch={()=>store.search(search)}/>
    <div className={styles.selectedCount}>친구 {selected.size}명 선택</div>
    {friends?.items.filter(person=>!inviting||!members.has(person.publicId)).map(person=><label key={person.publicId} className={styles.selectRow}>
      <Avatar person={person}/><span className={styles.identity}><strong>{person.nickname}</strong><small>{person.online?"온라인":"오프라인"}</small></span>
      <input className={styles.hiddenCheck} type="checkbox" checked={selected.has(person.publicId)} onChange={event=>setSelected(old=>{const next=new Set(old);if(event.target.checked){if(next.size<9)next.add(person.publicId);}else next.delete(person.publicId);return next;})}/><span className={styles.checkbox} aria-hidden="true"><Icon name="check"/></span>
    </label>)}
    {friends&&<Pagination value={friends} label="초대할 친구 페이지" onChange={p=>store.setPage("friendPage",p)}/>}
    {friends?.total===0&&<p className={styles.empty}>먼저 함께할 친구를 추가해 주세요.</p>}
    <button className={styles.fullPrimary} type="submit" disabled={!!s.busy||selected.size<(inviting?1:2)||!inviting&&!name.trim()}>초대 보내기</button>
    <p className={styles.hint}>친구가 수락하면 그룹에 참여해요.</p>
  </form>;
}
function Members(){
  const s=useSocial();const store=useSocialStore();const room=s.room;const [name,setName]=useState(room?.name??"");
  if(!room)return null;
  return <div className={styles.scroll}><div className={styles.backHeading}><button type="button" className={styles.icon} aria-label="대화로 돌아가기" onClick={()=>store.view("conversation")}><Icon name="arrowLeft"/></button><h3>참여자 {room.members.length}명</h3></div>
    {room.owner&&<form className={styles.rename} onSubmit={e=>{e.preventDefault();void store.command("room-rename",{roomId:room.id,name});}}><label className={styles.field}>그룹 이름<input value={name} maxLength={50} onChange={e=>setName(e.target.value)}/></label><button type="submit" className={styles.secondary} disabled={!!s.busy||!name.trim()}>변경</button></form>}
    {room.members.map(member=><div className={styles.personRow} key={member.person.publicId}><SocialProfileButton publicId={member.person.publicId} nickname={member.person.nickname} disabled={member.self}><Avatar person={member.person}/></SocialProfileButton><div className={styles.identity}><strong>{member.person.nickname}</strong><small>{member.owner?"방장":member.self?"나":"참여자"}</small></div>
      {room.owner&&!member.self&&<button type="button" className={styles.quiet} disabled={!!s.busy} onClick={()=>void store.command("room-kick",{roomId:room.id,targetId:member.person.publicId})}>내보내기</button>}</div>)}
    {!!room.invitations?.length&&<section className={styles.section}><h4>초대 중 {room.invitations.length}명</h4>{room.invitations.map(invite=><div className={styles.personRow} key={invite.id}><Avatar person={invite.person}/><div className={styles.identity}><strong>{invite.person.nickname}</strong><small>수락 대기 중</small></div>{invite.cancellable&&<button type="button" className={styles.secondary} disabled={!!s.busy} onClick={()=>void store.command("invitation-cancel",{invitationId:invite.id},invite.id)}>초대 취소</button>}</div>)}</section>}
    <button type="button" className={styles.fullPrimary} onClick={()=>store.view("invite")}><Icon name="userPlus"/>친구 초대</button>
  </div>;
}
function Contents(){
  const s=useSocial();if(!s.authorized)return <p className={styles.empty}>로그인 상태를 확인하고 있어요.</p>;if(!s.data)return <p className={styles.empty}>{s.error?"친구 정보를 확인하지 못했어요.":"친구 정보를 불러오고 있어요…"}</p>;
  return s.view==="requests"?<Requests/>:s.view==="conversation"?<Conversation/>:s.view==="create"?<GroupForm/>:s.view==="invite"?<GroupForm inviting/>:s.view==="members"?<Members/>:s.tab==="friends"?<FriendsList/>:<Conversations/>;
}
/** 홈의 탭도 동일한 화면을 표시하고 헤더 창과 동시에 두 벌을 렌더링하지 않는다. */
export function HomeSocialTabs(){
  const s=useSocial();const store=useSocialStore();const active=s.surface==="home"?s.tab:"all";
  const unread=Object.values(s.summaries).reduce((sum,v)=>sum+v.unread,0);
  // 탭과 본문은 구분선 없이 연결하고 기존 높이와 간격은 유지한다.
  return <div className={styles.homeTabs}>
    <div className={styles.tabs} role="tablist" aria-label="실시간 채팅 종류">
      <button type="button" role="tab" aria-selected={active==="all"} onClick={store.close}>전체</button>
      <button type="button" role="tab" aria-selected={active==="friends"} onClick={event=>store.home("friends",event.currentTarget.ownerDocument)}>친구{!!s.data?.received.total&&<span className={styles.count}>{badge(s.data.received.total)}</span>}</button>
      <button type="button" role="tab" aria-selected={active==="conversations"} onClick={event=>store.home("conversations",event.currentTarget.ownerDocument)}>대화{unread>0&&<span className={styles.count}>{badge(unread)}</span>}</button>
    </div>
  </div>;
}
export function HomeSocialPanel(){return <section className={`${styles.root} ${styles.embedded}`} data-social-ui><ErrorNotice/><Contents/></section>;}
function ErrorNotice(){
  const s=useSocial();const store=useSocialStore();return s.error?<div className={styles.error} role="alert"><span>{s.error}</span><button type="button" className={styles.quiet} onClick={()=>void store.refresh(false)}>다시 확인</button></div>:null;
}
function FriendsPanel(){
  const s=useSocial();const store=useSocialStore();const unread=Object.values(s.summaries).reduce((sum,n)=>sum+n.unread,0);
  return <><header className={styles.panelHeader}><h2><Icon name="users"/>친구</h2><small data-online={s.status==="connected"}><i/>{s.status==="connected"?"실시간 연결됨":s.status==="login"?"로그인 필요":"연결 확인 중"}</small><button type="button" className={styles.icon} aria-label="친구창 최소화" onClick={store.minimize}>−</button><button type="button" className={styles.icon} aria-label="친구창 닫기" onClick={store.close}><Icon name="close"/></button></header>
    <div className={styles.tabs} role="tablist" aria-label="친구 및 대화"><button type="button" role="tab" aria-selected={s.tab==="friends"} onClick={()=>store.tab("friends")}>친구</button><button type="button" role="tab" aria-selected={s.tab==="conversations"} onClick={()=>store.tab("conversations")}>대화{unread>0&&<span className={styles.count}>{badge(unread)}</span>}</button></div>
    <ErrorNotice/><Contents/></>;
}
function Notifications(){
  const s=useSocial();const store=useSocialStore();const page=s.data?.notifications;
  return <><header className={styles.panelHeader}><h2><Icon name="bell"/>알림</h2><button type="button" className={styles.quiet} disabled={!!s.busy||!s.data?.unreadNotifications} onClick={()=>void store.command("notifications-read",{beforeId:s.data?.notificationBoundary})}>모두 읽음</button><button type="button" className={styles.icon} aria-label="알림 닫기" onClick={store.close}><Icon name="close"/></button></header><ErrorNotice/><div className={styles.scroll}>
    {page?.items.map(n=><button type="button" className={styles.notification} data-unread={!n.read} key={n.id} disabled={!!s.busy} onClick={()=>void store.openNotification(n)}>
      <Avatar person={n.actor}/><span className={styles.identity}><strong>{n.actor.nickname}</strong><span>{n.kind==="FRIEND_REQUEST"?"친구 요청을 보냈어요.":n.kind==="FRIEND_ACCEPTED"?"친구 요청을 수락했어요.":"그룹에 초대했어요."}</span><small>{ago(n.createdAt)}</small></span>{!n.read&&<i className={styles.unreadDot}/>}<Icon name="chevronRight"/></button>)}
    {page?.total===0&&<p className={styles.empty}>아직 새로운 알림이 없어요.</p>}
    {page&&<Pagination value={page} label="알림 페이지" onChange={p=>store.setPage("notificationPage",p)}/>}
  </div></>;
}
function DialogShell({children,kind,owner}:{children:ReactNode;kind:"friends"|"notifications";owner:Document}){
  const ref=useRef<HTMLDialogElement>(null);const store=useSocialStore();
  useLayoutEffect(()=>{
    const dialog=ref.current;const view=owner.defaultView;if(!dialog||!view)return;
    const media=view.matchMedia("(max-width: 44rem)");let last:boolean|undefined;
    const display=()=>{if(last===media.matches&&dialog.open)return;last=media.matches;if(dialog.open)dialog.close();if(media.matches)dialog.showModal();else dialog.show();};
    display();media.addEventListener("change",display);return()=>{media.removeEventListener("change",display);if(dialog.open)dialog.close();};
  },[owner]);
  return <dialog ref={ref} className={`${styles.root} ${styles.panel}`} data-kind={kind} data-social-ui aria-label={kind==="friends"?"친구 및 대화":"알림"}
    onCancel={event=>{event.preventDefault();event.stopPropagation();store.close();}} onKeyDown={event=>{if(event.key==="Escape"){event.preventDefault();event.stopPropagation();store.close();}}}>{children}</dialog>;
}
/** 작은 프로필 카드의 구성은 이미지/닉네임/한 개의 주 동작으로 제한한다. */
function ProfilePopup(){
  const s=useSocial();const store=useSocialStore();const ref=useRef<HTMLDivElement>(null);const profile=s.profile;
  useLayoutEffect(()=>{
    if(!profile||!ref.current)return;
    const box=ref.current;const view=box.ownerDocument.defaultView;if(!view)return;
    const place=()=>{const r=profile.anchor.getBoundingClientRect();box.style.left=`${Math.max(12,Math.min(view.innerWidth-box.offsetWidth-12,r.left))}px`;box.style.top=`${Math.max(12,Math.min(view.innerHeight-box.offsetHeight-12,r.bottom+8))}px`;};
    place();view.addEventListener("resize",place);
    const close=(event:Event)=>{if(event.target&&!box.contains(event.target as Node)&&!profile.anchor.contains(event.target as Node))store.dismissProfile();};
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"){event.preventDefault();event.stopPropagation();store.dismissProfile();}};
    box.ownerDocument.addEventListener("pointerdown",close,true);box.ownerDocument.addEventListener("keydown",escape,true);
    box.querySelector<HTMLButtonElement>("button")?.focus({preventScroll:true});
    return()=>{view.removeEventListener("resize",place);box.ownerDocument.removeEventListener("pointerdown",close,true);box.ownerDocument.removeEventListener("keydown",escape,true);};
  },[profile,store]);
  if(!profile)return null;
  const person=profile.person;const label=person.relation==="FRIEND"?"1:1 대화":person.relation==="SENT"?"요청 보냄":person.relation==="RECEIVED"?"요청 확인":person.relation==="BLOCKED"?"차단 해제":person.relation==="UNAVAILABLE"?"요청할 수 없음":"친구 추가";
  const action=()=>{
    // 기존 모바일 전체 채팅 모달에서 전역 대화로 이동할 때 배경 모달을 남기지 않는다.
    if(person.relation==="FRIEND"||person.relation==="RECEIVED"){const source=profile.anchor.closest("dialog");if(source&&!source.hasAttribute("data-social-ui"))source.close();}
    if(person.relation==="FRIEND")void store.openDirect(person);else if(person.relation==="RECEIVED")store.requests(person.requestId);else if(person.relation==="BLOCKED")void store.command("unblock",{targetId:person.publicId}).then(()=>store.showProfile(person.publicId,profile.anchor));else void store.command("friend-request",{targetId:person.publicId},person.publicId);
  };
  return <div className={`${styles.root} ${styles.profilePopup}`} ref={ref} role="dialog" aria-label={`${person.nickname} 프로필`} data-social-ui><Avatar person={person} size={80}/><strong>{person.nickname}</strong><button type="button" className={styles.fullPrimary} onClick={action} disabled={!!s.busy||["SENT","SELF","UNAVAILABLE"].includes(person.relation)}>{label}</button></div>;
}
/** 표시 문서만 인계한다. 게임 팝업에도 같은 provider/연결을 portal로 공유하며 전체 화면 안에서 표시한다. */
export function SocialOverlayHost(){
  const s=useSocial();const store=useSocialStore();const popup=useSyncExternalStore(subscribeToGamePopup,getGamePopup,()=>null);const mounted=useSyncExternalStore(subscribeHydration,()=>true,()=>false);const [,refreshHost]=useState(0);
  const requested=s.document?.defaultView;
  const owner=mounted?(popup?.document??(requested&&!requested.closed?s.document!:document)):null;
  useEffect(()=>{
    if(!owner)return;const update=()=>refreshHost(v=>v+1);owner.addEventListener("fullscreenchange",update);
    const visible=()=>{if(owner.visibilityState==="visible")void store.refresh(false);};owner.addEventListener("visibilitychange",visible);owner.defaultView?.addEventListener("focus",visible);
    return()=>{owner.removeEventListener("fullscreenchange",update);owner.removeEventListener("visibilitychange",visible);owner.defaultView?.removeEventListener("focus",visible);};
  },[owner,store]);
  if(!owner||!s.sessionId||!s.authorized)return null;
  const target=owner.fullscreenElement??owner.body;
  return <>
    {createPortal(<>
      {(s.surface==="friends"||s.surface==="notifications")&&<DialogShell key={s.surface} owner={owner} kind={s.surface}>{s.surface==="friends"?<FriendsPanel/>:<Notifications/>}</DialogShell>}
      {s.surface==="minimized"&&<button type="button" className={`${styles.root} ${styles.minimized}`} data-social-ui onClick={()=>store.openFriends(owner)}><Icon name="chat"/><span>{s.room?.name??"친구"}</span><Icon name="chevronUp"/></button>}
      {s.toast&&<div className={`${styles.root} ${styles.toast}`} role="status" data-social-ui><span>{s.toast.message}</span><button type="button" className={styles.quiet} onClick={()=>store.launch("notifications",owner)}>확인</button></div>}
      {/* 네이티브 모달 바깥의 형제는 inert가 되므로 프로필은 클릭한 dialog 안에 표시한다. */}
      {s.profile&&createPortal(<ProfilePopup/>,s.profile.anchor.closest("dialog")??s.profile.anchor.ownerDocument.fullscreenElement??s.profile.anchor.ownerDocument.body)}
    </>,target)}
  </>;
}

