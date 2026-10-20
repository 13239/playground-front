"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { AuthRequestError } from "@/features/auth/client/error";
import { revalidateAuthSession } from "@/features/auth/client/session-store";
import type { ProfileAvatarId } from "../catalog";
import type { UserProfile } from "../types";
import { getProfile, updateProfile } from "./api";
import { notifyProfileChanged, subscribeProfileChanges } from "./profile-events";

type ProfileState = { sessionId?: string; profile?: UserProfile; error?: string; pending?: boolean };

/** 프로필은 현재 세션에만 결합하고 탭 복귀·변경 알림에서 재조회한다. 이전 계정의 지연 응답은 버린다. */
export function useProfile(sessionId: string) {
  const [state, setState] = useState<ProfileState>({});
  const [revision, reload] = useReducer((value: number) => value + 1, 0);
  const generation = useRef(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const request = ++generation.current;
      try {
        const profile = await getProfile(sessionId);
        if (active && request === generation.current) setState({ sessionId, profile });
      } catch (error) {
        if (!active || request !== generation.current) return;
        if (error instanceof AuthRequestError && (error.status === 401 || error.code === "LOGIN_SESSION_CHANGED")) {
          revalidateAuthSession();
        }
        setState((previous) => ({
          sessionId,
          profile: previous.sessionId === sessionId ? previous.profile : undefined,
          error: "프로필을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
        }));
      }
    };
    const onFocus = () => { if (document.visibilityState === "visible") void load(); };
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) void load(); };
    void load();
    const unsubscribe = subscribeProfileChanges(onFocus);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [sessionId, revision]);

  const retry = useCallback(() => {
    setState((previous) => ({ ...previous, error: undefined, pending: true }));
    reload();
  }, []);

  const save = useCallback(async (avatarId: ProfileAvatarId) => {
    const profile = await updateProfile(sessionId, avatarId);
    // 저장 전에 시작한 조회가 선택 결과를 덮어쓰지 않게 무효화하고 다른 탭에는 재조회 신호만 보낸다.
    generation.current++;
    setState({ sessionId, profile });
    notifyProfileChanged();
  }, [sessionId]);

  return {
    profile: state.sessionId === sessionId ? state.profile : undefined,
    error: state.sessionId === sessionId ? state.error : undefined,
    loading: state.sessionId !== sessionId || !!state.pending,
    retry,
    save,
  };
}
