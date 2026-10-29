"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RoomDialog } from "@/components/ui/game-dialog";
import { ShootingLobby } from "./shooting-lobby";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Mode } from "@playground/shooting-shared";
import { Icon } from "@/components/ui/icon";
import {
  useAuthSession,
  revalidateAuthSession,
} from "@/features/auth/client/session-store";
import { useGameDetails } from "@/features/games/components/game-catalog-provider";
import { ShootingRuntime } from "../client/runtime";
import { Battlefield, preloadBattlefield } from "./battlefield";
import { BattleHud } from "./battle-hud";
import { BattleMenus } from "./battle-menus";
import { BattleDialog } from "./battle-dialog";
import { Rankings } from "./rankings";
import styles from "./shooting.module.css";

/** 계정 변경·페이지 이탈 시 소켓과 렌더러를 함께 폐기한다. 다른 계정의 도전으로 이어지지 않는다. */
export function ShootingScreen({ roomCode }: { roomCode?: string }) {
  const auth = useAuthSession();
  if (auth.status !== "authenticated")
    return (
      <section className={styles.status} role="status">
        <span className={styles.eyebrow}>SHOOTING SURVIVAL</span>
        <h1>슈팅 서바이벌</h1>
        <p>
          {auth.status === "anonymous"
            ? "로그인하고 끝없는 전장에 도전하세요."
            : auth.status === "error"
              ? auth.message
              : "로그인 상태를 확인하고 있어요."}
        </p>
        {auth.status === "anonymous" ? (
          <Link href="/login" className={styles.primary}>
            로그인하기
          </Link>
        ) : (
          auth.status === "error" && (
            <button onClick={revalidateAuthSession}>다시 확인</button>
          )
        )}
      </section>
    );
  return (
    <ShootingGame
      key={auth.session.sessionId}
      sessionId={auth.session.sessionId}
      roomCode={roomCode}
    />
  );
}

