"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { LobbyIcon } from "@/app/_components/lobby/lobby-icon";
import { AuthRequestError } from "@/features/auth/client/api";
import {
  revalidateAuthSession,
  useAuthSession,
} from "@/features/auth/client/session-store";
import { ProfileAvatar } from "@/features/profile/components/profile-avatar";
import { searchRooms } from "../client/api";
import {
  ruleLabel,
  type HostedRoom,
  type RoomFilters,
  type RoomPage,
} from "../contracts";
import { HostedRoomDialog } from "./room-dialog";
import { InviteRoomEntry, JoinRoomDialog, type JoinTarget } from "./join-room";
import { RoomHero } from "./room-artwork";
import styles from "./gomoku.module.css";

/** 2단계의 초대 코드 입장은 실제 서버에 연결하고 아직 범위 밖인 빠른 매칭은 비활성 상태로 유지한다. */
function RoomSidebar() {
  return (
    <aside className={styles.sidebar} aria-label="오목 시작과 규칙">
      <section className={`${styles.panel} ${styles.startCard}`}>
        <Image
          src="/images/gomoku/cat-mascot.webp"
          className={styles.startCat}
          alt=""
          width={180}
          height={180}
          sizes="(max-width: 640px) 120px, 180px"
        />
        <h2>오목 시작하기</h2>
        <p>
          함께 둘 상대를 찾거나
          <br />
          직접 방을 만들어보세요.
        </p>
        <button
          className={styles.secondaryButton}
          type="button"
          disabled
          title="빠른 매칭을 준비하고 있어요"
        >
          <LobbyIcon name="lightning" />
          빠른 매칭 <small>준비 중</small>
        </button>
        <Link className={styles.primaryButton} href="/games/gomoku/create">
          <LobbyIcon name="plus" />방 만들기
        </Link>
      </section>
      <section className={styles.panel}>
        <h2>
          <LobbyIcon name="link" />
          초대 코드로 입장
        </h2>
        <p className={styles.muted}>친구에게 받은 6자리 코드를 입력하세요.</p>
        <InviteRoomEntry />
      </section>
      <section className={`${styles.panel} ${styles.rules}`}>
        <h2>
          <LobbyIcon name="book" />
          오목 게임 규칙 안내
        </h2>
        <dl>
          <div>
            <dt>
              <LobbyIcon name="users" />
              게임 인원
            </dt>
            <dd>2명</dd>
          </div>
          <div>
            <dt>
              <LobbyIcon name="board" />판 크기
            </dt>
            <dd>20 × 20</dd>
          </div>
          <div>
            <dt>
              <LobbyIcon name="clock" />턴 제한 시간
            </dt>
            <dd>30초</dd>
          </div>
          <div>
            <dt>
              <LobbyIcon name="copy" />
              첫판 선공
            </dt>
            <dd>시작 후 흑백 추첨</dd>
          </div>
          <div>
            <dt>
              <LobbyIcon name="undo" />
              재대국 선공
            </dt>
            <dd>직전 패자가 흑돌</dd>
          </div>
        </dl>
        <p>무르기와 금수 규칙은 방 설정을 따라요.</p>
      </section>
    </aside>
  );
}

/** 인증 상태가 바뀌면 이전 계정의 목록·본인 방 코드를 즉시 화면에서 분리한다. */
export function RoomList() {
  const auth = useAuthSession();
  return (
    <div className={styles.listLayout}>
      <div className={styles.listMain}>
        <RoomHero />
        <div className={styles.mobileActions}>
          <button type="button" className={styles.secondaryButton} disabled>
            빠른 매칭 · 준비 중
          </button>
          <Link className={styles.primaryButton} href="/games/gomoku/create">
            <LobbyIcon name="plus" />방 만들기
          </Link>
        </div>
        {auth.status === "authenticated" ? (
          <AuthenticatedRoomList
            key={auth.session.sessionId}
            sessionId={auth.session.sessionId}
          />
        ) : (
          <div className={styles.empty} role="status">
            <LobbyIcon name="board" />
            <h2>로그인 상태 확인 중</h2>
            <p>
              {auth.status === "error" ? auth.message : "잠시만 기다려 주세요."}
            </p>
            {auth.status === "error" && (
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={revalidateAuthSession}
              >
                다시 확인
              </button>
            )}
          </div>
        )}
      </div>
      <RoomSidebar />
    </div>
  );
}

