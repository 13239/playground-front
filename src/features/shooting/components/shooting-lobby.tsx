"use client";
import { useEffect, useState } from "react";
import type { Mode } from "@playground/shooting-shared";
import { Icon } from "@/components/ui/icon";
import { SearchInput } from "@/components/ui/search-input";
import { ProfileAvatar } from "@/features/profile/components/profile-avatar";
import { NumberedPagination } from "@/features/admin/components/numbered-pagination";
import { AuthRequestError } from "@/features/auth/client/api";
import { readShootingRooms, watchShootingLobby } from "../client/api";
import type { ShootingRooms, ShootingRoomSummary } from "../contracts";
import type { RoomOptions } from "../client/runtime";
import { ShootingCreateRoom } from "./shooting-create-room";
import { JoinRoomDialog } from "./join-room-dialog";
import { ShootingNotice } from "./shooting-notice";
import { ShootingCover } from "./shooting-cover";
import styles from "./lobby.module.css";

/** 방 탐색은 전투 전 화면에만 표시한다. 작은 화면에서는 단일 열로 재배치하고 읽을 수 있는 크기를 지킨다. */
export function ShootingLobby({
  sessionId,
  mode,
  setMode,
  connect,
  message,
  dismissMessage,
  initialRoomCode,
  clearInitialRoom,
}: {
  sessionId: string;
  mode: Mode;
  setMode: (mode: Mode) => void;
  connect: (mode: Mode, code?: string, settings?: RoomOptions) => void;
  message: string;
  dismissMessage(): void;
  initialRoomCode?: string;
  clearInitialRoom(): void;
}) {
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState<{
    code: string;
    title: string;
    optional?: boolean;
  }>();
  const selectedRoom =
    joining ??
    (initialRoomCode
      ? { code: initialRoomCode, title: "초대받은 방 참가", optional: true }
      : undefined);
  if (creating)
    return (
      <ShootingCreateRoom
        cancel={() => setCreating(false)}
        create={(settings) => connect("COOP", undefined, settings)}
      />
    );
  return (
    <div className={styles.lobby}>
      <div className={styles.modeTabs} aria-label="플레이 모드">
        <button
          type="button"
          aria-pressed={mode === "SINGLE"}
          onClick={() => setMode("SINGLE")}
        >
          <Icon name="user" />
          1인 도전
        </button>
        <button
          type="button"
          aria-pressed={mode === "COOP"}
          onClick={() => setMode("COOP")}
        >
          <Icon name="users" />
          2인 협동
        </button>
      </div>
      <p className={styles.tagline}>
        {mode === "COOP"
          ? "함께 더 높은 스테이지에 도전하세요."
          : "정밀한 조준과 과감한 회피로 최고 기록에 도전하세요."}
      </p>
      {message && <ShootingNotice message={message} dismiss={dismissMessage} />}
      <div className={styles.content} data-solo={mode === "SINGLE"}>
        <aside className={styles.introduction}>
          <div className={styles.cover}>
            <ShootingCover />
          </div>
          <h2>{mode === "COOP" ? "둘이서, 더 멀리" : "끝까지 살아남아라"}</h2>
          <p>
            {mode === "COOP"
              ? "공격과 방어를 나누고 서로를 지키며 더 높은 스테이지에 도전하세요."
              : "네 가지 무기와 나만의 강화 조합으로 끝없는 전장에 도전하세요."}
          </p>
          <div className={styles.facts}>
            <span>
              <Icon name="target" />
              직접 조준 · 빠른 전투
            </span>
            <span>
              <Icon name="refresh" />
              매번 새롭게 시작
            </span>
            <span>
              <Icon name="shield" />
              5스테이지마다 보스
            </span>
          </div>
          {mode === "COOP" && (
            <button
              type="button"
              className={styles.codeToggle}
              aria-expanded={showCode}
              onClick={() => setShowCode((v) => !v)}
            >
              방 코드로 참가
            </button>
          )}
          {showCode && mode === "COOP" && (
            <form
              className={styles.codeForm}
              onSubmit={(event) => {
                event.preventDefault();
                if (/^[A-Z2-9]{8}$/.test(code))
                  setJoining({ code, title: "방 코드로 참가", optional: true });
              }}
            >
              <label htmlFor="shooting-code">8자리 방 코드</label>
              <div data-focus-frame>
                <input
                  id="shooting-code"
                  value={code}
                  maxLength={8}
                  autoComplete="off"
                  autoCapitalize="characters"
                  onChange={(event) =>
                    setCode(
                      event.target.value
                        .toUpperCase()
                        .replace(/[^A-Z2-9]/g, ""),
                    )
                  }
                />
                <button type="submit" disabled={code.length !== 8}>
                  참가
                </button>
              </div>
            </form>
          )}
          {mode === "SINGLE" && (
            <button
              className={styles.primary}
              onClick={() => connect("SINGLE")}
            >
              새 도전 시작
              <Icon name="arrowRight" />
            </button>
          )}
        </aside>
        {mode === "COOP" && (
          <RoomBrowser
            sessionId={sessionId}
            create={() => setCreating(true)}
            join={(room) =>
              room.privateRoom
                ? setJoining({ code: room.id, title: room.title })
                : connect("COOP", room.id)
            }
          />
        )}
      </div>
      {selectedRoom && (
        <JoinRoomDialog
          {...selectedRoom}
          close={() => {
            setJoining(undefined);
            clearInitialRoom();
          }}
          join={(password) => {
            connect("COOP", selectedRoom.code, { password });
            clearInitialRoom();
          }}
        />
      )}
    </div>
  );
}

