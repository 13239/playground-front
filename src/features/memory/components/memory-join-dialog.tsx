"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Icon } from "@/components/ui/icon";
import { RoomDialog } from "@/features/gomoku/components/room-dialog";
import shared from "./memory.module.css";
import styles from "./memory-lobby.module.css";

/** 선택한 3번 시안: 캐릭터 안내 아래에서 코드를 입력하고 기존 서버 입장 검증으로 전달한다. */
export function MemoryJoinDialog({ busy, error, onClose, onEdit, onJoin }: {
  busy: boolean; error: string; onClose: () => void; onEdit: () => void; onJoin: (code: string) => void;
}) {
  const [code, setCode] = useState("");
  const hintId = useId();
  const errorId = useId();
  const input = useRef<HTMLInputElement>(null);
  // 공통 모달이 열린 뒤 코드 입력으로 포커스를 옮겨 키보드로 바로 참가할 수 있게 한다.
  useEffect(() => { input.current?.focus({ preventScroll: true }); }, []);
  const normalize = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  function change(value: string) { setCode(normalize(value)); onEdit(); }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (code.length === 6 && !busy) onJoin(code);
  }
  return (
    <RoomDialog title="참여코드로 참가" className={styles.joinDialog} busy={busy} onClose={onClose}
      illustration={<Image src="/images/memory/join-fox.png" width={256} height={256} sizes="(max-width: 600px) 144px, 176px" loading="eager" alt="" className={styles.joinFox} />}>
      <p id={hintId} className={styles.joinDescription}>친구에게 받은 6자리 코드를 입력하세요.</p>
      <form className={styles.joinForm} onSubmit={submit}>
        {/* 아이콘과 입력을 한 프레임으로 묶어 공통 1px 포커스 테두리를 한 번만 표시한다. */}
        <div className={styles.codeFrame} data-focus-frame>
          <Icon name="ticket" />
          <input ref={input} aria-label="참여코드" aria-describedby={`${hintId}${error ? ` ${errorId}` : ""}`} aria-invalid={!!error}
            placeholder="6자리 참여코드" value={code} maxLength={6} pattern="[A-Z0-9]{6}" autoComplete="off"
            autoCapitalize="characters" autoCorrect="off" spellCheck={false} required disabled={busy}
            onChange={event => change(event.target.value)} onPaste={event => {
              // 공백·하이픈이 포함된 복사본도 정규화한 여섯 자리를 한 번에 입력한다.
              event.preventDefault(); change(event.clipboardData.getData("text"));
            }} />
        </div>
        {error && <p id={errorId} className={styles.joinError} role="alert">{error}</p>}
        <button type="submit" className={`${shared.primary} ${styles.primary}`} disabled={busy || code.length !== 6}>{busy ? "참가 중…" : "참가"}</button>
        <button type="button" className={styles.cancelJoin} disabled={busy} onClick={onClose}>취소</button>
      </form>
    </RoomDialog>
  );
}