function AuthenticatedRoomList({ sessionId }: { sessionId: string }) {
  const [filters, setFilters] = useState<RoomFilters>({
    query: "",
    publicOnly: false,
    waitingOnly: false,
    page: 0,
  });
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<RoomPage>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hostedRoom, setHostedRoom] = useState<HostedRoom>();
  const [joining, setJoining] = useState<JoinTarget>();
  useEffect(() => {
    let active = true;
    // 자동 폴링 대신 입력을 짧게 모아 검색하고 복귀·계정 변경은 공통 세션 경계에서 재조회한다.
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");
      void searchRooms(sessionId, filters)
        .then((result) => {
          if (active) setData(result);
        })
        .catch((failure) => {
          if (!active) return;
          setData(undefined);
          if (
            failure instanceof AuthRequestError &&
            (failure.status === 401 || failure.code === "LOGIN_SESSION_CHANGED")
          )
            revalidateAuthSession();
          setError(
            failure instanceof AuthRequestError
              ? failure.message
              : "방 목록을 불러오지 못했습니다.",
          );
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [sessionId, filters, revision]);

  const change = (patch: Partial<RoomFilters>) =>
    setFilters((current) => ({ ...current, ...patch, page: 0 }));
  const currentPage = data?.page ?? filters.page;
  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRevision((value) => value + 1);
  }

  return (
    <section className={styles.roomSection} aria-label="오목 방 찾기">
      <form className={styles.toolbar} role="search" onSubmit={submitSearch}>
        <button
          className={
            filters.publicOnly ? styles.filterButton : styles.activeFilter
          }
          type="button"
          aria-pressed={!filters.publicOnly}
          onClick={() => change({ publicOnly: false })}
        >
          <LobbyIcon name="grid" />
          전체
        </button>
        <button
          className={
            filters.publicOnly ? styles.activeFilter : styles.filterButton
          }
          type="button"
          aria-pressed={filters.publicOnly}
          onClick={() => change({ publicOnly: true })}
        >
          <LobbyIcon name="globe" />
          공개 방
        </button>
        <button
          className={
            filters.waitingOnly ? styles.activeFilter : styles.filterButton
          }
          type="button"
          aria-pressed={filters.waitingOnly}
          onClick={() => change({ waitingOnly: !filters.waitingOnly })}
        >
          대기 중인 방만 보기
        </button>
        <label className={styles.roomSearch}>
          <LobbyIcon name="search" />
          <span className={styles.srOnly}>방 제목 또는 초대 코드 검색</span>
          <input
            type="search"
            maxLength={30}
            value={filters.query}
            onChange={(event) => change({ query: event.target.value })}
            placeholder="방 제목 또는 초대 코드로 검색하세요."
            autoComplete="off"
          />
        </label>
      </form>
      {data?.hostedRoom && (
        <div className={styles.hostedNotice}>
          <p>
            <LobbyIcon name="gamepad" />
            <strong>내 방</strong>
            <span>{data.hostedRoom.title}</span>
          </p>
          <button
            className={styles.textButton}
            type="button"
            onClick={() => setHostedRoom(data.hostedRoom ?? undefined)}
          >
            초대 코드 · 방 관리 <LobbyIcon name="chevron" />
          </button>
        </div>
      )}
      <div className={styles.listStatus}>
        <span role="status">
          {loading
            ? "방 목록을 확인하고 있어요…"
            : data
              ? `${data.totalElements}개의 방`
              : "방 목록"}
        </span>
        <button
          className={styles.textButton}
          disabled={loading}
          onClick={() => setRevision((value) => value + 1)}
          type="button"
        >
          새로고침
        </button>
      </div>
      {data?.joinedRoom && <p className={styles.muted}>참여 중인 방: <Link className={styles.textButton} href={`/games/gomoku/rooms/${data.joinedRoom.id}`}>{data.joinedRoom.title} · 대기실로 돌아가기</Link></p>}
      <div
        aria-busy={loading}
        className={loading ? styles.loadingRows : undefined}
      >
        <div className={styles.tableHeader} aria-hidden="true">
          <span>방 이름</span>
          <span>호스트</span>
          <span>참여 인원</span>
          <span>게임 규칙</span>
          <span>상태</span>
          <span />
        </div>
        {error ? (
          <div className={styles.empty} role="alert">
            <LobbyIcon name="link" />
            <h2>방 목록을 불러오지 못했어요</h2>
            <p>{error}</p>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setRevision((value) => value + 1)}
            >
              다시 불러오기
            </button>
          </div>
        ) : !data ? (
          <div className={styles.empty} role="status">
            <LobbyIcon name="board" />
            <p>방 목록을 불러오는 중이에요.</p>
          </div>
        ) : data.rooms.length === 0 ? (
          <div className={styles.empty}>
            <LobbyIcon name="board" />
            <h2>
              {filters.query || filters.publicOnly || filters.waitingOnly
                ? "조건에 맞는 방이 없어요"
                : "첫 번째 오목 방을 만들어보세요"}
            </h2>
            <p>
              {filters.query
                ? "검색어 또는 필터를 바꿔보세요."
                : "원하는 규칙으로 나만의 방을 만들 수 있어요."}
            </p>
            <Link href="/games/gomoku/create" className={styles.primaryButton}>
              <LobbyIcon name="plus" />방 만들기
            </Link>
          </div>
        ) : (
          <ul className={styles.roomList}>
            {data.rooms.map((room) => (
              <li
                className={`${styles.roomRow} ${room.owned ? styles.ownedRoom : ""}`}
                key={room.id}
              >
                <div className={styles.roomIdentity}>
                  <div>
                    <h2 title={room.title}>{room.title}</h2>
                    {room.visibility === "PRIVATE" && (
                      <span className={styles.privateBadge}>
                        <LobbyIcon name="lock" />
                        비공개
                      </span>
                    )}
                  </div>
                </div>
                <div className={styles.host}>
                  <ProfileAvatar avatarId={room.hostAvatarId} size={64} />
                  <span title={room.hostNickname}>{room.hostNickname}</span>
                </div>
                <span
                  className={styles.players}
                  data-full={room.playerCount === 2}
                >
                  <LobbyIcon name="users" />
                  <span className={styles.srOnly}>참여 인원 </span>
                  {room.playerCount} / 2
                </span>
                <div className={styles.ruleBadges}>
                  <span>
                    <LobbyIcon name="undo" />
                    무르기 {room.undoLimit}회
                  </span>
                  <span>
                    <LobbyIcon name="scale" />
                    {ruleLabel(room.forbiddenRule)}
                  </span>
                </div>
                <span
                  className={styles.roomState}
                  data-playing={room.status === "PLAYING"}
                >
                  <i />
                  {room.status === "WAITING" ? "대기 중" : "게임 중"}
                </span>
                <button
                  type="button"
                  className={styles.entryButton}
                  disabled={room.status !== "WAITING" || room.playerCount === 2 && data.joinedRoom?.id !== room.id}
                  onClick={() => setJoining({ roomId: room.id, title: room.title, privateRoom: room.visibility === "PRIVATE" && data.joinedRoom?.id !== room.id })}
                  title={
                    room.owned
                      ? "내 대기실로 입장"
                      : "대기실 입장"
                  }
                >
                  {data.joinedRoom?.id === room.id ? "대기실로" : "입장"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {data && data.totalPages > 1 && (
        <nav className={styles.pagination} aria-label="방 목록 페이지">
          <button
            type="button"
            disabled={loading || currentPage === 0}
            aria-label="이전 페이지"
            onClick={() =>
              setFilters((current) => ({
                ...current,
                page: Math.max(0, currentPage - 1),
              }))
            }
          >
            ‹
          </button>
          {Array.from(
            { length: Math.min(5, data.totalPages) },
            (_, index) =>
              Math.min(
                Math.max(0, currentPage - 2),
                Math.max(0, data.totalPages - 5),
              ) + index,
          ).map((page) => (
            <button
              key={page}
              type="button"
              disabled={loading}
              className={page === currentPage ? styles.currentPage : undefined}
              aria-current={page === currentPage ? "page" : undefined}
              onClick={() => setFilters((current) => ({ ...current, page }))}
            >
              {page + 1}
            </button>
          ))}
          <button
            type="button"
            disabled={
              loading ||
              currentPage + 1 >= data.totalPages ||
              currentPage >= 1000
            }
            aria-label="다음 페이지"
            onClick={() =>
              setFilters((current) => ({ ...current, page: currentPage + 1 }))
            }
          >
            ›
          </button>
        </nav>
      )}
      {hostedRoom && (
        <HostedRoomDialog
          room={hostedRoom}
          sessionId={sessionId}
          onClose={() => setHostedRoom(undefined)}
          onRoomClosed={() => {
            setHostedRoom(undefined);
            setRevision((value) => value + 1);
          }}
        />
      )}
      {joining && <JoinRoomDialog key={"roomId" in joining ? joining.roomId : joining.inviteCode} sessionId={sessionId} target={joining} onClose={() => { setJoining(undefined); setRevision((value) => value + 1); }} />}
    </section>
  );
}
