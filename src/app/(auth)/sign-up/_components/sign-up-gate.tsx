"use client";

import { GuestFormGate } from "../../_components/guest-form-gate";
import { SignUpForm } from "./sign-up-form";

/** 로그인된 계정은 홈으로 보내고 탭 복귀 시에도 최신 세션 확인 뒤 가입을 허용한다. */
export function SignUpGate() {
  return <GuestFormGate>{(ready) => <SignUpForm ready={ready} />}</GuestFormGate>;
}
