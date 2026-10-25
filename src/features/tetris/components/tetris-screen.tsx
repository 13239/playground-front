"use client";

import Link from "next/link";
import { createUuidV4 } from "@/lib/client/uuid";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import {
  revalidateAuthSession,
  useAuthSession,
} from "@/features/auth/client/session-store";
import { AuthRequestError } from "@/features/auth/client/api";
import { GameEntryGate } from "@/features/games/components/game-entry-gate";
import { useGameDetails } from "@/features/games/components/game-catalog-provider";
import type { Overview, TetrisRun } from "../contracts";
import { finishRun, readOverview, startRun } from "../client/api";
import { TetrisRuntime, type GameView } from "../engine/runtime";
import type { Action } from "../engine/rules";
import { PiecePreview } from "./piece-preview";
import { TetrisIcon } from "./tetris-icon";
import { TetrisDialog } from "./tetris-dialog";
import styles from "./tetris.module.css";

const format = (value: number) => value.toLocaleString("ko-KR");
const INITIAL: GameView = {
  phase: "ready",
  score: 0,
  lines: 0,
  level: 1,
  hold: 0,
  holdUsed: false,
  next: [0, 0, 0, 0, 0],
};

/** 계정이 바뀌면 렌더러·시드·미제출 기록을 함께 폐기하며 직접 주소 접근에도 공통 시작 정책을 확인한다. */
export function TetrisScreen() {
  const auth = useAuthSession();
  if (auth.status !== "authenticated")
    return (
      <section className={styles.status} role="status">
        <h1>테트리스</h1>
        <p>
          {auth.status === "error"
            ? auth.message
            : auth.status === "anonymous"
              ? "로그인 후 게임을 즐겨 주세요."
              : "로그인 상태를 확인하고 있어요."}
        </p>
        {auth.status === "error" && (
          <button className={styles.primary} onClick={revalidateAuthSession}>
            다시 확인
          </button>
        )}
        {auth.status === "anonymous" && <Link href="/login">로그인하기</Link>}
      </section>
    );
  return (
    <GameEntryGate
      key={auth.session.sessionId}
      game="TETRIS"
      mode="SINGLE"
      sessionId={auth.session.sessionId}
    >
      <TetrisGame sessionId={auth.session.sessionId} />
    </GameEntryGate>
  );
}

