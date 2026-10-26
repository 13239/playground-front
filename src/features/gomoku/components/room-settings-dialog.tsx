"use client";

import { useRef, useState, type FormEvent } from "react";
import { LobbyIcon } from "@/app/_components/lobby/lobby-icon";
import { AuthRequestError } from "@/features/auth/client/api";
import { validateRoomDraft, type RoomDraft } from "../contracts";
import type { WaitingRoom } from "../waiting-contracts";
import { RoomDialog } from "./room-dialog";
import { RoomSettingsFields } from "./room-settings-fields";
import common from "./gomoku.module.css";
import styles from "./room-settings-dialog.module.css";

/** 비밀번호 원문을 복원하지 않고 현재 공개 설정만 편집 초깃값으로 사용한다. */
function roomDraft(room: WaitingRoom): RoomDraft {
  return { title: room.title, visibility: room.visibility, password: "",
    undoLimit: room.undoLimit, forbiddenRule: room.forbiddenRule };
}

/** 편집 중 수신한 변경은 입력을 덮어쓰지 않고 명시적으로 최신 설정을 불러오게 한다. */
export function RoomSettingsDialog({ room, busy, onSave, onClose }: {
  room: WaitingRoom;
  busy: boolean;
  onSave: (draft: RoomDraft, revision: number) => Promise<void>;
  onClose: () => void;
}) {
  const [base, setBase] = useState(room);
  const [draft, setDraft] = useState(() => roomDraft(room));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const submitting = useRef(false);
  const stale = base.revision !== room.revision;
  const preservePassword = base.visibility === "PRIVATE" && draft.visibility === "PRIVATE";

  function update(patch: Partial<RoomDraft>) {
    setDraft(current => ({ ...current, ...patch }));
    setErrors({});
    setFailure("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || stale || submitting.current) return;
    const fieldErrors = validateRoomDraft(draft, preservePassword);
    if (Object.keys(fieldErrors).length) {
      setErrors(fieldErrors);
      formRef.current?.querySelector<HTMLElement>(`[name="${Object.keys(fieldErrors)[0]}"]`)?.focus();
      return;
    }
    submitting.current = true;
    setFailure("");
    try {
      await onSave({ ...draft, title: draft.title.trim() }, base.revision);
    } catch (error) {
      setFailure(error instanceof AuthRequestError ? error.message : "설정을 저장하지 못했습니다. 다시 시도해 주세요.");
      if (error instanceof AuthRequestError) setErrors({ ...error.fieldErrors });
    } finally { submitting.current = false; }
  }

  return (
    <RoomDialog title="방 설정 변경" busy={busy} onClose={onClose} className={styles.settingsDialog}>
      <p className={styles.description}>설정을 변경하면 두 참가자의 준비가 해제돼요.</p>
      <form ref={formRef} noValidate onSubmit={event => void submit(event)} aria-busy={busy}>
        <RoomSettingsFields draft={draft} errors={errors} disabled={busy || stale}
          preservePassword={preservePassword} onChange={update} />
        <p className={styles.fixedRules}><LobbyIcon name="board" /> 바둑판 20 × 20 · 제한 시간 30초 / 수</p>
        {stale && (
          <div className={styles.conflict} role="status">
            <p>방 상태가 변경됐어요. 최신 설정을 불러오면 입력한 내용이 현재 설정으로 바뀌어요.</p>
            <button type="button" className={common.secondaryButton} disabled={busy} onClick={() => {
              setBase(room); setDraft(roomDraft(room)); setErrors({}); setFailure("");
            }}>최신 설정 불러오기</button>
          </div>
        )}
        {failure && <p className={common.error} role="alert">{failure}</p>}
        <div className={common.actions}>
          <button type="button" className={common.secondaryButton} disabled={busy} onClick={onClose}>취소</button>
          <button type="submit" className={common.primaryButton} disabled={busy || stale}>
            <LobbyIcon name="check" />{busy ? "저장 중…" : "설정 저장"}
          </button>
        </div>
      </form>
    </RoomDialog>
  );
}