/** 변경 알림으로 즉시 갱신한다. 유실 알림 복구를 위한 낮은 빈도의 조회는 보이는 탭에서만 수행한다. */
function RoomBrowser({
  sessionId,
  create,
  join,
}: {
  sessionId: string;
  create(): void;
  join(room: ShootingRoomSummary): void;
}) {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [friendsOnly, setFriendsOnly] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    data?: ShootingRooms;
    error?: string;
  }>();
  const key = `${sessionId}:${page}:${search}:${friendsOnly}`;
  useEffect(() => {
    const controller = new AbortController();
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let retry = 0;
    // 변경 폭주를 합쳐 서버의 사용자별 목록 조회 예산을 지킨다. 필터와 현재 페이지는 유지한다.
    const changed = () => {
      if (refreshTimer) return;
      refreshTimer = setTimeout(() => {
        refreshTimer = undefined;
        if (!document.hidden) setEpoch((v) => v + 1);
      }, 750);
    };
    const listen = async () => {
      try {
        await watchShootingLobby(sessionId, controller.signal, () => {
          retry = 0;
          changed();
        });
      } catch (error) {
        if (
          controller.signal.aborted ||
          (error instanceof AuthRequestError && error.status === 401)
        )
          return;
      }
      if (!controller.signal.aborted)
        retryTimer = setTimeout(
          () => void listen(),
          Math.min(10_000, 1000 * 2 ** retry++),
        );
    };
    void listen();
    return () => {
      controller.abort();
      clearTimeout(refreshTimer);
      clearTimeout(retryTimer);
    };
  }, [sessionId]);
  useEffect(() => {
    let stopped = false;
    let controller: AbortController | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      clearTimeout(timer);
      if (stopped || document.visibilityState !== "visible") return;
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      try {
        const data = await readShootingRooms(
          sessionId,
          page,
          search,
          friendsOnly,
          signal,
        );
        if (!signal.aborted && !stopped) setResult({ key, data });
      } catch (error) {
        if (!signal.aborted && !stopped)
          setResult({
            key,
            error:
              error instanceof AuthRequestError
                ? error.message
                : "방 목록을 불러오지 못했어요.",
          });
      } finally {
        if (!stopped && !signal.aborted)
          timer = setTimeout(() => void load(), 30_000);
      }
    };
    const visible = () => {
      if (document.visibilityState === "visible") void load();
      else {
        clearTimeout(timer);
        controller?.abort();
      }
    };
    void load();
    document.addEventListener("visibilitychange", visible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", visible);
    };
  }, [sessionId, page, search, friendsOnly, key, epoch]);
  const current = result?.key === key ? result : undefined;
  return (
    <section className={styles.browser} aria-label="참가 가능한 협동 방">
      <div className={styles.heading}>
        <div>
          <h2>참가 가능한 방</h2>
          <small>
            {current?.data
              ? `대기 중인 방 ${current.data.total}개`
              : "온라인 2인 협동"}
          </small>
        </div>
        <button className={styles.primary} onClick={create}>
          <Icon name="plus" />방 만들기
        </button>
      </div>
      <div className={styles.searchRow}>
        <SearchInput
          label="협동 방 검색"
          placeholder="방 이름 또는 닉네임 검색"
          value={query}
          maxLength={50}
          onChange={(event) => setQuery(event.target.value)}
          onSearch={() => {
            setPage(1);
            setSearch(query.trim());
            setEpoch((v) => v + 1);
          }}
        />
        <button
          type="button"
          aria-label="방 목록 새로고침"
          onClick={() => setEpoch((v) => v + 1)}
        >
          <Icon name="refresh" />
        </button>
      </div>
      <div className={styles.filters}>
        <button
          aria-pressed={!friendsOnly}
          onClick={() => {
            setFriendsOnly(false);
            setPage(1);
          }}
        >
          전체
        </button>
        <button
          aria-pressed={friendsOnly}
          onClick={() => {
            setFriendsOnly(true);
            setPage(1);
          }}
        >
          친구가 있는 방
        </button>
      </div>
      {current?.error ? (
        <ShootingNotice
          message={current.error}
          dismiss={() => setResult({ key, data: current.data })}
        />
      ) : !current?.data ? (
        <p className={styles.empty} role="status">
          방 목록을 불러오고 있어요.
        </p>
      ) : current.data.items.length === 0 ? (
        <div className={styles.empty}>
          <Icon name="users" />
          <strong>
            {friendsOnly
              ? "대기 중인 친구의 방이 없어요"
              : "아직 대기 중인 방이 없어요"}
          </strong>
          <span>방을 만들고 친구를 초대해 보세요.</span>
        </div>
      ) : (
        <ul className={styles.rooms}>
          {current.data.items.map((room) => (
            <li key={room.id} className={styles.room}>
              <span className={styles.avatar}>
                <ProfileAvatar avatarId={room.avatar} size={48} />
              </span>
              <div className={styles.identity}>
                <strong>
                  {room.title}
                  {room.privateRoom && (
                    <span className={styles.roomLock} aria-label="비밀방">
                      <Icon name="lock" />
                    </span>
                  )}
                </strong>
                <small>
                  {room.nickname}
                  {room.friend && <b>친구</b>}
                </small>
              </div>
              <span className={styles.roomState}>대기 중</span>
              <span className={styles.count}>
                <Icon name="users" />1 / 2
              </span>
              <button
                className={styles.joinButton}
                onClick={() => join(room)}
                aria-label={`${room.nickname}님의 방 참가`}
              >
                참가
              </button>
            </li>
          ))}
        </ul>
      )}
      {current?.data && current.data.totalPages > 1 && (
        <NumberedPagination
          page={current.data.page}
          totalPages={current.data.totalPages}
          change={setPage}
          label="슈팅 협동 방 목록 페이지"
        />
      )}
      <p className={styles.footnote}>
        방에 참가한 뒤 무기를 선택하고 준비하세요.
      </p>
    </section>
  );
}
