"use client";
import { GameInviteDialog } from "@/features/game-invitations/game-invite-dialog";
/** 게임별 입장 정보만 공통 친구 선택창에 연결한다. */
export function GomokuInviteDialog(props: {
  roomId: number;
  pageId: string;
  sessionId: string;
  onClose: () => void;
}) {
  return <GameInviteDialog {...props} game="gomoku" />;
}
