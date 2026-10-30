"use client";

import { GuestFormGate } from "../../_components/guest-form-gate";
import { LoginForm } from "./login-form";

/** 로그인·가입은 동일한 최신 세션 판별을 사용하며 확인 중에도 폼 입력을 보존한다. */
export function LoginGate({ registered = false }: { registered?: boolean }) {
  // 이전 세션의 차단 안내는 숨기고, 실제 로그인 요청이 거절된 경우에만 확인창을 표시한다.
  return <GuestFormGate showAccessNotice={false}>{ready => <LoginForm ready={ready} registered={registered} />}</GuestFormGate>;
}
