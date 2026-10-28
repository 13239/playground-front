"use client";
import { useCallback,useEffect,useRef,useState } from "react";
import { AuthRequestError } from "@/features/auth/client/api";
import { authRetryDelay } from "@/features/auth/client/request-cooldown";
import { createUuidV4 } from "@/lib/client/uuid";
import type { MemoryState } from "../contracts";
import { memoryRequest,watchMemory } from "./api";

/** 단조 시계로 표시 시간을 계산하고 오래된 조회 응답은 revision으로 버린다. */
export function useMemoryRoom(sessionId:string,roomId:number){
  const [snapshot,setSnapshot]=useState<{room:MemoryState;at:number}>();const latest=useRef<MemoryState | undefined>(undefined);
  const [error,setError]=useState("");const [busy,setBusy]=useState(false);const locked=useRef(false);
  const [clock,setClock]=useState(()=>performance.now());const [epoch,setEpoch]=useState(0);
  const mounted=useRef(true);const controller=useRef<AbortController | undefined>(undefined);
  const accept=useCallback((room:MemoryState)=>{
    if(!mounted.current||room.revision<(latest.current?.revision??-1))return;
    if(room.revision===latest.current?.revision&&Date.parse(room.serverTime)<Date.parse(latest.current.serverTime))return;
    latest.current=room;setSnapshot({room,at:performance.now()});setError("");
  },[]);
  useEffect(()=>{mounted.current=true;return()=>{
    mounted.current=false;controller.current?.abort();
    // SPA 뒤로가기·다른 화면 이동은 퇴장으로 처리한다. 문서 새로고침은 서버의 접속 유예로 복구한다.
    const current=latest.current;
    if(current&&!current.closed&&current.seat>0)void memoryRequest(sessionId,"leave",{
      roomId:current.roomId,revision:current.revision,matchId:current.matchId,requestId:createUuidV4(),
    }).catch(()=>{/* 전송할 수 없는 종료는 서버의 접속 만료가 처리한다. */});
  };},[sessionId]);
  useEffect(()=>{
    const abort=new AbortController();controller.current=abort;
    let fetching=false,queued=false,stopped=false,hasLease=false,failures=0,retryAt=0;let timer:ReturnType<typeof setTimeout>;let releaseLock:(()=>void)|undefined;
    const terminal=(e:unknown)=>e instanceof AuthRequestError&&(e.status===401||["ROOM_NOT_JOINED","ROOM_PAGE_IN_USE"].includes(e.code??""));
    async function refresh(){
      if(abort.signal.aborted||stopped||!hasLease)return;if(fetching){queued=true;return;}if(locked.current||performance.now()<retryAt)return;
      fetching=true;
      try{accept(await memoryRequest(sessionId,"state",{roomId},abort.signal));failures=0;}
      catch(e){if(!abort.signal.aborted){setError(e instanceof AuthRequestError?e.message:"게임 연결을 확인하고 있어요.");
        if(terminal(e)){stopped=true;abort.abort();}
        else retryAt=performance.now()+(e instanceof AuthRequestError&&e.status===429?authRetryDelay(e):Math.min(10000,1000*2**Math.min(failures++,4)));}}
      finally{fetching=false;if(queued&&!stopped){queued=false;queueMicrotask(()=>void refresh());}}
    }
    async function listen(){
      if(abort.signal.aborted||stopped)return;
      if(performance.now()<retryAt){timer=setTimeout(()=>void listen(),Math.max(1000,retryAt-performance.now()));return;}
      try{await watchMemory(sessionId,roomId,abort.signal,()=>void refresh());}
      catch(e){if(!abort.signal.aborted&&terminal(e)){stopped=true;setError(e instanceof AuthRequestError?e.message:"연결을 확인해 주세요.");}}
      if(!abort.signal.aborted&&!stopped)timer=setTimeout(()=>void listen(),1000);
    }
    // 복제 탭이 sessionStorage의 tabId를 물려받아도 같은 브라우저에서는 한 화면만 판을 조작한다.
    // 취소 가능한 대기로 이전 effect의 잠금 해제를 기다린다. Strict Mode·재연결을 다른 탭으로 오인하지 않는다.
    const contention=setTimeout(()=>{if(!abort.signal.aborted&&!hasLease)setError("다른 탭에서 같은 그림 찾기를 이용하고 있어요. 기존 탭에서 나가면 연결돼요.");},600);
    if(navigator.locks)void navigator.locks.request(`playground:memory:active:${sessionId}`,{signal:abort.signal},async ()=>{
      if(abort.signal.aborted)return;
      hasLease=true;clearTimeout(contention);setError("");
      await new Promise<void>(release=>{releaseLock=release;void refresh();void listen();});
    }).catch(()=>{if(!abort.signal.aborted){stopped=true;setError("게임 화면의 접속 권한을 확인하지 못했어요.");}});
    else{hasLease=true;clearTimeout(contention);void refresh();void listen();}
    const lease=setInterval(()=>void refresh(),5000);
    const visible=()=>{if(!document.hidden)void refresh();};document.addEventListener("visibilitychange",visible);window.addEventListener("online",visible);
    return()=>{abort.abort();releaseLock?.();clearTimeout(contention);clearTimeout(timer);clearInterval(lease);document.removeEventListener("visibilitychange",visible);window.removeEventListener("online",visible);};
  },[sessionId,roomId,accept,epoch]);
  useEffect(()=>{const timer=setInterval(()=>setClock(performance.now()),50);return()=>clearInterval(timer);},[]);
  async function action(operation:"flip"|"ready"|"rematch"|"leave",body:Record<string,unknown>={}){
    const room=latest.current;if(locked.current||!room)return;
    locked.current=true;setBusy(true);setError("");
    try{const result=await memoryRequest(sessionId,operation,{roomId,revision:room.revision,requestId:createUuidV4(),...(operation!=="ready"?{matchId:room.matchId}:{}),...body},controller.current?.signal);accept(result);return result;}
    catch(e){if(mounted.current)setError(e instanceof AuthRequestError?e.message:"요청을 확인하지 못했어요. 현재 판을 다시 확인해 주세요.");}
    finally{locked.current=false;if(mounted.current)setBusy(false);}
  }
  const now=snapshot?Date.parse(snapshot.room.serverTime)+Math.max(0,clock-snapshot.at):0;
  return {room:snapshot?.room,now,error,busy,action,reconnect:()=>setEpoch(v=>v+1)};
}

