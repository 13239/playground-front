"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShootingRoomDialog } from "./shooting-room-dialog";
import { StageHub, type HubPage } from "./stage-hub";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  type Mode,
  type StageMapId,
} from "@playground/shooting-shared";
import type { ShootingProgress } from "../contracts";
import { Icon } from "@/components/ui/icon";
import {
  useAuthSession,
  revalidateAuthSession,
} from "@/features/auth/client/session-store";
import { ShootingRuntime } from "../client/runtime";
import { useArenaViewport } from "../client/use-arena-viewport";
import { Battlefield, preloadBattlefield } from "./battlefield";
import { BattleHud } from "./battle-hud";
import { BattleMenus } from "./battle-menus";
import { BattleDialog } from "./battle-dialog";
import { Rankings } from "./rankings";
import { ShootingNotice } from "./shooting-notice";
import styles from "./shooting.module.css";

/** 계정 변경·페이지 이탈 시 소켓과 렌더러를 함께 폐기한다. 다른 계정의 도전으로 이어지지 않는다. */
export function ShootingScreen({ roomCode }: { roomCode?: string }) {
  const auth = useAuthSession();
  if (auth.status !== "authenticated")
    return (
      <section className={styles.status} role="status">
        <span className={styles.eyebrow}>SHOOTING SURVIVAL</span>
        <h1>슈팅게임</h1>
        <p>
          {auth.status === "anonymous"
            ? "로그인하고 맵을 공략해 별을 모아보세요."
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
  const [hubPage, setHubPage] = useState<HubPage>("modes");
  const [mapId, setMapId] = useState<StageMapId>("CAVE");
  const [progress, setProgress] = useState<ShootingProgress>();
  const [rankingOpen, setRankingOpen] = useState(false);
  const [rankingMode, setRankingMode] = useState<Mode>("SINGLE");
  const [help, setHelp] = useState(false);
  const [sound, setSound] = useState(true);
  const arena = useRef<HTMLElement>(null);
  useArenaViewport(arena);
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
    // 브라우저 자동 재생 정책을 지키며 키보드·터치·마우스의 첫 조작으로 효과음을 활성화한다.
    const unlock = () => runtime.audio.unlock();
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    window.addEventListener("pagehide", leaving);
    return () => {
      window.removeEventListener("pagehide", leaving);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      runtime.disconnect();
      runtime.audio.close();
    };
  }, [runtime]);
  useEffect(() => {
    // 초대 링크·공통 팝업 수락 모두 같은 인증된 참가 흐름으로 들어온다. Strict Mode의 폐기된 효과는 접속하지 않는다.
    // URL을 소비한 뒤 같은 방의 새 초대를 다시 수락해도 한 번 더 처리할 수 있게 한다.
    if (!roomCode) {
      attemptedRoom.current = undefined;
      return;
    }
    if (attemptedRoom.current === roomCode) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      attemptedRoom.current = roomCode;
      setMode("COOP");
      setHubPage("maps");
      router.replace("/games/shooting", { scroll: false });
      // 초대 수락과 링크는 바로 입장한다. 다른 방의 연결·사용권 반환은 runtime이 순서대로 처리한다.
      const current = runtime.getView();
      if (
        current.code !== roomCode ||
        !["connecting", "connected", "reconnecting"].includes(
          current.connection,
        )
      )
        void runtime.connect(sessionId, "COOP", roomCode, { entry: "code" });
    });
    return () => {
      cancelled = true;
    };
  }, [roomCode, sessionId, runtime, router]);
  return (
    <>
      <div className={styles.titleRow}>
        <div>
          {/* 제목은 내부 모드·대기실·전투 전환과 관계없이 유지해 하나의 게임 클라이언트로 보이게 한다. */}
          <span className={styles.eyebrow}>PLAYGROUND</span>
          <h1>슈팅게임</h1>
        </div>
        <div className={styles.topActions}>
          <button
            aria-label={sound ? "소리 끄기" : "소리 켜기"}
            aria-pressed={sound}
            onClick={() => {
              const enabled = !sound;
              setSound(enabled);
              runtime.audio.setEnabled(enabled);
            }}
          >
            <Icon name={sound ? "volume" : "volumeOff"} />
            소리 {sound ? "켜짐" : "꺼짐"}
          </button>
          <button
            aria-label="조작 안내"
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
            aria-label="랭킹"
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
          <Link href="/" aria-label="홈으로" title="홈으로"><Icon name="home" /></Link>
        </div>
      </div>
      <section
        ref={arena}
        className={styles.arena}
        aria-label="슈팅게임"
        data-active={connected}
        data-battle={connected && !!state && !["lobby", "over"].includes(state.phase)}
        data-lobby={
          !connected || state?.phase === "lobby" || state?.phase === "over"
        }
      >
        {/* 전투 전에는 렌더러를 실행하지 않아 대기실 뒤로 전장이 비치거나 GPU를 사용하지 않게 한다. */}
        {connected &&
          state &&
          state.phase !== "lobby" &&
          state.phase !== "over" && <Battlefield runtime={runtime} />}
        {connected &&
          state &&
          state.phase !== "lobby" &&
          state.phase !== "over" &&
          player && (
            <BattleHud
              runtime={runtime}
              state={state}
              player={player}
              latency={view.latency}
            />
          )}
        {!connected && (
          <StageHub
            sessionId={sessionId}
            page={hubPage}
            setPage={setHubPage}
            mapId={mapId}
            setMapId={setMapId}
            onProgress={setProgress}
            mode={mode}
            setMode={setMode}
            message={view.message}
            dismissMessage={() => runtime.dismissMessage()}
            connect={(selected, code, settings) =>
              void runtime.connect(sessionId, selected, code, settings)
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
            before={progress}
            recordState={view.recordState}
            exit={() => {
              setMapId(state.mapId);
              setHubPage("maps");
              void runtime.disconnect();
            }}
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
          <ShootingNotice
            className={styles.notice}
            message={view.message}
            dismiss={() => runtime.dismissMessage()}
          />
        )}
        {help && (
          <BattleDialog title="조작 안내" close={() => setHelp(false)}>
            <div className={styles.helpGrid}>
              <span>이동</span>
              <b>W A S D / 방향키</b>
              <span>조준 · 사격</span>
              <b>마우스 · 왼쪽 버튼 길게</b>
              <span>대시</span>
              <b>Space</b>
              {/* 도움말도 실제 전투 입력·HUD와 같은 E 키를 안내한다. */}
              <span>무적 아이템</span>
              <b>E</b>
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
        <ShootingRoomDialog
          title="맵별 슈팅 기록"
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
            key={`${rankingMode}:${state?.mapId ?? mapId}`}
            sessionId={sessionId}
            mode={rankingMode}
            mapId={state?.mapId ?? mapId}
          />
        </ShootingRoomDialog>
      )}
    </>
  );
}
