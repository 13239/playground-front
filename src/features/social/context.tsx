"use client";
import { createContext, useContext, useSyncExternalStore } from "react";
import type { SocialStore } from "./social-store";
/** Provider 값은 바꾸지 않고 필요한 UI만 외부 저장소를 구독한다. 게임 트리는 메시지마다 갱신하지 않는다. */
export const SocialContext=createContext<SocialStore|null>(null);
export function useSocialStore(){const store=useContext(SocialContext);if(!store)throw new Error("친구 기능은 SocialProvider 내부에서 사용합니다.");return store;}
export function useSocial(){const store=useSocialStore();return useSyncExternalStore(store.subscribe,store.getSnapshot,store.getServerSnapshot);}
/** 홈 전체 메시지 영역은 소셜 초안 입력마다 다시 렌더링하지 않고 표시 위치만 구독한다. */
export function useHomeSocialActive(){const store=useSocialStore();return useSyncExternalStore(store.subscribe,()=>store.getSnapshot().surface==="home",()=>false);}

