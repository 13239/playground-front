"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import { defaultProfileAvatar } from "@/features/profile/catalog";
import { useProfile } from "@/features/profile/client/use-profile";
import { ProfileAvatar } from "@/features/profile/components/profile-avatar";
import { ProfileEditor } from "@/features/profile/components/profile-editor";
import { DismissibleDetails } from "./dismissible-details";
import { LobbyIcon } from "./lobby-icon";
import styles from "./lobby.module.css";

/** 검증된 사용자 이름만 표시하며 아직 존재하지 않는 레벨·경험치 같은 계정 수치는 만들지 않는다. */
export function AccountMenu({
  username,
  sessionId,
  children,
}: {
  username: string;
  sessionId: string;
  children: ReactNode;
}) {
  const { profile, error, loading, retry, save } = useProfile(sessionId);
  const [editorOpen, setEditorOpen] = useState(false);

  function openEditor(event: MouseEvent<HTMLButtonElement>) {
    // 대화상자를 닫았을 때 숨겨진 메뉴 버튼 대신 계정 메뉴의 요약으로 포커스가 돌아오게 한다.
    const details = event.currentTarget.closest("details");
    details?.removeAttribute("open");
    details?.querySelector("summary")?.focus();
    setEditorOpen(true);
  }

  return (
    <>
      <DismissibleDetails className={styles.accountMenu}>
        <summary aria-label={`${username}님 계정 메뉴`}>
          <span className={styles.profileAvatar}>
            <ProfileAvatar avatarId={profile?.avatarId ?? defaultProfileAvatar} size={64} />
          </span>
          <span className={styles.profileCopy}>
            <strong>{username}</strong>
            <span>
              <i />
              플레이어
            </span>
          </span>
          <LobbyIcon name="down" className={styles.profileChevron} />
        </summary>
        <div className={styles.accountPopover}>
          <p className={styles.popoverEyebrow}>MY PLAYGROUND</p>
          <strong>{username}님, 반가워요!</strong>
          <p>오늘도 즐거운 시간 보내세요.</p>
          <button
            type="button"
            className={styles.profileMenuButton}
            onClick={openEditor}
            disabled={loading || !profile}
          >
            <LobbyIcon name="user" />
            {loading ? "프로필 확인 중…" : "프로필 변경"}
          </button>
          {error && (
            <div className={styles.profileLoadError} role="status">
              <p>{error}</p>
              <button type="button" onClick={retry} disabled={loading}>다시 불러오기</button>
            </div>
          )}
          {children}
        </div>
      </DismissibleDetails>
      {editorOpen && profile && (
        <ProfileEditor profile={profile} onSave={save} onClose={() => setEditorOpen(false)} />
      )}
    </>
  );
}
