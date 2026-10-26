"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  gameCategories,
  filterCategory,
  lobbyGame,
  type GameCategoryId,
  type LobbyGame,
} from "@/features/lobby/catalog";
import { showModalWithoutCloseFocus } from "@/lib/client/show-modal";
import { useGameCatalog, useGameFilters } from "@/features/games/client/use-game-catalog";
import { gameHref } from "@/features/games/implementations";
import { ChatPanel } from "./chat-panel";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { GomokuCover } from "./gomoku-cover";
import { TetrisCover } from "@/features/tetris/components/tetris-cover";
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
        {notice.game && notice.game.tags.length > 0 && (
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
  // 조건은 서버의 같은 모드 EXISTS 검색에 전달하고 정적 게임 목록을 중복 유지하지 않는다.
  const catalog = useGameCatalog(category, query);
  const filters = useGameFilters();
  const categories = [...gameCategories, ...filters.items.map(filterCategory)];
  const games = catalog.items.map(lobbyGame);
  // 넘친 카테고리만 화살표로 옮기고, 맨 앞·맨 뒤에서는 더 갈 수 없는 쪽을 끈다.
  const [categoryScroll, setCategoryScroll] = useState({ prev: false, next: false });
  useEffect(() => {
    const list = categoryListRef.current;
    if (!list) return;
    const update = () => {
      const prev = list.scrollLeft > 1;
      const next = list.scrollWidth - list.clientWidth - list.scrollLeft > 1;
      setCategoryScroll((current) => current.prev === prev && current.next === next ? current : { prev, next });
    };
    update();
    list.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(list);
    return () => {
      list.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [categories.length]);
  const categoryLabel =
    // 복귀 후 첫 장르 페이지를 다시 읽을 때 아직 조회하지 않은 선택 장르를 전체 필터로 잘못 표시하지 않는다.
    categories.find((value) => value.id === category)?.label ?? (category.startsWith("filter:") ? "선택한 필터" : "전체");
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

  function scrollCategories(direction: -1 | 1) {
    categoryListRef.current?.scrollBy({
      left: direction * 250,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  }

  return (
    <div className={`app-page ${styles.screen}`}>
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
            <button
              className={styles.categoryPrev}
              type="button"
              aria-label="이전 카테고리 보기"
              disabled={!categoryScroll.prev}
              onClick={() => scrollCategories(-1)}
            >
              <LobbyIcon name="chevron" />
            </button>
            <div ref={categoryListRef} className={styles.categoryList}>
              {categories.map((item) => (
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
              disabled={!categoryScroll.next}
              onClick={() => scrollCategories(1)}
            >
              <LobbyIcon name="chevron" />
            </button>
          </section>
          {filters.error && <p className={styles.catalogStatus} role="status">{filters.error} <button type="button" onClick={filters.retry}>다시 확인</button></p>}
          <section
            id="game-catalog"
            ref={gamesRef}
            className={styles.catalog}
            tabIndex={-1}
            aria-labelledby="catalog-title"
            aria-busy={catalog.loading}
          >
            <div className={styles.catalogHeading}>
              <h2 id="catalog-title">
                {catalogTitle}
                <span>{catalog.loading ? "…" : `${games.length}${catalog.hasMore ? "+" : ""}`}</span>
              </h2>
            </div>
            <div className={styles.srOnly} role="status" aria-atomic="true">
              {categoryLabel} 카테고리, {games.length}개의 게임
              {normalizedQuery && `, 검색어 ${query}`}
            </div>
            {catalog.loading ? <div className={styles.emptyResults} role="status"><p>게임 목록을 불러오고 있어요…</p></div> : games.length > 0 ? (
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
                      // 경로는 배포된 프론트 등록 목록에서만 결정한다. 아직 연결되지 않은 구현은 이동하지 않는다.
                      href={gameHref(game.id) ?? "/"}
                      aria-disabled={!gameHref(game.id)}
                      onClick={event => { if (!gameHref(game.id)) event.preventDefault(); }}
                      aria-label={`${game.title} 게임 보기`}
                    >
                      <div className={styles.gameCover}>
                        {/* 관리자 이미지 선택 없이 배포한 게임 코드에 맞는 기존 표지를 사용한다. */}
                        {/* 배포한 게임의 코드별 표지만 연결하고 엔진은 게임에 입장할 때 불러온다. */}
                        {game.id === "GOMOKU" ? <GomokuCover /> : game.id === "TETRIS" ? <TetrisCover /> : <div className={styles.genericCover}><LobbyIcon name="gamepad" /></div>}
                        {/* 입장 가능한 게임은 표지에 게임 보기를 붙이지 않고, 준비 중과 이용 안내만 표시한다. */}
                        {(!gameHref(game.id) || !game.available) && (
                          <span className={styles.comingSoon}>{!gameHref(game.id) ? "준비 중" : "이용 안내"}</span>
                        )}
                        <span className={styles.gameHover}>
                          <LobbyIcon name="arrow" />
                        </span>
                      </div>
                      <div className={styles.gameInfo}>
                        <h3 title={game.title}>{game.title}</h3>
                        <p>
                          <LobbyIcon name="users" />
                          {/* 두 줄을 넘는 소개는 카드 안에서 줄이고 전체 원문은 기본 툴팁으로 확인할 수 있다. */}
                          <span className={styles.gameDescription} title={game.description}>{game.description}</span>
                        </p>
                        {/* 라벨 요소는 선택이 있을 때만 만들고 높이는 공통 슬롯으로 동일하게 유지한다. */}
                        {game.tags.length > 0 && <div className={styles.gameTags} title={game.tags.join(", ")}>
                          {game.tags.map((tag) => (
                            <span key={tag} title={tag}>{tag}</span>
                          ))}
                        </div>}
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
                  {catalog.error ? "게임 목록을 확인하지 못했어요" : normalizedQuery
                    ? "찾으시는 게임이 아직 없어요"
                    : "새로운 게임을 준비하고 있어요"}
                </h3>
                <p>{catalog.error ?? "다른 카테고리를 둘러보거나 검색어를 바꿔보세요."}</p>
                <button type="button" onClick={catalog.error ? catalog.retry : resetFilters}>
                  {catalog.error ? "다시 확인" : "전체 게임 보기"}
                  <LobbyIcon name="arrow" />
                </button>
              </div>
            )}
            {!catalog.loading && games.length > 0 && catalog.error && <p className={styles.catalogStatus} role="status">{catalog.error} <button type="button" onClick={catalog.retry}>다시 확인</button></p>}
            {!catalog.loading && catalog.hasMore && <button type="button" className={styles.loadMoreGames} disabled={catalog.morePending} onClick={() => void catalog.loadMore()}>
              {catalog.morePending ? "불러오는 중…" : "게임 더 보기"}
            </button>}
          </section>
        </main>
        <aside className={styles.desktopChat}>
          <ChatPanel active />
        </aside>
      </div>
      {/* 공통 푸터는 게임·채팅 열 밖에 배치해 전체 폭을 사용하고 채팅 패널과 겹치지 않게 한다. */}
      <SiteFooter className={styles.footerClearance} />
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
