"use client";
import { useState } from "react";
import { BattleDialog } from "./battle-dialog";
import styles from "./room-setup.module.css";

/** 목록에서 선택한 비밀방의 비밀번호를 받는다. 초대·링크·코드 입장은 별도 참가권으로 바로 연결한다. */
export function JoinRoomDialog({
  code,
  title,
  join,
  close,
}: {
  code: string;
  title: string;
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
          비밀번호를 입력하고 친구와 함께 참가하세요.
        </p>
        <label className={styles.field}>
          방 비밀번호
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
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
