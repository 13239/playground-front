"use client";

import { useAuthSession } from "./session-store";

/** 문서 수명 동안 공통 구독을 유지해 홈·게임·관리자 화면 전환이 인증 상태를 초기화하지 않게 한다. */
export function AuthSessionObserver() {
  // 사용자 정보는 렌더링하지 않는다. 각 화면은 기존 저장소에서 인증 결과를 구독한다.
  useAuthSession();
  return null;
}
