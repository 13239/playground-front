"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { RoomDialog } from "@/components/ui/game-dialog";
import { Icon } from "@/components/ui/icon";
import {
  STAGE_MAPS,
  STAGE_MAP_IDS,
  formatTime,
  characterImage,
  type StageMapId,
  type Mode,
} from "@playground/shooting-shared";
import type { ShootingProgress } from "../contracts";
import type { RoomOptions } from "../client/runtime";
import { readProgress } from "../client/api";
import { ShootingLobby } from "./shooting-lobby";
import { MapPreview, Stars } from "./stage-art";
import styles from "./stage-mode.module.css";

export type HubPage = "modes" | "maps" | "rooms";

/** 출시 전 PvP도 클릭 가능한 안내로 제공한다. 네이티브 모달이 배경 조작·포커스·Escape를 관리한다. */
export function ModeSelection({ enter }: { enter(): void }) {
  const [comingSoon, setComingSoon] = useState(false);
  const pvpButton = useRef<HTMLButtonElement>(null);
  const closeComingSoon = () => {
    setComingSoon(false);
    // Safari 계열은 마우스로 누른 버튼에 자동 포커스를 주지 않으므로 닫은 뒤 명시적으로 복귀한다.
    requestAnimationFrame(() =>
      pvpButton.current?.focus({ preventScroll: true }),
    );
  };
  return (
    <div className={styles.hub}>
      <header className={styles.heading}>
        <div>
          <h2>플레이할 모드를 선택하세요</h2>
          <p>맵을 정복하고, 나만의 전투를 완성해 보세요.</p>
        </div>
      </header>
      <div className={styles.modeGrid}>
        <button data-hover-frame className={styles.modeCard} onClick={enter}>
          <span className={styles.cardHeading}>
            <strong>스테이지 도전</strong>
            <small>1인 · 2인 협동</small>
          </span>
          <Image
            src="/images/shooting/stage-v3/stage-cover.png"
            alt="함께 수정 동굴에 도전하는 로봇과 햄스터"
            width={1672}
            height={941}
            sizes="(max-width: 700px) 100vw, 48vw"
          />
          <span>맵을 공략하고 별 3개에 도전하세요.</span>
          <span className={styles.primary}>
            스테이지 도전 <Icon name="arrowRight" />
          </span>
        </button>
        <button
          ref={pvpButton}
          data-hover-frame
          className={styles.modeCard}
          onClick={() => setComingSoon(true)}
        >
          <span className={styles.cardHeading}>
            <strong>PVP 모드</strong>
            <small>준비 중</small>
          </span>
          <Image
            src="/images/shooting/stage-v3/pvp-cover.png"
            alt="대결을 준비하는 로봇과 햄스터"
            width={1672}
            height={941}
            sizes="(max-width: 700px) 100vw, 48vw"
          />
          <span>해금한 무기로 다른 플레이어와 대결해요.</span>
          <span className={styles.secondary}>PVP 모드</span>
        </button>
      </div>
      {comingSoon && (
        <RoomDialog
          title="PVP 모드는 준비 중이에요"
          className={styles.comingSoon}
          onClose={closeComingSoon}
          illustration={
            <div className={styles.robotNotice}>
              <Image
                src={characterImage("MINT_ROBOT")}
                width={140}
                height={140}
                alt=""
              />
              <Icon name="gear" />
            </div>
          }
        >
          <p>
            더 재미있는 대전을 준비하고 있어요.
            <br />
            먼저 스테이지에 도전해 별을 모아보세요.
          </p>
          <button className={styles.primary} onClick={closeComingSoon}>
            확인
          </button>
        </RoomDialog>
      )}
    </div>
  );
}

