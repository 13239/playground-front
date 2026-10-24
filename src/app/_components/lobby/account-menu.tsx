"use client";

import { useRef, useState, type MouseEvent, type ReactNode } from "react";
import { focusWithoutRing } from "@/lib/client/show-modal";
import { defaultProfileAvatar } from "@/features/profile/catalog";
import { useProfile } from "@/features/profile/client/use-profile";
import { ProfileAvatar } from "@/features/profile/components/profile-avatar";
import { ProfileEditor } from "@/features/profile/components/profile-editor";
import { PasswordEditor } from "@/features/profile/components/password-editor";
import { PasswordSavedToast } from "@/features/profile/components/password-saved-toast";
import { LogoutButton } from "../logout-button";
import { DismissibleDetails } from "./dismissible-details";
import { LobbyIcon } from "./lobby-icon";
import styles from "./lobby.module.css";

/** 프로필에서 검증된 닉네임만 표시하며 아직 존재하지 않는 레벨·경험치 같은 계정 수치는 만들지 않는다. */
export function AccountMenu({
  sessionId,
  sessionWarning,
  children,
}: {
  sessionId: string;
  sessionWarning?: string;
  children: ReactNode;
}) {
  const { profile, error, loading, retry, save, saveNickname } = useProfile(sessionId);
  // 프로필을 불러오는 중이거나 조회에 실패해도 로그인 아이디를 대신 표시하지 않는다.
  const nickname = profile?.nickname ?? "플레이어";
  // 계정 편집 창은 한 번에 하나만 열어 포커스 복귀 대상과 세션을 공유한다.
  const [editor, setEditor] = useState<"profile" | "password">();
  const [passwordSaved, setPasswordSaved] = useState(0);
  const summaryRef = useRef<HTMLElement>(null);

  function releaseSummaryFocus() {
    const summary = summaryRef.current;
    if (!summary || document.activeElement !== summary) return;
    focusWithoutRing(summary);
  }

  function closeEditor() {
    releaseSummaryFocus();
    setEditor(undefined);
    requestAnimationFrame(releaseSummaryFocus);
  }

  function openEditor(event: MouseEvent<HTMLButtonElement>, target: "profile" | "password") {
    // 대화상자를 닫았을 때 숨겨진 메뉴 버튼 대신 계정 메뉴의 요약으로 포커스가 돌아오게 한다.
    const details = event.currentTarget.closest("details");
    details?.removeAttribute("open");
    const summary = details?.querySelector("summary");
    if (summary) focusWithoutRing(summary);
    setEditor(target);
  }

  return (
    <>
      <DismissibleDetails className={styles.accountMenu}>
        <summary ref={summaryRef} aria-label={`${nickname}님 계정 메뉴`}>
          <span className={styles.profileAvatar}>
            <ProfileAvatar avatarId={profile?.avatarId ?? defaultProfileAvatar} size={64} />
          </span>
          <span className={styles.profileCopy}>
            <strong>{nickname}</strong>
            {/* 확인 장애에도 메뉴·프로필은 유지하고 짧은 상태 안내로만 표시한다. */}
            <span title={sessionWarning}>
              <i />
              {sessionWarning ? "연결 확인 지연" : "플레이어"}
            </span>
          </span>
          <LobbyIcon name="down" className={styles.profileChevron} />
        </summary>
        <div className={styles.accountPopover}>
          <p className={styles.popoverEyebrow}>MY PLAYGROUND</p>
          <strong>{nickname}님, 반가워요!</strong>
          <p>오늘도 즐거운 시간 보내세요.</p>
          {/* 모든 계정 버튼이 같은 크기·간격을 공유하고 프로필·비밀번호·로그아웃 순서를 유지한다. */}
          <div className={styles.accountActions}>
            <button type="button" className={styles.profileMenuButton}
              onClick={(event) => openEditor(event, "profile")} disabled={loading || !profile}>
              <LobbyIcon name="user" />
              {loading ? "프로필 확인 중…" : "프로필 변경"}
            </button>
            <button type="button" className={styles.profileMenuButton} onClick={(event) => openEditor(event, "password")}>
              <LobbyIcon name="lock" />비밀번호 변경
            </button>
            <LogoutButton sessionId={sessionId} />
          </div>
          {error && (
            <div className={styles.profileLoadError} role="status">
              <p>{error}</p>
              <button type="button" onClick={retry} disabled={loading}>다시 불러오기</button>
            </div>
          )}
          {children}
        </div>
      </DismissibleDetails>
      {editor === "profile" && profile && (
        <ProfileEditor profile={profile} onSave={save} onSaveNickname={saveNickname} onClose={closeEditor} />
      )}
      {editor === "password" && (
        <PasswordEditor sessionId={sessionId} onClose={closeEditor} onSaved={() => setPasswordSaved(value => value + 1)} />
      )}
      {passwordSaved > 0 && <PasswordSavedToast key={passwordSaved} onDismiss={() => setPasswordSaved(0)} />}
    </>
  );
}