function ShootingGame({
  sessionId,
  roomCode,
}: {
  sessionId: string;
  roomCode?: string;
}) {
  const router = useRouter();
  const attemptedRoom = useRef<string | undefined>(undefined);
  const [runtime] = useState(() => new ShootingRuntime());
  const view = useSyncExternalStore(
    runtime.subscribe,
    runtime.getView,
    runtime.getView,
  );
  const [mode, setMode] = useState<Mode>("SINGLE");
  const [rankingOpen, setRankingOpen] = useState(false);
  const [rankingMode, setRankingMode] = useState<Mode>("SINGLE");
  const [help, setHelp] = useState(false);
  const arena = useRef<HTMLElement>(null);
  const details = useGameDetails();
  const state = view.state,
    player = state?.players[view.id];
  const connected = ["connecting", "connected", "reconnecting"].includes(
    view.connection,
  );
  useEffect(() => {
    // 전투 시작 버튼을 누른 뒤 처음으로 큰 렌더링 코드를 내려받는 지연을 줄인다.
    void preloadBattlefield().catch(() => {
      /* 실제 표시가 실패하면 Battlefield의 재시도 화면에서 복구한다. */
    });
  }, []);
  useEffect(() => {
    const leaving = () => runtime.disconnect();
    window.addEventListener("pagehide", leaving);
    return () => {
      window.removeEventListener("pagehide", leaving);
      runtime.disconnect();
    };
  }, [runtime]);
  useEffect(() => {
    // 초대 링크·공통 팝업 수락 모두 같은 인증된 참가 흐름으로 들어온다. Strict Mode의 폐기된 효과는 접속하지 않는다.
    if (!roomCode || attemptedRoom.current === roomCode) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (
        cancelled ||
        ["connecting", "connected", "reconnecting"].includes(
          runtime.getView().connection,
        )
      )
        return;
      attemptedRoom.current = roomCode;
      setMode("COOP");
      router.replace("/games/shooting", { scroll: false });
      void runtime.connect(sessionId, "COOP", roomCode);
    });
    return () => {
      cancelled = true;
    };
  }, [roomCode, sessionId, runtime, router]);
  useEffect(() => {
    // 실제 헤더·제목 높이를 뺀 가용 영역을 사용한다. 글꼴 확대·창 높이 변경에도 주요 조작이 화면에 남는다.
    const resize = () => {
      const element = arena.current;
      if (element) {
        // 푸터와 본문 하단 여백도 실제 크기로 제외해 FHD에서 주요 조작 아래에 불필요한 스크롤이 생기지 않게 한다.
        const main = element.closest("main");
        const footer = main?.parentElement?.querySelector("footer");
        const bottom = main
          ? Number.parseFloat(getComputedStyle(main).paddingBottom) || 0
          : 18;
        const frame = getComputedStyle(element);
        const borders =
          (Number.parseFloat(frame.borderTopWidth) || 0) +
          (Number.parseFloat(frame.borderBottomWidth) || 0);
        element.style.setProperty(
          "--arena-available-height",
          `${Math.max(300, Math.floor(window.innerHeight - element.getBoundingClientRect().top - (footer?.getBoundingClientRect().height ?? 0) - bottom - borders))}px`,
        );
      }
    };
    const observer = new ResizeObserver(resize);
    if (arena.current?.parentElement)
      observer.observe(arena.current.parentElement);
    window.addEventListener("resize", resize);
    resize();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, []);
  return (
    <>
      <div className={styles.titleRow}>
        <div>
          <span className={styles.eyebrow}>AIM. SURVIVE. GO FURTHER.</span>
          <h1>{details.game?.name ?? "슈팅 서바이벌"}</h1>
        </div>
        <div className={styles.topActions}>
          <button
            onClick={() => {
              if (
                state &&
                !state.paused &&
                state.phase !== "lobby" &&
                state.phase !== "over"
              )
                runtime.action({ type: "pause" });
              setHelp((value) => !value);
            }}
          >
            <Icon name="question" />
            조작 안내
          </button>
          {/* 랭킹은 요청할 때만 조회하고 조작 안내 오른쪽에서 열어 전투 영역을 넓게 유지한다. */}
          <button
            onClick={() => {
              if (
                state &&
                !state.paused &&
                state.phase !== "lobby" &&
                state.phase !== "over"
              )
                runtime.action({ type: "pause" });
              setRankingMode(mode);
              setRankingOpen(true);
            }}
          >
            <Icon name="trophy" />
            랭킹
          </button>
        </div>
      </div>
      <section
        ref={arena}
        className={styles.arena}
        aria-label="슈팅 서바이벌 전장"
        data-active={connected}
        data-lobby={!connected || state?.phase === "lobby"}
      >
        {/* 전투 전에는 렌더러를 실행하지 않아 대기실 뒤로 전장이 비치거나 GPU를 사용하지 않게 한다. */}
        {connected && state && state.phase !== "lobby" && (
          <Battlefield runtime={runtime} />
        )}
        {connected && state && state.phase !== "lobby" && player && (
          <BattleHud
            runtime={runtime}
            state={state}
            player={player}
            latency={view.latency}
          />
        )}
        {!connected && (
          <ShootingLobby
            sessionId={sessionId}
            mode={mode}
            setMode={setMode}
            message={view.message}
            connect={(selected, code) =>
              void runtime.connect(sessionId, selected, code)
            }
          />
        )}
        {view.connection === "connecting" && (
          <BattleDialog title="전장 연결 중">
            <p role="status">접속을 확인하고 있어요.</p>
            <button onClick={() => runtime.disconnect()}>취소</button>
          </BattleDialog>
        )}
        {state && player && view.connection !== "closed" && (
          <BattleMenus
            runtime={runtime}
            state={state}
            player={player}
            code={view.code}
            sessionId={sessionId}
          />
        )}
        {view.connection === "reconnecting" && (
          <BattleDialog title="연결 복구 중" eyebrow="전투 일시정지">
            <p role="status">
              최대 15초 동안 복귀를 기다려요.
              <br />
              복귀 후 참가자 모두 동의하면 재개됩니다.
            </p>
          </BattleDialog>
        )}
        {view.message && view.connection === "connected" && (
          <p className={styles.notice} role="status">
            {view.message}
          </p>
        )}
        {help && (
          <BattleDialog title="조작 안내" close={() => setHelp(false)}>
            <div className={styles.helpGrid}>
              <span>이동</span>
              <b>W A S D / 방향키</b>
              <span>조준 · 사격</span>
              <b>마우스 · 왼쪽 버튼 길게</b>
              <span>대시 / 스킬</span>
              <b>Space / Q · E</b>
              <span>무적 아이템</span>
              <b>V</b>
              <span>자기 / 아군 부활</span>
              <b>R / F</b>
              <span>일시정지</span>
              <b>Esc</b>
            </div>
            <p>
              모바일: 왼쪽 스틱으로 이동하고 오른쪽 스틱을 밀어 조준·사격하세요.
              대시에는 무적 효과가 없습니다.
            </p>
            <button className={styles.primary} onClick={() => setHelp(false)}>
              확인
            </button>
          </BattleDialog>
        )}
      </section>
      {rankingOpen && (
        <RoomDialog
          title="슈팅 서바이벌 랭킹"
          className={styles.rankDialog}
          onClose={() => setRankingOpen(false)}
        >
          <div className={styles.rankingTabs}>
            <button
              aria-pressed={rankingMode === "SINGLE"}
              onClick={() => setRankingMode("SINGLE")}
            >
              1인 도전
            </button>
            <button
              aria-pressed={rankingMode === "COOP"}
              onClick={() => setRankingMode("COOP")}
            >
              2인 협동
            </button>
          </div>
          <Rankings
            key={rankingMode}
            sessionId={sessionId}
            mode={rankingMode}
          />
        </RoomDialog>
      )}
    </>
  );
}
