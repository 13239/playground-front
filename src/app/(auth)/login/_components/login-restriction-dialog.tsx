"use client";

import { AuthNoticeDialog } from "../../_components/auth-notice-dialog";

type LoginRestrictionDialogProps = {
  ready: boolean;
  message: string;
  onClose: () => void;
};

/** 실제 로그인 차단 응답만 표시하고 기본 dialog의 포커스 격리와 Escape 동작을 사용한다. */
export function LoginRestrictionDialog({ ready, message, onClose }: LoginRestrictionDialogProps) {
  return <AuthNoticeDialog title="로그인 제한" ready={ready} message={message} onClose={onClose} />;
}
