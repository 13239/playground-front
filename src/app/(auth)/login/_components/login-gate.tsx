"use client";

import { GuestFormGate } from "../../_components/guest-form-gate";
import { LoginForm } from "./login-form";

/** 로그인·가입은 동일한 최신 세션 판별을 사용하며 확인 중에도 폼 입력을 보존한다. */
export function LoginGate() {
  return <GuestFormGate>{ready => <LoginForm ready={ready} />}</GuestFormGate>;
}