/** 시안의 게임 영역과 TOP 100만 제공한다. 별도 내 기록 카드와 순위 범위/전체 인원 문구는 표시하지 않는다. */
function TetrisGame({ sessionId }: { sessionId: string }) {
  const details = useGameDetails();
  const name = details.game?.name ?? "테트리스";
  const [view, setView] = useState(INITIAL);
  const [runtime] = useState(() => new TetrisRuntime(setView));
  const [overview, setOverview] = useState<Overview>();
  const [loading, setLoading] = useState(true);
  const [recordError, setRecordError] = useState("");
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);
  const [engineError, setEngineError] = useState("");
  const [engineAttempt, setEngineAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [saveState, setSaveState] = useState<
    "none" | "saving" | "saved" | "error" | "unavailable"
  >("none");
  const [dialog, setDialog] = useState<"settings" | "restart">();
  const [sound, setSound] = useState(true);
  const [ghost, setGhost] = useState(true);
  const host = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const mounted = useRef(false);
  const run = useRef<TetrisRun | undefined>(undefined);
  const saved = useRef(false);
  const unrecordable = useRef(false);
  const saving = useRef<Promise<boolean> | undefined>(undefined);
  const actionLock = useRef(false);
  const startId = useRef<string | undefined>(undefined);
  const query = useRef<AbortController | undefined>(undefined);
  const resumeAfterDialog = useRef(false);

  const loadRecords = useCallback(
    async (page = 1) => {
      query.current?.abort();
      const controller = new AbortController();
      query.current = controller;
      setLoading(true);
      setRecordError("");
      try {
        const value = await readOverview(sessionId, page, controller.signal);
        if (!controller.signal.aborted) setOverview(value);
      } catch (error) {
        if (!controller.signal.aborted) {
          setRecordError(
            error instanceof AuthRequestError
              ? error.message
              : "기록을 불러오지 못했습니다.",
          );
          if (error instanceof AuthRequestError && error.status === 401)
            revalidateAuthSession();
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [sessionId],
  );

  const save = useCallback((): Promise<boolean> => {
    if (saving.current) return saving.current;
    if (!run.current || !runtime.game.ticks || saved.current)
      return Promise.resolve(true);
    setSaveState("saving");
    const current = run.current;
    saving.current = finishRun(
      sessionId,
      current.runId,
      runtime.game.ticks,
      runtime.inputs,
    )
      .then((value) => {
        saved.current = true;
        if (mounted.current) {
          query.current?.abort();
          setLoading(false);
          setOverview(value);
          setSaveState("saved");
          setMessage("");
          setRecordError("");
        }
        return true;
      })
      .catch((error) => {
        if (mounted.current) {
          // 이미 교체되었거나 검증이 거절된 판은 재전송으로 복구되지 않는다. 새 게임 시작은 계속 허용한다.
          unrecordable.current =
            error instanceof AuthRequestError &&
            ["TETRIS_RUN_CHANGED", "TETRIS_REPLAY_INVALID"].includes(
              error.code ?? "",
            );
          setSaveState(unrecordable.current ? "unavailable" : "error");
          setMessage(
            error instanceof AuthRequestError
              ? error.message
              : "기록을 저장하지 못했습니다. 다시 시도해 주세요.",
          );
          if (error instanceof AuthRequestError && error.status === 401)
            revalidateAuthSession();
        }
        return false;
      })
      .finally(() => {
        saving.current = undefined;
      });
    return saving.current;
  }, [runtime, sessionId]);

  useEffect(() => {
    runtime.onFinished(() => {
      void save();
    });
  }, [runtime, save]);
  useEffect(() => {
    mounted.current = true;
    runtime.activate();
    const parent = host.current;
    let canceled = false,
      destroy: (() => void) | undefined;
    if (parent)
      void import("../engine/phaser-board")
        .then((module) => {
          if (!canceled) {
            destroy = module.createBoard(parent, runtime);
            setReady(true);
          }
        })
        .catch(() => {
          if (!canceled) setEngineError("게임 화면을 불러오지 못했습니다.");
        });
    const keydown = (event: KeyboardEvent) => runtime.keyDown(event),
      keyup = (event: KeyboardEvent) => runtime.keyUp(event);
    const pause = () => runtime.pause();
    const visibility = () => {
      if (document.hidden) pause();
    };
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", pause);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      canceled = true;
      mounted.current = false;
      destroy?.();
      runtime.dispose();
      query.current?.abort();
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", pause);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [runtime, engineAttempt]);
  useEffect(() => {
    // 최초 조회는 응답 구독에서만 상태를 바꾸고 렌더 직후 동기 상태 갱신을 만들지 않는다.
    const controller = new AbortController();
    query.current = controller;
    void readOverview(sessionId, 1, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setOverview(value);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setRecordError(
            error instanceof AuthRequestError
              ? error.message
              : "기록을 불러오지 못했습니다.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [sessionId]);
  useEffect(() => {
    document.title = `${name} | Playground`;
  }, [name]);

  async function begin() {
    if (actionLock.current || !ready) return;
    actionLock.current = true;
    setBusy(true);
    setMessage("");
    runtime.unlockAudio();
    try {
      runtime.stop();
      if (!(await save()) && !unrecordable.current) return;
      // 기존 보안 난수 UUID 도우미로 원격 dev HTTP에서도 같은 멱등 식별자를 생성한다.
      startId.current ??= createUuidV4();
      const value = await startRun(sessionId, startId.current);
      if (!mounted.current) return;
      startId.current = undefined;
      run.current = value;
      saved.current = false;
      unrecordable.current = false;
      setSaveState("none");
      setMessage("");
      runtime.begin(value.seed);
      // 시작 횟수는 서버에서 읽으며 로컬에서 추정해 누적하지 않는다.
      void loadRecords(overview?.page ?? 1);
      host.current?.focus({ preventScroll: true });
    } catch (error) {
      if (mounted.current)
        setMessage(
          error instanceof AuthRequestError
            ? error.message
            : "게임을 시작하지 못했습니다. 다시 시도해 주세요.",
        );
      if (error instanceof AuthRequestError && error.status === 401)
        revalidateAuthSession();
    } finally {
      actionLock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function openDialog(type: "settings" | "restart") {
    resumeAfterDialog.current = runtime.phase === "playing";
    runtime.pause();
    setDialog(type);
  }
  function closeDialog() {
    setDialog(undefined);
    if (resumeAfterDialog.current && runtime.phase === "paused")
      runtime.togglePause();
    // 모달이 닫힌 다음 프레임에 게임판으로 돌아가야 네이티브 포커스 복원과 충돌하지 않는다.
    requestAnimationFrame(() => host.current?.focus({ preventScroll: true }));
  }
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (panel.current?.requestFullscreen)
        await panel.current.requestFullscreen();
      else setMessage("이 브라우저에서는 전체 화면을 지원하지 않습니다.");
    } catch {
      setMessage("전체 화면을 열지 못했습니다. 브라우저 설정을 확인해 주세요.");
    }
  }
  function press(event: PointerEvent<HTMLButtonElement>, action: Action) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    runtime.press(action);
  }
  const active = view.phase === "playing" || view.phase === "paused";
  return (
    <>
      <nav className={styles.breadcrumb} aria-label="현재 위치">
        <Link href="/">홈</Link>
        <span>/</span>
        <span>{name}</span>
      </nav>
      <div className={styles.title}>
        <h1>{name}</h1>
        <span>1인 플레이</span>
      </div>
      <section className={styles.stats} aria-label="내 테트리스 통계">
        <Stat
          icon="crown"
          label="내 최고 점수"
          value={overview ? format(overview.bestScore) : "—"}
        />
        <Stat
          icon="chart"
          label="내 순위"
          value={overview?.rank ? `${format(overview.rank)}위` : "—"}
        />
        <Stat
          icon="gamepad"
          label="플레이 횟수"
          value={overview ? `${format(overview.plays)}회` : "—"}
        />
      </section>
      <div className={styles.columns}>
        <section
          className={styles.gameCard}
          ref={panel}
          aria-label="테트리스 싱글 플레이"
        >
          <header className={styles.cardHeader}>
            <h2>싱글 플레이</h2>
            <div className={styles.tools}>
              <button
                type="button"
                aria-label={sound ? "소리 끄기" : "소리 켜기"}
                aria-pressed={sound}
                onClick={() => {
                  runtime.setSound(!sound);
                  setSound(!sound);
                  runtime.unlockAudio();
                }}
              >
                <TetrisIcon name={sound ? "sound" : "muted"} />
              </button>
              <button
                type="button"
                aria-label="게임 설정"
                onClick={() => openDialog("settings")}
              >
                <TetrisIcon name="settings" />
              </button>
              <button
                type="button"
                aria-label="전체 화면 전환"
                onClick={() => void fullscreen()}
              >
                <TetrisIcon name="expand" />
              </button>
            </div>
          </header>
          <div className={styles.stage}>
            <aside className={styles.leftRail} aria-label="홀드와 현재 점수">
              <div className={styles.railHeading}>
                <strong>HOLD</strong>
                <kbd>C</kbd>
                <small>홀드</small>
              </div>
              <div className={styles.hold} data-used={view.holdUsed}>
                <PiecePreview type={view.hold} />
              </div>
              <dl className={styles.metrics}>
                <div>
                  <dt>점수</dt>
                  <dd aria-live="off">{format(view.score)}</dd>
                </div>
                <div>
                  <dt>레벨</dt>
                  <dd>{view.level}</dd>
                </div>
                <div>
                  <dt>제거한 줄</dt>
                  <dd>{view.lines}</dd>
                </div>
              </dl>
              <div className={styles.gameActions}>
                <button
                  type="button"
                  className={styles.pause}
                  disabled={!active || busy || !!dialog}
                  onClick={() => {
                    runtime.togglePause();
                    host.current?.focus({ preventScroll: true });
                  }}
                >
                  <TetrisIcon
                    name={view.phase === "paused" ? "play" : "pause"}
                  />
                  {view.phase === "paused" ? "계속하기" : "일시정지"}
                </button>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={!ready || busy || !!dialog}
                  onClick={() =>
                    active ? openDialog("restart") : void begin()
                  }
                >
                  <TetrisIcon
                    name={view.phase === "ready" ? "play" : "restart"}
                  />
                  {busy
                    ? "준비 중…"
                    : view.phase === "ready"
                      ? "게임 시작"
                      : "다시 시작"}
                </button>
              </div>
            </aside>
            <div className={styles.boardWrap}>
              <div
                ref={host}
                className={styles.board}
                tabIndex={0}
                role="application"
                aria-label="테트리스 게임판. 방향키로 이동과 회전, Space로 바로 놓기, C로 홀드, P로 일시정지"
              />
              {(view.phase !== "playing" || !ready) && (
                <div className={styles.overlay}>
                  <span className={styles.overlayMark}>
                    <TetrisIcon
                      name={
                        view.phase === "paused"
                          ? "pause"
                          : view.phase === "over"
                            ? "trophy"
                            : "gamepad"
                      }
                    />
                  </span>
                  <h3>
                    {engineError
                      ? "화면을 확인해 주세요"
                      : !ready
                        ? "게임 준비 중"
                        : view.phase === "ready"
                          ? "READY TO PLAY"
                          : view.phase === "paused"
                            ? "잠시 쉬어가요"
                            : "GAME OVER"}
                  </h3>
                  <p>
                    {engineError ||
                      (!ready
                        ? "게임 화면을 불러오고 있어요"
                        : view.phase === "ready"
                          ? "나만의 최고 기록에 도전하세요"
                          : view.phase === "paused"
                            ? "준비되면 이어서 플레이하세요"
                            : `${format(view.score)}점 · ${view.lines}줄 제거`)}
                  </p>
                  {engineError ? (
                    <button
                      className={styles.primary}
                      onClick={() => {
                        setEngineError("");
                        setEngineAttempt((value) => value + 1);
                      }}
                    >
                      다시 불러오기
                    </button>
                  ) : (
                    ready && (
                      <button
                        className={styles.primary}
                        disabled={busy || !!dialog || saveState === "saving"}
                        onClick={() => {
                          if (view.phase === "paused") {
                            runtime.togglePause();
                            host.current?.focus();
                          } else void begin();
                        }}
                      >
                        {busy
                          ? "준비 중…"
                          : view.phase === "paused"
                            ? "계속하기"
                            : view.phase === "over"
                              ? "한 판 더 하기"
                              : "게임 시작"}
                      </button>
                    )
                  )}
                  {view.phase === "over" && (
                    <p role="status">
                      {saveState === "saving"
                        ? "기록 저장 중…"
                        : saveState === "saved"
                          ? "기록이 저장되었어요"
                          : saveState === "error"
                            ? "기록 저장을 다시 시도해 주세요"
                            : saveState === "unavailable"
                              ? "이 게임의 기록을 저장할 수 없어요"
                              : ""}
                    </p>
                  )}
                  {saveState === "error" && (
                    <button
                      className={styles.retry}
                      disabled={busy}
                      onClick={() => void save()}
                    >
                      기록 저장 다시 시도
                    </button>
                  )}
                </div>
              )}
            </div>
            <aside className={styles.rightRail} aria-label="다음 블록 5개">
              <div className={styles.railHeading}>
                <strong>NEXT</strong>
                <small>다음 블록</small>
              </div>
              <ol className={styles.next}>
                {view.next.map((type, index) => (
                  <li key={index}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <PiecePreview type={type} />
                  </li>
                ))}
              </ol>
            </aside>
          </div>
          {/* 좁은 화면에서는 주요 버튼을 보드 밖에 배치해 최소 터치 크기와 판 높이를 함께 확보한다. */}
          <div className={styles.mobileActions}>
            <button
              type="button"
              className={styles.secondary}
              disabled={!active || busy || !!dialog}
              onClick={() => {
                runtime.togglePause();
                host.current?.focus({ preventScroll: true });
              }}
            >
              <TetrisIcon name={view.phase === "paused" ? "play" : "pause"} />
              {view.phase === "paused" ? "계속하기" : "일시정지"}
            </button>
            <button
              type="button"
              className={styles.primary}
              disabled={!ready || busy || !!dialog}
              onClick={() => (active ? openDialog("restart") : void begin())}
            >
              <TetrisIcon name={view.phase === "ready" ? "play" : "restart"} />
              {busy
                ? "준비 중…"
                : view.phase === "ready"
                  ? "게임 시작"
                  : "다시 시작"}
            </button>
          </div>
          <div className={styles.touchControls} aria-label="터치 조작">
            {(
              [
                ["LEFT", "←", "왼쪽"],
                ["RIGHT", "→", "오른쪽"],
                ["CW", "↻", "회전"],
                ["DOWN", "↓", "내리기"],
                ["HOLD", "C", "홀드"],
                ["DROP", "⤓", "바로 놓기"],
              ] as const
            ).map(([action, label, description]) => (
              <button
                key={action}
                type="button"
                disabled={view.phase !== "playing"}
                aria-label={description}
                onPointerDown={(event) => press(event, action)}
                onPointerUp={() => runtime.release(action)}
                onPointerCancel={() => runtime.release(action)}
                onLostPointerCapture={() => runtime.release(action)}
                onKeyDown={(event) => {
                  if (
                    (event.key === "Enter" || event.key === " ") &&
                    !event.repeat
                  ) {
                    event.preventDefault();
                    runtime.press(action);
                  }
                }}
                onKeyUp={() => runtime.release(action)}
                onBlur={() => runtime.release(action)}
              >
                <b>{label}</b>
                <small>{description}</small>
              </button>
            ))}
          </div>
          <div className={styles.shortcuts} aria-label="키보드 조작 안내">
            <span>
              <kbd>←</kbd>
              <kbd>→</kbd> 이동
            </span>
            <span>
              <kbd>↑</kbd> 회전
            </span>
            <span>
              <kbd>↓</kbd> 내리기
            </span>
            <span>
              <kbd>Space</kbd> 바로 놓기
            </span>
            <span>
              <kbd>C</kbd> 홀드
            </span>
            <span>
              <kbd>P</kbd> 일시정지
            </span>
          </div>
          {message && (
            <p className={styles.error} role="alert">
              {message}
            </p>
          )}
        </section>
        <section
          className={styles.rankingCard}
          aria-labelledby="tetris-ranking-title"
          aria-busy={loading}
        >
          <header className={styles.rankingTitle}>
            <TetrisIcon name="trophy" />
            <h2 id="tetris-ranking-title">점수 랭킹</h2>
            <span>TOP 100</span>
          </header>
          <p className={styles.subtitle}>유저별 최고 기록</p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">순위</th>
                  <th scope="col">닉네임</th>
                  <th scope="col">점수</th>
                </tr>
              </thead>
              <tbody>
                {overview?.rankings.map((row) => (
                  <tr key={row.rank} data-self={row.self}>
                    <td>
                      <span
                        className={styles.rank}
                        data-medal={row.rank <= 3 ? row.rank : undefined}
                      >
                        {row.rank}
                      </span>
                    </td>
                    <td>
                      {row.nickname}
                      {row.self && <small className={styles.me}>나</small>}
                    </td>
                    <td>{format(row.score)}</td>
                  </tr>
                ))}
                {!overview?.rankings.length && (
                  <tr>
                    <td colSpan={3} className={styles.empty}>
                      {loading
                        ? "기록을 불러오고 있어요"
                        : recordError
                          ? "기록을 불러오지 못했어요"
                          : "첫 번째 기록의 주인공이 되어 보세요"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {recordError && (
            <div className={styles.error} role="alert">
              <p>{recordError}</p>
              <button
                className={styles.retry}
                onClick={() => void loadRecords(overview?.page ?? 1)}
              >
                다시 불러오기
              </button>
            </div>
          )}
          <RankingPages
            page={overview?.page ?? 1}
            pages={overview?.totalPages ?? 1}
            loading={loading}
            change={(page) => void loadRecords(page)}
          />
        </section>
      </div>
      {dialog === "settings" && (
        <TetrisDialog title="게임 설정" close={closeDialog}>
          <label className={styles.setting}>
            <span>
              게임 소리<small>블록을 놓거나 줄을 지울 때 소리를 재생해요</small>
            </span>
            <input
              type="checkbox"
              checked={sound}
              onChange={(event) => {
                const value = event.target.checked;
                setSound(value);
                runtime.setSound(value);
                runtime.unlockAudio();
              }}
            />
          </label>
          <label className={styles.setting}>
            <span>
              고스트 블록<small>블록이 떨어질 위치를 미리 표시해요</small>
            </span>
            <input
              type="checkbox"
              checked={ghost}
              onChange={(event) => {
                setGhost(event.target.checked);
                runtime.setGhost(event.target.checked);
              }}
            />
          </label>
          <p className={styles.help}>
            10줄마다 레벨이 올라가요. ↑ / X는 시계 방향, Z는 반시계 방향
            회전이에요. 다른 창으로 이동하면 자동으로 일시정지돼요.
          </p>
          <button className={styles.primary} onClick={closeDialog}>
            확인
          </button>
        </TetrisDialog>
      )}
      {dialog === "restart" && (
        <TetrisDialog title="다시 시작할까요?" close={closeDialog}>
          <p>현재 점수를 기록하고 새 게임을 시작해요.</p>
          <div className={styles.dialogActions}>
            <button className={styles.secondary} onClick={closeDialog}>
              계속 플레이
            </button>
            <button
              className={styles.primary}
              onClick={() => {
                setDialog(undefined);
                void begin();
              }}
            >
              다시 시작
            </button>
          </div>
        </TetrisDialog>
      )}
    </>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: "crown" | "chart" | "gamepad";
  label: string;
  value: string;
}) {
  return (
    <div className={styles.stat}>
      <span className={styles.statIcon}>
        <TetrisIcon name={icon} />
      </span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

/** TOP 100을 10개씩 번호 페이지로 탐색하며 처음·이전·다음·마지막 이동을 모두 제공한다. */
function RankingPages({
  page,
  pages,
  loading,
  change,
}: {
  page: number;
  pages: number;
  loading: boolean;
  change: (page: number) => void;
}) {
  return (
    <nav className={styles.pagination} aria-label="점수 랭킹 페이지">
      <button
        aria-label="첫 페이지"
        disabled={loading || page === 1}
        onClick={() => change(1)}
      >
        «
      </button>
      <button
        aria-label="이전 페이지"
        disabled={loading || page === 1}
        onClick={() => change(page - 1)}
      >
        ‹
      </button>
      {Array.from({ length: pages }, (_, index) => index + 1).map((value) => (
        <button
          key={value}
          aria-label={`${value}페이지`}
          aria-current={value === page ? "page" : undefined}
          data-near={
            Math.abs(value - page) <= 1 || value === 1 || value === pages
          }
          disabled={loading}
          onClick={() => {
            if (value !== page) change(value);
          }}
        >
          {value}
        </button>
      ))}
      <button
        aria-label="다음 페이지"
        disabled={loading || page === pages}
        onClick={() => change(page + 1)}
      >
        ›
      </button>
      <button
        aria-label="마지막 페이지"
        disabled={loading || page === pages}
        onClick={() => change(pages)}
      >
        »
      </button>
    </nav>
  );
}
