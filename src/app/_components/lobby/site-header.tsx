"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { DismissibleDetails } from "./dismissible-details";
import { LobbyIcon } from "./lobby-icon";
import styles from "./lobby.module.css";
import { AdminEntry } from "@/features/admin/components/admin-entry";

/** 홈과 게임 화면이 같은 탐색·계정 경계를 사용한다. 홈 검색의 상태와 스크롤 동작도 그대로 전달한다. */
export function SiteHeader({
  account,
  showSearch = false,
  query,
  onQueryChange,
  onSearch,
  onNotice,
}: {
  account: ReactNode;
  showSearch?: boolean;
  query?: string;
  onQueryChange?: (value: string) => void;
  onSearch?: () => void;
  onNotice: (notice: { title: string; description: string }) => void;
}) {
  const router = useRouter();
  const [localQuery, setLocalQuery] = useState("");
  const search = query ?? localQuery;
  return (
    <header className={styles.header} data-search={showSearch}>
      <Link href="/" className={styles.brand} aria-label="Playground 홈">
        <span className={styles.brandMark}>
          <LobbyIcon name="gamepad" />
        </span>
        <span>Playground</span>
      </Link>
      {/* 홈에서만 검색을 렌더링하고, 검색 아이콘을 포함한 전체 입력 영역에 공통 1px 포커스 테두리를 표시한다. */}
      {showSearch && <form
        data-focus-frame
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
      </form>}
      {/* 관리 진입은 알림 왼쪽에 배치한다. 같은 열 안에서 묶어 권한별 표시 변화가 계정 배치를 밀지 않게 한다. */}
      <div className={styles.headerActions}>
      <AdminEntry />
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
      </div>
      <div className={styles.accountSlot}>{account}</div>
    </header>
  );
}
