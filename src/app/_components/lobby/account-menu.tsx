import type { ReactNode } from "react";
import { DismissibleDetails } from "./dismissible-details";
import { LobbyIcon } from "./lobby-icon";
import styles from "./lobby.module.css";

/** 검증된 사용자 이름만 표시하며 아직 존재하지 않는 레벨·경험치 같은 계정 수치는 만들지 않는다. */
export function AccountMenu({
  username,
  children,
}: {
  username: string;
  children: ReactNode;
}) {
  return (
    <DismissibleDetails className={styles.accountMenu}>
      <summary aria-label={`${username}님 계정 메뉴`}>
        <span className={styles.profileAvatar}>
          <LobbyIcon name="gamepad" />
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
        {children}
      </div>
    </DismissibleDetails>
  );
}