export function TimeTargets({
  mapId,
  mode,
}: {
  mapId: StageMapId;
  mode: Mode;
}) {
  const [three, two] = STAGE_MAPS[mapId].times[mode];
  return (
    <dl className={styles.timeTargets}>
      {[
        [3, three],
        [2, two],
        [1, 0],
      ].map(([stars, time]) => (
        <div key={stars}>
          <dt>
            <Stars value={stars} />
          </dt>
          <dd>{time ? `${formatTime(time)} 이내` : "클리어"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** 표시와 해금 판정은 계정에 저장된 진행을 사용하고, 출격 권한은 게임 서버가 다시 검증한다. */
export function StageMapSelect({
  progress,
  mode,
  setMode,
  mapId,
  selectMap,
  prepare,
  back,
}: {
  progress: ShootingProgress;
  mode: Mode;
  setMode(mode: Mode): void;
  mapId: StageMapId;
  selectMap(map: StageMapId): void;
  prepare(): void;
  back(): void;
}) {
  const map = STAGE_MAPS[mapId],
    record = progress.maps.find((row) => row.mapId === mapId);
  const best = mode === "SINGLE" ? record?.singleMillis : record?.coopMillis;
  return (
    <div className={styles.hub}>
      <header className={styles.heading}>
        <div>
          <button className={styles.back} onClick={back}>
            <Icon name="arrowLeft" /> 모드 선택
          </button>
          <h2>스테이지 도전</h2>
          <p>맵을 공략하고 별 3개에 도전하세요.</p>
        </div>
        <strong className={styles.totalStars}>
          ★ 최고 별 {progress.totalStars} / 9
        </strong>
      </header>
      <div className={styles.modeTabs}>
        {(["SINGLE", "COOP"] as const).map((value) => (
          <button
            key={value}
            aria-pressed={mode === value}
            onClick={() => setMode(value)}
          >
            {value === "SINGLE" ? "1인 도전" : "2인 협동"}
          </button>
        ))}
      </div>
      <div className={styles.mapLayout}>
        <div className={styles.mapList}>
          {STAGE_MAP_IDS.map((id) => {
            const item = STAGE_MAPS[id],
              saved = progress.maps.find((row) => row.mapId === id);
            return (
              <button
                key={id}
                data-hover-frame
                data-selected={mapId === id}
                className={styles.mapCard}
                aria-pressed={mapId === id}
                disabled={!saved?.unlocked}
                onClick={() => selectMap(id)}
              >
                <MapPreview mapId={id} />
                <strong>{item.name}</strong>
                <Stars value={saved?.stars ?? 0} />
                <small>
                  {saved?.unlocked
                    ? saved.stars
                      ? "최고 별 기록"
                      : "도전 가능"
                    : `${STAGE_MAPS[STAGE_MAP_IDS[item.order - 1]].name} 클리어 시 해금`}
                </small>
              </button>
            );
          })}
          <p className={styles.mapFootnote}>
            각 맵의 1인·2인 최고 별 중 높은 기록을 반영해요.
          </p>
        </div>
        <aside className={styles.mapDetail}>
          <h3>{map.name}</h3>
          <MapPreview mapId={mapId} />
          <small>10스테이지 · 중간 보스 · 최종 보스</small>
          <p>{map.description}</p>
          <TimeTargets mapId={mapId} mode={mode} />
          <p className={styles.bestTime}>
            나의 최고{" "}
            <strong>{best ? formatTime(best) : "첫 도전을 기다려요"}</strong>
          </p>
          <button
            className={styles.primary}
            disabled={!record?.unlocked}
            onClick={prepare}
          >
            {mode === "SINGLE" ? "출격 준비" : "협동 방 찾기"}
            <Icon name="arrowRight" />
          </button>
        </aside>
      </div>
    </div>
  );
}

export function StageHub({
  sessionId,
  page,
  setPage,
  mapId,
  setMapId,
  mode,
  setMode,
  connect,
  message,
  dismissMessage,
  onProgress,
}: {
  sessionId: string;
  page: HubPage;
  setPage(page: HubPage): void;
  mapId: StageMapId;
  setMapId(map: StageMapId): void;
  mode: Mode;
  setMode(mode: Mode): void;
  connect(mode: Mode, code?: string, options?: RoomOptions): void;
  message: string;
  dismissMessage(): void;
  onProgress(progress: ShootingProgress): void;
}) {
  const [result, setResult] = useState<{
    data?: ShootingProgress;
    error?: string;
  }>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (page === "modes") return;
    const controller = new AbortController();
    void readProgress(sessionId, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setResult({ data });
        onProgress(data);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setResult({ error: "맵 진행을 불러오지 못했어요." });
      });
    return () => controller.abort();
  }, [sessionId, page, attempt, onProgress]);
  if (page === "modes") return <ModeSelection enter={() => setPage("maps")} />;
  if (page === "rooms")
    return (
      <div className={styles.hub}>
        <button className={styles.back} onClick={() => setPage("maps")}>
          <Icon name="arrowLeft" /> 맵 선택
        </button>
        <ShootingLobby
          sessionId={sessionId}
          mapId={mapId}
          mode="COOP"
          // 방 탐색에서 1인을 고르면 맵 선택으로 돌아가 해당 모드의 기록·목표 시간을 보여 준다.
          setMode={(selected) => {
            setMode(selected);
            if (selected === "SINGLE") setPage("maps");
          }}
          message={message}
          dismissMessage={dismissMessage}
          connect={(selected, code, options) =>
            connect(selected, code, { ...options, mapId })
          }
        />
      </div>
    );
  if (!result?.data)
    return (
      <div className={styles.hub} role="status">
        <p>{result?.error ?? "맵과 별 기록을 불러오고 있어요."}</p>
        <button
          onClick={() =>
            result?.error ? setAttempt((value) => value + 1) : setPage("modes")
          }
        >
          {result?.error ? "다시 확인" : "모드 선택"}
        </button>
      </div>
    );
  return (
    <>
      <StageMapSelect
        progress={result.data}
        mode={mode}
        setMode={setMode}
        mapId={mapId}
        selectMap={setMapId}
        back={() => setPage("modes")}
        prepare={() =>
          mode === "COOP"
            ? setPage("rooms")
            : connect("SINGLE", undefined, { mapId })
        }
      />
      {message && (
        <div role="status" className={styles.message}>
          {message}
          <button onClick={dismissMessage}>닫기</button>
        </div>
      )}
    </>
  );
}
