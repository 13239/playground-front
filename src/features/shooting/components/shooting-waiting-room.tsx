"use client";
import { useState, type ReactNode } from "react";
import type { GameSnapshot, PlayerView } from "@playground/shooting-shared";
import { Icon } from "@/components/ui/icon";
import { ProfileAvatar } from "@/features/profile/components/profile-avatar";
import { isProfileAvatarId } from "@/features/profile/catalog";
import { GameInviteDialog } from "@/features/game-invitations/game-invite-dialog";
import type { ShootingRuntime } from "../client/runtime";
import styles from "./lobby.module.css";

/** 대기실에서만 초대·링크·무기를 표시한다. 전투 시작 즉시 메뉴 전체가 사라진다. */
export function ShootingWaitingRoom({
  runtime,
  state,
  player,
  sessionId,
  code,
  children,
  ready,
}: {
  runtime: ShootingRuntime;
  state: GameSnapshot;
  player: PlayerView;
  sessionId: string;
  code: string;
  children: ReactNode;
  ready: () => void;
}) {
  const [invite, setInvite] = useState(false);
  const [copied, setCopied] = useState("");
  const members = Object.values(state.players).filter(
    (value) => !value.departed,
  );
  const hosting = runtime.getView().hosting;
  async function copy(link: boolean) {
    try {
      await navigator.clipboard.writeText(
        link
          ? `${location.origin}/games/shooting?room=${encodeURIComponent(code)}`
          : code,
      );
      setCopied(link ? "초대 링크를 복사했어요." : "방 코드를 복사했어요.");
    } catch {
      setCopied("복사할 수 없는 환경이에요. 아래 방 코드를 직접 알려주세요.");
    }
  }
  return (
    <div className={styles.waiting}>
      <div className={styles.heading}>
        <button onClick={() => runtime.disconnect()}>
          <Icon name="arrowLeft" />방 목록
        </button>
        <div>
          <h2>함께 전장에 들어갈 준비</h2>
          <small>온라인 2인 협동 · {members.length} / 2</small>
        </div>
        <button onClick={() => runtime.disconnect()}>나가기</button>
      </div>
      <div className={styles.playerSlots}>
        {members.map((member) => (
          <section
            key={member.id}
            className={styles.playerCard}
            data-self={member.id === player.id}
          >
            <span className={styles.playerAvatar}>
              {isProfileAvatarId(member.avatar) ? (
                <ProfileAvatar avatarId={member.avatar} size={92} />
              ) : (
                <Icon name="user" />
              )}
            </span>
            <strong>{member.nickname}</strong>
            <small>{member.id === player.id ? "나" : "팀원"}</small>
            <span className={member.ready ? styles.ready : styles.notReady}>
              {member.ready ? "준비 완료" : "무기 선택 중"}
            </span>
          </section>
        ))}
        {members.length < 2 && (
          <section className={`${styles.playerCard} ${styles.emptySlot}`}>
            <Icon name="userPlus" />
            <strong>친구를 기다리고 있어요</strong>
            <small>함께 더 높은 스테이지에 도전하세요.</small>
            {hosting && (
              <button
                className={styles.primary}
                onClick={() => setInvite(true)}
              >
                <Icon name="userPlus" />
                친구 초대
              </button>
            )}
            <button onClick={() => void copy(true)}>
              <Icon name="link" />
              초대 링크 복사
            </button>
          </section>
        )}
      </div>
      <section className={styles.loadout}>
        <h3>시작 무기</h3>
        {children}
      </section>
      <div className={styles.waitingFooter}>
        <button
          className={styles.primary}
          disabled={player.ready}
          onClick={ready}
        >
          {player.ready ? "함께 시작할 준비 완료" : "준비 완료"}
        </button>
        <div className={styles.code}>
          <span>방 코드</span>
          <code>{code}</code>
          <button aria-label="방 코드 복사" onClick={() => void copy(false)}>
            <Icon name="copy" />
          </button>
        </div>
      </div>
      <p className={styles.footnote} role="status">
        {copied || "두 명 모두 준비하면 전투가 시작돼요."}
      </p>
      {invite && hosting && members.length === 1 && (
        <GameInviteDialog
          game="shooting"
          roomId={code}
          sessionId={sessionId}
          onClose={() => setInvite(false)}
        />
      )}
    </div>
  );
}
