"use client";
import { useState } from "react";
import { BattleDialog } from "./battle-dialog";
import styles from "./room-setup.module.css";

/** 목록의 비밀방과 공개 여부를 아직 모르는 초대 링크 모두 참가 시 서버가 비밀번호를 검증한다. */
export function JoinRoomDialog({
  code,
  title,
  optional,
  join,
  close,
}: {
  code: string;
  title: string;
  optional?: boolean;
  join(password: string): void;
  close(): void;
}) {
  const [password, setPassword] = useState("");
  return (
    <BattleDialog title={title} close={close}>
      <form
        className={styles.joinForm}
        onSubmit={(e) => {
          e.preventDefault();
          join(password);
          setPassword("");
        }}
      >
        <p>
          방 코드 {code}
          <br />
          {optional
            ? "비밀방이면 비밀번호를 입력해 주세요. 공개방은 바로 참가할 수 있어요."
            : "비밀번호를 입력하고 친구와 함께 참가하세요."}
        </p>
        <label className={styles.field}>
          방 비밀번호
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required={!optional}
            minLength={4}
            maxLength={32}
            autoComplete="off"
            autoFocus
          />
        </label>
        <button className={styles.primary} type="submit">
          참가
        </button>
        <button type="button" onClick={close}>
          취소
        </button>
      </form>
    </BattleDialog>
  );
}
