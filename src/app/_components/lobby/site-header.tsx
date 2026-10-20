"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { DismissibleDetails } from "./dismissible-details";
import { LobbyIcon } from "./lobby-icon";
import styles from "./lobby.module.css";

/** 홈과 게임 화면이 같은 탐색·계정 경계를 사용한다. 홈 검색의 상태와 스크롤 동작도 그대로 전달한다. */
export function SiteHeader({
  account,
  active = "home",
  query,
  onQueryChange,
  onSearch,
  onBrowse,
  onNotice,
}: {
  account: ReactNode;
  active?: "home" | "games";
  query?: string;
  onQueryChange?: (value: string) => void;
  onSearch?: () => void;
  onBrowse?: () => void;
  onNotice: (notice: { title: string; description: string }) => void;
}) {
  const router = useRouter();
  const [localQuery, setLocalQuery] = useState("");
  const search = query ?? localQuery;
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.brand} aria-label="Playground 홈">
        <span className={styles.brandMark}>
          <LobbyIcon name="gamepad" />
        </span>
        <span>Playground</span>
      </Link>
      <nav className={styles.navigation} aria-label="주 메뉴">
        <Link
          href="/"
          className={active === "home" ? styles.activeNavigation : undefined}
          aria-current={active === "home" ? "page" : undefined}
        >
          홈
        </Link>
        {onBrowse ? (
          <button type="button" onClick={onBrowse}>
            게임
          </button>
        ) : (
          <Link
            href="/games/gomoku"
            className={active === "games" ? styles.activeNavigation : undefined}
            aria-current={active === "games" ? "page" : undefined}
          >
            게임
          </Link>
        )}
        <button
          type="button"
          onClick={() =>
            onNotice({
              title: "상점을 준비하고 있어요",
              description:
                "플레이를 더 특별하게 만들어 줄 아이템들을 준비 중이에요. 조금만 기다려 주세요!",
            })
          }
        >
          상점
        </button>
        <button
          type="button"
          onClick={() =>
            onNotice({
              title: "즐거운 이벤트가 찾아올 거예요",
              description:
                "함께 참여할 수 있는 새로운 이벤트를 준비하고 있어요. 곧 이곳에서 만나요!",
            })
          }
        >
          이벤트
        </button>
      </nav>
      <form
        className={styles.search}
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          if (onSearch) onSearch();
          else if (!search.trim() || /오목|보드|gomoku/i.test(search))
            router.push("/games/gomoku");
          else
            onNotice({
              title: "찾으시는 게임이 아직 없어요",
              description:
                "다른 검색어로 찾아보세요. 현재는 오목을 준비하고 있어요.",
            });
        }}
      >
        <LobbyIcon name="search" />
        <input
          type="search"
          name="game"
          aria-label="게임 검색"
          placeholder="게임을 검색해보세요... (예: 오목, 보드)"
          maxLength={100}
          value={search}
          autoComplete="off"
          onChange={(event) =>
            onQueryChange
              ? onQueryChange(event.target.value)
              : setLocalQuery(event.target.value)
          }
        />
      </form>
      <DismissibleDetails className={styles.notifications}>
        <summary className={styles.iconButton} aria-label="알림">
          <LobbyIcon name="bell" />
        </summary>
        <div className={styles.notificationPopover}>
          <strong>알림</strong>
          <LobbyIcon name="bell" />
          <p>아직 새로운 알림이 없어요.</p>
          <span>새로운 소식이 생기면 알려드릴게요.</span>
        </div>
      </DismissibleDetails>
      <div className={styles.accountSlot}>{account}</div>
    </header>
  );
}
