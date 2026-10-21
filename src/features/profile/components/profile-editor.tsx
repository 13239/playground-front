"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LobbyIcon } from "@/app/_components/lobby/lobby-icon";
import { AuthRequestError } from "@/features/auth/client/error";
import { profileAvatars, getProfileAvatar, type ProfileAvatarId } from "../catalog";
import type { UserProfile } from "../types";
import { ProfileAvatar } from "./profile-avatar";
import styles from "./profile.module.css";

/** 라디오 선택·즉시 미리보기와 네이티브 dialog의 포커스·Escape 처리를 사용한다. 저장 성공 후에만 닫는다. */
export function ProfileEditor({ profile, onSave, onClose }: {
  profile: UserProfile;
  onSave: (avatarId: ProfileAvatarId) => Promise<void>;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const submitting = useRef(false);
  const groupId = useId();
  const [selected, setSelected] = useState(profile.avatarId);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const selectedAvatar = getProfileAvatar(selected);

  useEffect(() => { dialogRef.current?.showModal(); }, []);

  async function save() {
    if (submitting.current || selected === profile.avatarId) return;
    submitting.current = true;
    setPending(true);
    setError("");
    try {
      await onSave(selected);
      dialogRef.current?.close();
    } catch (error) {
      setError(error instanceof AuthRequestError ? error.message : "프로필을 저장하지 못했어요. 다시 시도해 주세요.");
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <dialog ref={dialogRef} className={styles.dialog} aria-labelledby={`${groupId}-title`}
      aria-describedby={`${groupId}-description`} onClose={onClose}
      onCancel={(event) => { if (submitting.current) event.preventDefault(); }}>
      <div className={styles.dialogHeader}>
        <div>
          <p className={styles.eyebrow}>MY PLAYGROUND</p>
          <h2 id={`${groupId}-title`}>나만의 프로필</h2>
          <p id={`${groupId}-description`}>마음에 드는 친구와 함께 플레이해요.</p>
        </div>
        <button type="button" className={styles.closeButton} aria-label="프로필 선택 닫기" disabled={pending}
          onClick={() => dialogRef.current?.close()}><LobbyIcon name="close" /></button>
      </div>
      <div className={styles.dialogBody}>
        <div className={styles.preview}>
          <div className={styles.previewPortrait}><ProfileAvatar avatarId={selected} size={144} /></div>
          <div className={styles.previewCopy}>
            <span>플레이그라운드의 나</span>
            <strong>{profile.nickname}</strong>
            <p aria-live="polite">{selectedAvatar.name}</p>
          </div>
          <span className={styles.previewSparkle} aria-hidden="true"><LobbyIcon name="sparkles" /></span>
        </div>
        <fieldset className={styles.choices} disabled={pending}>
          {/* 캐릭터 수는 실제 목록에서 계산해 이미지가 추가되어도 안내 문구와 일치하게 한다. */}
          <legend>프로필 캐릭터 <span>{profileAvatars.length}명의 친구들</span></legend>
          <div className={styles.avatarGrid}>
            {profileAvatars.map((avatar) => (
              <label className={styles.choice} key={avatar.id}>
                <input className={styles.choiceInput} type="radio" name={groupId} value={avatar.id}
                  checked={selected === avatar.id} autoFocus={profile.avatarId === avatar.id}
                  onChange={() => { setSelected(avatar.id); setError(""); }} />
                <span className={styles.choiceCard}>
                  <span className={styles.choicePortrait}><ProfileAvatar avatarId={avatar.id} size={96} /></span>
                  <span className={styles.choiceName}>{avatar.name}</span>
                  {selected === avatar.id && <span className={styles.selectedMark} aria-hidden="true"><LobbyIcon name="check" /></span>}
                  {profile.avatarId === avatar.id && <span className={styles.currentBadge}>사용 중</span>}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <p className={styles.error} id={`${groupId}-error`} role="alert">{error}</p>
      </div>
      <div className={styles.dialogFooter}>
        <span>언제든 다른 친구로 바꿀 수 있어요.</span>
        <div>
          <button type="button" className={styles.cancelButton} disabled={pending}
            onClick={() => dialogRef.current?.close()}>취소</button>
          <button type="button" className={styles.saveButton} disabled={pending || selected === profile.avatarId}
            aria-describedby={`${groupId}-error`} onClick={() => void save()}>
            <LobbyIcon name="check" />{pending ? "저장 중…" : "저장하기"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
