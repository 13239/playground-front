"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AuthRequestError } from "@/features/auth/client/error";
import { revalidateAuthSession } from "@/features/auth/client/session-store";
import { authRetryDelay } from "@/features/auth/client/request-cooldown";
import type { ProfileAvatarId } from "../catalog";
import type { UserProfile } from "../types";
import { getProfile, updateProfile } from "./api";
import { notifyProfileChanged, subscribeProfileChanges } from "./profile-events";

type ProfileState = { sessionId?: string; profile?: UserProfile; error?: string; pending?: boolean };

/** 프로필은 현재 세션에만 결합하고 탭 복귀·변경 알림에서 재조회한다. 이전 계정의 지연 응답은 버린다. */
export function useProfile(sessionId: string) {
  const [state, setState] = useState<ProfileState>({});
  const generation = useRef(0);
  const retryRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    let active = true;
    let running = false;
    let changed = false;
    let checkedAt = Number.NEGATIVE_INFINITY;
    let retryAt = 0;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      timer = undefined;
      // 정상 상태에서는 폴링하지 않고 변경 알림과 실패 재시도만 보이는 탭에서 기다린다.
      if (active && document.visibilityState === "visible" && (changed || retryAt > 0)) {
        timer = setTimeout(() => void load(true), Math.max(0, retryAt - Date.now()));
      }
    };
    const load = async (force = false) => {
      if (!active || running || document.visibilityState !== "visible") return;
      // focus와 visibilitychange는 진행 중인 조회를 공유하고 일반 복귀는 30초 안에 재전송하지 않는다.
      if (Date.now() < retryAt) { schedule(); return; }
      if (!force && !changed && Date.now() - checkedAt < 30_000) return;
      running = true;
      changed = false;
      const request = ++generation.current;
      clearTimeout(timer);
      try {
        const profile = await getProfile(sessionId);
        if (active && request === generation.current) {
          checkedAt = Date.now();
          retryAt = 0;
          failures = 0;
          setState({ sessionId, profile });
        }
      } catch (error) {
        if (!active || request !== generation.current) return;
        // 본인 프로필의 키 검증 거절도 이전 화면을 유지하는 일반 조회 장애로 처리하지 않는다.
        if (error instanceof AuthRequestError && (error.status === 401 || error.status === 403 || error.code === "LOGIN_SESSION_CHANGED")) {
          revalidateAuthSession();
          return;
        }
        retryAt = Date.now() + authRetryDelay(error, Math.min(30_000, 5000 * 2 ** Math.min(failures++, 3)));
        setState((previous) => ({
          sessionId,
          profile: previous.sessionId === sessionId ? previous.profile : undefined,
          error: "프로필을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
        }));
      } finally { running = false; schedule(); }
    };
    const onFocus = () => { if (document.visibilityState === "visible") void load(); };
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) onChange(); };
    // 저장·다른 탭의 변경은 확인 간격과 관계없이 반영하되 429 대기와 이전 응답 폐기는 유지한다.
    const onChange = () => { generation.current++; changed = true; void load(true); };
    const onVisibility = () => {
      if (document.visibilityState === "visible") onFocus();
      else { clearTimeout(timer); timer = undefined; }
    };
    retryRef.current = () => {
      if (running) return;
      changed = true;
      setState(previous => ({ ...previous, pending: true }));
      void load(true);
    };
    void load();
    const unsubscribe = subscribeProfileChanges(onChange);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("online", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      // 정리된 효과의 응답은 active로 차단하고 새 효과는 다음 요청 세대를 사용한다.
      active = false;
      retryRef.current = undefined;
      clearTimeout(timer);
      unsubscribe();
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("online", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [sessionId]);

  const retry = useCallback(() => {
    retryRef.current?.();
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
