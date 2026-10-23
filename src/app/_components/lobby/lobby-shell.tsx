"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  gameCategories,
  lobbyGames,
  type GameCategoryId,
  type LobbyGame,
} from "@/features/lobby/catalog";
import { showModalWithoutCloseFocus } from "@/lib/client/show-modal";
import { ChatPanel } from "./chat-panel";
import { SiteHeader } from "./site-header";
import { GomokuCover } from "./gomoku-cover";
import { HeroBanner } from "./hero-banner";
import { LobbyIcon } from "./lobby-icon";
import styles from "./lobby.module.css";

type Notice = { title: string; description: string; game?: LobbyGame };

/** 네이티브 dialog의 포커스 이동·Escape 닫기·배경 비활성화를 사용해 별도 모달 의존성을 피한다. */
function NoticeDialog({
  notice,
  onClose,
}: {
  notice: Notice;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialogRef}
      className={styles.noticeDialog}
      onClose={onClose}
      aria-labelledby="notice-title"
      aria-describedby="notice-description"
    >
      {notice.game ? (
        <div className={styles.dialogCover}>
          <GomokuCover />
        </div>
      ) : (
        <div className={styles.noticeSymbol}>
          <LobbyIcon name="sparkles" />
        </div>
      )}
      <div className={styles.noticeContent}>
        <span className={styles.noticeBadge}>COMING SOON</span>
        <h2 id="notice-title">{notice.title}</h2>
        <p id="notice-description">{notice.description}</p>
        {notice.game && (
          <div className={styles.gameTags}>
            {notice.game.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        )}
        <form method="dialog">
          <button className={styles.primaryButton} autoFocus>
            확인했어요
            <LobbyIcon name="check" />
          </button>
        </form>
      </div>
    </dialog>
  );
}

