"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import {
  STAGE_MAPS,
  STAGE_MAP_IDS,
  SHOOTING_CHARACTERS,
  characterImage,
  formatTime,
  mapUnlocked,
  type GameSnapshot,
  type PlayerView,
} from "@playground/shooting-shared";
import type { ShootingRuntime, RuntimeView } from "../client/runtime";
import type { ShootingProgress } from "../contracts";
import { readProgress } from "../client/api";
import { MapPreview, Stars } from "./stage-art";
import styles from "./stage-mode.module.css";

/** 서버가 확인한 클리어와 영구 최고 기록을 구분해 표시한다. 저장 전에 해금 완료로 안내하지 않는다. */
export function StageResults({
  state,
  player,
  runtime,
  sessionId,
  before,
  recordState,
  leave,
}: {
  state: GameSnapshot;
  player: PlayerView;
  runtime: ShootingRuntime;
  sessionId: string;
  before?: ShootingProgress;
  recordState?: RuntimeView["recordState"];
  leave(): void;
}) {
  const [progress, setProgress] = useState<ShootingProgress>();
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (recordState !== "saved") return;
    const controller = new AbortController();
    void readProgress(sessionId, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setProgress(value);
          setLoadError(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadError(true);
      });
    return () => controller.abort();
  }, [recordState, sessionId, attempt]);
  const map = STAGE_MAPS[state.mapId],
    prior = before?.maps.find((row) => row.mapId === state.mapId);
  const previous =
    state.mode === "SINGLE" ? prior?.singleMillis : prior?.coopMillis;
  const next = STAGE_MAP_IDS[map.order + 1];
  const party = Object.values(state.players).filter((value) => !value.departed);
  const nextOpen =
    !!next && party.every((value) => mapUnlocked(value.unlockedMaps, next));
  const times = state.stageTimes;
  const ordinary = times.reduce(
    (sum, time, index) => sum + ((index + 1) % 5 ? time : 0),
    0,
  );
  return (
    <section className={styles.results} aria-label="도전 결과">
      <header>
        <h2>
          {map.name} {state.completed ? "클리어!" : "도전 종료"}
        </h2>
        <p>
          {state.mode === "SINGLE" ? "1인 도전" : "2인 협동"} ·{" "}
          {state.clearedStage} / 10스테이지 완료
        </p>
      </header>
      <div className={styles.resultGrid}>
        <div className={styles.victoryArt}>
          <Image
            src={characterImage(player.character)}
            width={420}
            height={420}
            sizes="25vw"
            alt={SHOOTING_CHARACTERS[player.character].name}
          />
        </div>
        <div className={styles.resultRecord}>
          <Stars value={state.stars} large />
          <strong>
            {formatTime(
              state.completed ? state.clearMillis : state.combatMillis,
            )}
          </strong>
          {state.completed && (
            <p>
              {previous ? (
                <>
                  이전 최고 {formatTime(previous)}
                  <br />
                  {state.clearMillis < previous
                    ? `${formatTime(previous - state.clearMillis)} 단축 · 최고 기록 갱신`
                    : "완주 기록을 남겼어요"}
                </>
              ) : (
                "첫 클리어를 달성했어요!"
              )}
            </p>
          )}
          {!state.completed && (
            <p>맵을 끝까지 클리어하면 별을 얻을 수 있어요.</p>
          )}
          {state.completed && (
            <div className={styles.splitTimes}>
              {[
                ["일반 전투", ordinary],
                ["중간 보스", times[4] ?? 0],
                ["최종 보스", times[9] ?? 0],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <small>{label}</small>
                  <b>{formatTime(Number(value))}</b>
                </div>
              ))}
            </div>
          )}
          <p role="status">
            {recordState === "saved"
              ? progress
                ? `전체 최고 별 ${before ? `${before.totalStars} → ` : ""}${progress.totalStars} / 9`
                : "기록을 저장했어요."
              : recordState === "error"
                ? "기록을 저장하지 못했어요. 로그인과 연결을 확인해 주세요."
                : "기록을 저장하고 있어요."}
          </p>
          {loadError && (
            <button onClick={() => setAttempt((value) => value + 1)}>
              별 기록 다시 확인
            </button>
          )}
          {state.stars === 3 && recordState === "saved" && (
            <b>✦ {map.name} 3성 정복</b>
          )}
        </div>
        <aside className={styles.nextMapCard}>
          {next ? (
            <>
              <strong>다음 맵 · {STAGE_MAPS[next].name}</strong>
              <MapPreview mapId={next} />
              <p>
                {nextOpen
                  ? "새로운 구조와 몬스터에 도전하세요."
                  : state.mode === "COOP"
                    ? "두 사람 모두 이전 맵을 클리어하면 함께 출격할 수 있어요."
                    : "이 맵의 클리어 기록이 저장되면 다음 맵에 출격할 수 있어요."}
              </p>
            </>
          ) : (
            <>
              <strong>마지막 맵 도전 완료</strong>
              <MapPreview mapId={state.mapId} />
              <p>모든 맵의 별 3개 정복과 최고 기록에 도전해 보세요.</p>
            </>
          )}
        </aside>
      </div>
      <footer className={styles.resultsFooter}>
        <p>
          {player.vote
            ? `${STAGE_MAPS[state.nextMapId].name} · ${state.mode === "COOP" ? "팀원의 동의를 기다리고 있어요." : "새 도전을 준비하고 있어요."}`
            : state.mode === "COOP"
              ? "다음 도전은 함께 준비한 뒤 시작해요."
              : "원하는 맵을 다시 선택할 수 있어요."}
        </p>
        <div>
          <button className={styles.secondary} onClick={leave}>
            맵 선택
          </button>
          <button
            className={styles.secondary}
            disabled={player.vote}
            onClick={() =>
              runtime.action({ type: "replay", mapId: state.mapId })
            }
          >
            다시 도전
          </button>
          {state.mode === "COOP" &&
            state.nextMapId !== state.mapId &&
            !player.vote && (
              <button
                className={styles.primary}
                onClick={() =>
                  runtime.action({ type: "replay", mapId: state.nextMapId })
                }
              >
                팀원과 다음 도전 동의
              </button>
            )}
          {next && (
            <button
              className={styles.primary}
              disabled={player.vote || !nextOpen || recordState !== "saved"}
              onClick={() => runtime.action({ type: "replay", mapId: next })}
            >
              다음 맵
            </button>
          )}
        </div>
      </footer>
    </section>
  );
}
