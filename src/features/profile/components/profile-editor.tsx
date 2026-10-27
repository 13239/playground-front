"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LobbyIcon } from "@/app/_components/lobby/lobby-icon";
import { showModalWithoutCloseFocus } from "@/lib/client/show-modal";
import { AuthRequestError } from "@/features/auth/client/error";
import {
  profileAvatars,
  getProfileAvatar,
  type ProfileAvatarId,
} from "../catalog";
import type { UserProfile } from "../types";
import { ProfileAvatar } from "./profile-avatar";
import { NicknameEditor } from "./nickname-editor";
import { WithdrawalDialog } from "./withdrawal-dialog";
import styles from "./profile.module.css";

/** 라디오 선택·즉시 미리보기와 네이티브 dialog의 포커스·Escape 처리를 사용한다. 저장 성공 후에만 닫는다. */
export function ProfileEditor({
  sessionId,
  profile,
  onSave,
  onSaveNickname,
  onClose,
}: {
  sessionId: string;
  profile: UserProfile;
  onSave: (avatarId: ProfileAvatarId) => Promise<void>;
  onSaveNickname: (nickname: string) => Promise<void>;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const submitting = useRef(false);
  const groupId = useId();
  const [selected, setSelected] = useState(profile.avatarId);
  const [pending, setPending] = useState(false);
  // 닉네임 저장 중에는 창 닫기·아바타 저장을 잠시 막아 두 변경 결과가 서로 뒤섞이지 않게 한다.
  const [nicknamePending, setNicknamePending] = useState(false);
  // 탈퇴 확인 중에는 프로필 저장·닉네임 수정·부모 닫기가 동시에 실행되지 않게 한다.
  const [withdrawalOpen, setWithdrawalOpen] = useState(false);
  const busy = pending || nicknamePending || withdrawalOpen;
  const [error, setError] = useState("");
  const selectedAvatar = getProfileAvatar(selected);

  useEffect(() => showModalWithoutCloseFocus(dialogRef.current), []);

  async function save() {
    if (submitting.current || nicknamePending || withdrawalOpen || selected === profile.avatarId) return;
    submitting.current = true;
    setPending(true);
    setError("");
    try {
      await onSave(selected);
      dialogRef.current?.close();
    } catch (error) {
      setError(
        error instanceof AuthRequestError
          ? error.message
          : "프로필을 저장하지 못했어요. 다시 시도해 주세요.",
      );
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <><dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={`${groupId}-title`}
      aria-describedby={`${groupId}-description`}
      onClose={onClose}
      onCancel={(event) => {
        if (submitting.current || nicknamePending || withdrawalOpen) event.preventDefault();
      }}
    >
      <div className={styles.dialogHeader}>
        <div>
          <p className={styles.eyebrow}>MY PLAYGROUND</p>
          <h2 id={`${groupId}-title`}>나만의 프로필</h2>
          <p id={`${groupId}-description`}>
            마음에 드는 친구와 함께 플레이해요.
          </p>
        </div>
        <button
          type="button"
          className={styles.closeButton}
          aria-label="프로필 선택 닫기"
          disabled={busy}
          onClick={() => dialogRef.current?.close()}
        >
          <LobbyIcon name="close" />
        </button>
      </div>
      <div className={styles.dialogBody}>
        <div className={styles.preview}>
          <div className={styles.previewPortrait}>
            <ProfileAvatar avatarId={selected} size={144} />
          </div>
          <div className={styles.previewCopy}>
            <NicknameEditor nickname={profile.nickname} disabled={pending || withdrawalOpen} onSave={onSaveNickname} onPendingChange={setNicknamePending} />
            <p aria-live="polite">{selectedAvatar.name}</p>
          </div>
          <span className={styles.previewSparkle} aria-hidden="true">
            <LobbyIcon name="sparkles" />
          </span>
        </div>
        <fieldset className={styles.choices} disabled={busy}>
          {/* 캐릭터 수는 실제 목록에서 계산해 이미지가 추가되어도 안내 문구와 일치하게 한다. */}
          <legend>
            프로필 캐릭터 <span>{profileAvatars.length}명의 친구들</span>
          </legend>
          <div className={styles.avatarGrid}>
            {profileAvatars.map((avatar) => (
              <label className={styles.choice} key={avatar.id}>
                <input
                  className={styles.choiceInput}
                  type="radio"
                  name={groupId}
                  value={avatar.id}
                  checked={selected === avatar.id}
                  autoFocus={profile.avatarId === avatar.id}
                  onChange={() => {
                    setSelected(avatar.id);
                    setError("");
                  }}
                />
                <span className={styles.choiceCard}>
                  <span className={styles.choicePortrait}>
                    <ProfileAvatar avatarId={avatar.id} size={96} />
                  </span>
                  <span className={styles.choiceName}>{avatar.name}</span>
                  {selected === avatar.id && (
                    <span className={styles.selectedMark} aria-hidden="true">
                      <LobbyIcon name="check" />
                    </span>
                  )}
                  {profile.avatarId === avatar.id && (
                    <span className={styles.currentBadge}>사용 중</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <p className={styles.error} id={`${groupId}-error`} role="alert">
          {error}
        </p>
      </div>
      <div className={`${styles.dialogFooter} ${styles.profileFooter}`}>
        {/* 왼쪽 텍스트 버튼은 별도 확인 창만 열고, 프로필의 미저장 선택을 제출하지 않는다. */}
        <button type="button" className={styles.withdrawButton} disabled={pending || nicknamePending} onClick={() => setWithdrawalOpen(true)}>회원탈퇴</button>
        <div>
          <button
            type="button"
            className={styles.cancelButton}
            disabled={busy}
            onClick={() => dialogRef.current?.close()}
          >
            취소
          </button>
          <button
            type="button"
            className={styles.saveButton}
            disabled={busy || selected === profile.avatarId}
            aria-describedby={`${groupId}-error`}
            onClick={() => void save()}
          >
            <LobbyIcon name="check" />
            {pending ? "저장 중…" : "저장하기"}
          </button>
        </div>
      </div>
    </dialog>
      {withdrawalOpen && <WithdrawalDialog sessionId={sessionId} onClose={() => setWithdrawalOpen(false)} />}
    </>
  );
}
