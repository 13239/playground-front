import type { AdminChatMessage } from "../chat-contracts";
import { LogPersonLabel } from "./log-person";
import admin from "./admin.module.css";

/** 목록·상세 모두 저장된 이름과 아바타만 사용하며 현재 프로필을 별도 조회하지 않는다. */
export function ChatAuthor({ message }: { message: AdminChatMessage }) {
  return <LogPersonLabel person={{ id: message.authorId, username: null, nickname: message.authorNickname, avatarId: message.authorAvatarId }} />;
}
export function ChatScopeBadge({ scope }: { scope: AdminChatMessage["scope"] }) {
  return <span className={scope === "GLOBAL" ? admin.statusGood : admin.roleBadge}>{scope === "GLOBAL" ? "공용 채팅" : "게임방 채팅"}</span>;
}
