"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { RoomDialog } from "@/features/gomoku/components/room-dialog";
import { Character } from "./character";
import styles from "./memory-dialog.module.css";

/** 승인한 캐릭터형 창들의 제목·닫기 여백·본문 간격을 한 곳에서 유지한다. */
export function MemoryDialog({ title, description, illustration, busy, onClose, wide = false, children }: {
  title: string; description: string; illustration?: ReactNode; busy: boolean;
  onClose: () => void; wide?: boolean; children: ReactNode;
}) {
  return <RoomDialog title={title} onClose={onClose} busy={busy}
    className={`${styles.dialog}${wide ? ` ${styles.modeDialog}` : ""}`} illustration={illustration}>
    <p className={styles.description}>{description}</p>
    {children}
  </RoomDialog>;
}

/** 참여코드 창과 같은 여우를 사용해 방 생성 흐름의 시각적 일관성을 맞춘다. */
export function MemoryHostIllustration() {
  // 모달이 열릴 때만 마운트되므로 즉시 로딩해 native dialog의 지연 로딩으로 빈 삽화가 남지 않게 한다.
  return <Image src="/images/memory/join-fox.png" width={256} height={256} sizes="128px" loading="eager" className={styles.fox} alt="" />;
}

/** 나가기 확인에도 실제 게임의 토끼·여우를 사용하고 불필요한 추가 이미지를 내려받지 않는다. */
export function MemoryFriends() {
  return <div className={styles.leaveCharacters} aria-hidden><Character index={0} /><Character index={1} /></div>;
}