/** 서버는 공개 화면 틀만 전달하고 계정은 별도 세션 경계에서 확인한다. 검색·필터는 현재 공개 목록에만 적용한다. */
export function LobbyShell({ account }: { account: ReactNode }) {
  // 채팅 연결 상태는 상위 ChatProvider가 소유하므로 게임 검색·목록은 새 메시지마다 다시 렌더링하지 않는다.
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<GameCategoryId>("all");
  const [notice, setNotice] = useState<Notice>();
  const categoryListRef = useRef<HTMLDivElement>(null);
  const gamesRef = useRef<HTMLElement>(null);
  const mobileChatRef = useRef<HTMLDialogElement>(null);
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
  const games = lobbyGames.filter((game) => {
    const matchesCategory =
      category === "all" || game.categories.some((value) => value === category);
    const searchText =
      `${game.title} ${game.description} ${game.tags.join(" ")}`.toLocaleLowerCase(
        "ko-KR",
      );
    return matchesCategory && searchText.includes(normalizedQuery);
  });
  const categoryLabel =
    gameCategories.find((value) => value.id === category)?.label ?? "전체";
  const catalogTitle = normalizedQuery
    ? "검색 결과"
    : category === "all"
      ? "전체 게임"
      : categoryLabel;

  function browseGames() {
    // 모션 감소 설정을 존중하며 키보드 사용자에게도 목록 제목으로 포커스를 전달한다.
    gamesRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    });
    gamesRef.current?.focus({ preventScroll: true });
  }

  function resetFilters() {
    setCategory("all");
    setQuery("");
  }

  return (
    <div className={styles.screen}>
      <a className={styles.skipLink} href="#game-catalog">
        게임 목록으로 건너뛰기
      </a>
      <SiteHeader
        account={account}
        // 검색은 홈의 게임 목록에서만 제공한다.
        showSearch
        query={query}
        onQueryChange={setQuery}
        onSearch={browseGames}
        onNotice={setNotice}
      />
      <div className={styles.layout}>
        <main className={styles.main}>
          <HeroBanner onBrowse={browseGames} />
          <section className={styles.categories} aria-label="게임 카테고리">
            <div ref={categoryListRef} className={styles.categoryList}>
              {gameCategories.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={category === item.id}
                  className={`${styles.category} ${category === item.id ? styles.selectedCategory : ""}`}
                  onClick={() => setCategory(item.id)}
                >
                  <span
                    className={`${styles.categoryIcon} ${styles[item.color]}`}
                  >
                    <LobbyIcon name={item.icon} />
                  </span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
            <button
              className={styles.categoryNext}
              type="button"
              aria-label="다음 카테고리 보기"
              onClick={() =>
                categoryListRef.current?.scrollBy({
                  left: 250,
                  behavior: window.matchMedia(
                    "(prefers-reduced-motion: reduce)",
                  ).matches
                    ? "instant"
                    : "smooth",
                })
              }
            >
              <LobbyIcon name="chevron" />
            </button>
          </section>
          <section
            id="game-catalog"
            ref={gamesRef}
            className={styles.catalog}
            tabIndex={-1}
            aria-labelledby="catalog-title"
          >
            <div className={styles.catalogHeading}>
              <h2 id="catalog-title">
                {catalogTitle}
                <span>{games.length}</span>
              </h2>
            </div>
            <div className={styles.srOnly} role="status" aria-atomic="true">
              {categoryLabel} 카테고리, {games.length}개의 게임
              {normalizedQuery && `, 검색어 ${query}`}
            </div>
            {games.length > 0 ? (
              <div className={styles.gameGrid}>
                {games.map((game) => (
                  // 새 게임 카드도 공통 호버·키보드 포커스 테두리를 그대로 사용한다.
                  <article
                    data-hover-frame
                    className={styles.gameCard}
                    key={game.id}
                  >
                    <Link
                      className={styles.gameCardButton}
                      href="/games/gomoku"
                      aria-label={`${game.title} 방 목록 보기`}
                    >
                      <div className={styles.gameCover}>
                        <GomokuCover />
                        <span className={styles.comingSoon}>방 둘러보기</span>
                        <span className={styles.gameHover}>
                          <LobbyIcon name="arrow" />
                        </span>
                      </div>
                      <div className={styles.gameInfo}>
                        <h3>{game.title}</h3>
                        <p>
                          <LobbyIcon name="users" />
                          함께 즐기는 한 수의 승부
                        </p>
                        <div className={styles.gameTags}>
                          {game.tags.map((tag) => (
                            <span key={tag}>{tag}</span>
                          ))}
                        </div>
                      </div>
                    </Link>
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.emptyResults}>
                <span>
                  <LobbyIcon name="search" />
                </span>
                <h3>
                  {normalizedQuery
                    ? "찾으시는 게임이 아직 없어요"
                    : "새로운 게임을 준비하고 있어요"}
                </h3>
                <p>다른 카테고리를 둘러보거나 검색어를 바꿔보세요.</p>
                <button type="button" onClick={resetFilters}>
                  전체 게임 보기
                  <LobbyIcon name="arrow" />
                </button>
              </div>
            )}
          </section>
        </main>
        <aside className={styles.desktopChat}>
          <ChatPanel active />
        </aside>
      </div>
      {/* 공통 푸터는 게임·채팅 열 밖에 배치해 전체 폭을 사용하고 채팅 패널과 겹치지 않게 한다. */}
      <footer className={styles.footer}>
        <span>Playground</span>
        <p>함께라서 더 즐거운 우리들의 놀이터.</p>
        <small>© {new Date().getFullYear()} Playground</small>
      </footer>
      <button
        className={styles.mobileChatToggle}
        type="button"
        aria-label="실시간 채팅 열기"
        onClick={() => {
          const dialog = mobileChatRef.current;
          showModalWithoutCloseFocus(dialog);
          setMobileChatOpen(true);
          if (!dialog) return;
          const focusSurface = () => {
            const view = dialog.ownerDocument.defaultView;
            if (!dialog.isConnected || !view?.matchMedia("(hover: none) and (pointer: coarse)").matches) return;
            if (!dialog.hasAttribute("tabindex")) dialog.tabIndex = -1;
            dialog.focus({ preventScroll: true });
          };
          focusSurface();
          dialog.ownerDocument.defaultView?.requestAnimationFrame(focusSurface);
        }}
      >
        <LobbyIcon name="chat" />
        <span>채팅</span>
      </button>
      <dialog
        ref={mobileChatRef}
        className={styles.mobileChatDialog}
        aria-label="실시간 채팅"
        onClose={() => setMobileChatOpen(false)}
      >
        <ChatPanel
          active={mobileChatOpen}
          onClose={() => mobileChatRef.current?.close()}
        />
      </dialog>
      {notice && (
        <NoticeDialog notice={notice} onClose={() => setNotice(undefined)} />
      )}
    </div>
  );
}
