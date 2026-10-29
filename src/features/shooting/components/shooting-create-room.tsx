"use client";
import { useState, type FormEvent } from "react";
import { Icon } from "@/components/ui/icon";
import type { RoomOptions } from "../client/runtime";
import styles from "./room-setup.module.css";

/** 승인된 B안의 소개·폼 분할 화면이다. 비밀번호는 제출하는 순간에만 게임 서버로 보낸다. */
export function ShootingCreateRoom({
  create,
  cancel,
}: {
  create(settings: RoomOptions): void;
  cancel(): void;
}) {
  const [title, setTitle] = useState("함께 살아남아요");
  const [privateRoom, setPrivate] = useState(false);
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    create({
      title: title.trim(),
      privateRoom,
      ...(privateRoom ? { password } : {}),
    });
    setPassword("");
  };
  return (
    <div className={styles.creation}>
      <aside className={styles.createArtwork}>
        <div>
          <h2>슈팅 서바이벌</h2>
          <p>온라인 2인 협동</p>
          <small>
            친구와 함께 적들을 물리치고
            <br />더 오래 살아남으세요.
          </small>
        </div>
      </aside>
      <form className={styles.createForm} onSubmit={submit}>
        <header>
          <h2>함께할 전장을 만들어보세요</h2>
          <p>친구를 초대해 둘만의 생존전을 시작하세요.</p>
        </header>
        <label className={styles.field}>
          방 이름
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={20}
            required
            pattern=".*\S.*"
            autoComplete="off"
          />
          <small>{[...title].length} / 20</small>
        </label>
        <fieldset className={styles.privacy}>
          <legend>방 공개 설정</legend>
          {([false, true] as const).map((secret) => (
            <button
              key={String(secret)}
              type="button"
              aria-pressed={privateRoom === secret}
              onClick={() => {
                setPrivate(secret);
                if (!secret) setPassword("");
              }}
            >
              <Icon name={secret ? "lock" : "globe"} />
              <span>
                <b>{secret ? "비밀방" : "공개방"}</b>
                <small>
                  {secret
                    ? "비밀번호가 있어야 참여할 수 있어요"
                    : "누구나 참여할 수 있어요"}
                </small>
              </span>
              {privateRoom === secret && <Icon name="check" />}
            </button>
          ))}
        </fieldset>
        {privateRoom && (
          <label className={styles.field}>
            비밀번호
            <div className={styles.passwordFrame} data-focus-frame>
              <input
                type={visible ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={4}
                maxLength={32}
                required
                autoComplete="new-password"
                placeholder="4~32자"
              />
              <button
                type="button"
                aria-label={visible ? "비밀번호 숨기기" : "비밀번호 표시"}
                aria-pressed={visible}
                onClick={() => setVisible((v) => !v)}
              >
                <Icon name="eye" />
              </button>
            </div>
          </label>
        )}
        <div className={styles.field}>
          <span>최대 인원</span>
          <div className={styles.capacity}>
            <Icon name="users" />
            최대 2명
          </div>
        </div>
        <div className={styles.createActions}>
          <button type="button" onClick={cancel}>
            취소
          </button>
          <button className={styles.primary} type="submit">
            방 만들기
          </button>
        </div>
      </form>
    </div>
  );
}
