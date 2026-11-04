"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { RoomDialog } from "@/components/ui/game-dialog";
import { Icon } from "@/components/ui/icon";
import { SearchInput } from "@/components/ui/search-input";
import { NumberedPagination } from "@/features/admin/components/numbered-pagination";
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
import { MapCover, MapPreview, Stars } from "./stage-art";
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
          <h2>오늘은 어떤 모드로 즐길까요?</h2>
          <p>혼자서도, 친구와 함께해도 즐거운 슈팅 모험</p>
        </div>
      </header>
      <div className={styles.modeGrid}>
        <button data-hover-frame className={styles.modeCard} onClick={enter}>
          <span className={styles.cardHeading}>
            <strong>모험 모드</strong>
            <small>1인 · 2인 협동</small>
          </span>
          <Image
            src="/images/shooting/stage-v3/stage-cover.png"
            alt="함께 수정 동굴에 도전하는 로봇과 햄스터"
            width={1672}
            height={941}
            sizes="(max-width: 700px) 100vw, 48vw"
          />
          <span>맵을 탐험하고, 10개의 스테이지를 돌파하세요.</span>
          <span className={styles.primary}>
            모험 시작 <Icon name="arrowRight" />
          </span>
        </button>
        <button
          ref={pvpButton}
          data-hover-frame
          className={styles.modeCard}
          onClick={() => setComingSoon(true)}
        >
          <span className={styles.cardHeading}>
            <strong>PVP 대전</strong>
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
          <span className={styles.secondary}>준비 중</span>
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
            먼저 모험 모드에서 별을 모아보세요.
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
  // 검색·필터·번호 페이징은 게임 내부 상태만 변경한다. 맵 수가 늘어도 한 화면의 카드 수는 일정하다.
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "cleared">("all");
  const [page, setPage] = useState(1);
  const [previewOpen, setPreviewOpen] = useState(false);
  // 같은 진행 목록을 카드마다 다시 순회하지 않도록 조회 인덱스를 한 번 만든다.
  const savedMaps = new Map(progress.maps.map((row) => [row.mapId, row]));
  const map = STAGE_MAPS[mapId];
  const record = savedMaps.get(mapId);
  const best = mode === "SINGLE" ? record?.singleMillis : record?.coopMillis;
  const normalizedQuery = query.trim().replaceAll(" ", "");
  const filtered = STAGE_MAP_IDS.filter((id) => {
    const saved = savedMaps.get(id);
    return (
      STAGE_MAPS[id].name.replaceAll(" ", "").includes(normalizedQuery) &&
      (filter === "all" ||
        (filter === "open" ? saved?.unlocked : (saved?.stars ?? 0) > 0))
    );
  });
  const pageSize = 6;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleMaps = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  return (
    <div className={styles.hub}>
      <header className={`${styles.heading} ${styles.mapHeading}`}>
        <button className={styles.back} onClick={back}>
          <Icon name="arrowLeft" /> 모드 선택
        </button>
        <div>
          <h2>모험 모드</h2>
          <p>맵을 선택하고 모험을 시작하세요.</p>
        </div>
        <strong className={styles.totalStars}>
          ★ 최고 별 {progress.totalStars} / {STAGE_MAP_IDS.length * 3}
        </strong>
      </header>
      <div className={styles.mapLayout}>
        <section className={styles.mapLibrary} aria-label="모험 맵 목록">
          <div className={styles.libraryToolbar}>
            <h3>
              <Icon name="grid" /> 맵 목록 <small>{STAGE_MAP_IDS.length}</small>
            </h3>
            <SearchInput
              label="맵 검색"
              placeholder="맵 이름 검색"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              onSearch={() => setPage(1)}
            />
            <div className={styles.mapFilters} aria-label="맵 상태 필터">
              {([
                ["all", "전체"],
                ["open", "도전 가능"],
                ["cleared", "클리어"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  aria-pressed={filter === value}
                  onClick={() => {
                    setFilter(value);
                    setPage(1);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.mapList}>
            {visibleMaps.map((id) => {
              const item = STAGE_MAPS[id];
              const saved = savedMaps.get(id);
              const status = !saved?.unlocked
                ? "잠김"
                : mapId === id
                  ? "선택됨"
                  : saved.stars ? "클리어" : "도전 가능";
              return (
                <button
                  key={id}
                  data-hover-frame
                  data-selected={mapId === id}
                  className={styles.mapCard}
                  aria-pressed={mapId === id}
                  // 잠긴 맵도 미리 볼 수 있지만 실제 출격·해금은 서버 권한으로 제한한다.
                  aria-label={`${item.name}${saved?.unlocked ? "" : " · 잠김"}`}
                  onClick={() => selectMap(id)}
                >
                  <MapCover mapId={id} />
                  <strong>{item.name}</strong>
                  <span className={styles.mapCardMeta}>
                    <Stars value={saved?.stars ?? 0} />
                    <small data-locked={!saved?.unlocked}>
                      {!saved?.unlocked && <Icon name="lock" />}
                      {status}
                    </small>
                  </span>
                </button>
              );
            })}
            {!visibleMaps.length && (
              <p className={styles.emptyMaps} role="status">
                조건에 맞는 맵이 없어요. 검색어나 필터를 변경해 보세요.
              </p>
            )}
          </div>
          <div className={styles.libraryFooter}>
            <NumberedPagination
              page={currentPage}
              totalPages={totalPages}
              change={setPage}
              label="모험 맵 페이지"
            />
            <small aria-live="polite">
              {filtered.length ? (currentPage - 1) * pageSize + 1 : 0}–
              {Math.min(currentPage * pageSize, filtered.length)} / {filtered.length}
            </small>
          </div>
          <p className={styles.mapFootnote}>
            각 맵의 1인·2인 최고 별 중 높은 기록을 반영해요.
          </p>
        </section>
        <aside className={styles.mapDetail}>
          <h3>{map.name}</h3>
          <MapCover mapId={mapId} />
          <div className={styles.detailMeta}>
            <small>10 스테이지 · 보스 2회</small>
            <button
              className={styles.previewButton}
              onClick={() => setPreviewOpen(true)}
            >
              <Icon name="eye" />지형 보기
            </button>
          </div>
          <p>{map.description}</p>
          <TimeTargets mapId={mapId} mode={mode} />
          <h4 className={styles.playModeLabel}>플레이 방식</h4>
          <div className={styles.modeTabs}>
            {(["SINGLE", "COOP"] as const).map((value) => (
              <button
                key={value}
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
              >
                <Icon name={value === "SINGLE" ? "user" : "users"} />
                {value === "SINGLE" ? "1인 도전" : "2인 협동"}
              </button>
            ))}
          </div>
          <p className={styles.bestTime}>
            고난도 최고 기록{" "}
            <strong>{best ? formatTime(best) : "첫 도전을 기다려요"}</strong>
          </p>
          <button
            className={styles.primary}
            disabled={!record?.unlocked}
            onClick={prepare}
          >
            {record?.unlocked
              ? mode === "SINGLE" ? "모험 시작" : "협동 방 찾기"
              : "이전 맵 클리어 후 해금"}
            <Icon name="arrowRight" />
          </button>
          {!record?.unlocked && map.order > 0 && (
            <p className={styles.unlockHint}>
              {STAGE_MAPS[STAGE_MAP_IDS[map.order - 1]].name}을 클리어하면 열려요.
            </p>
          )}
        </aside>
      </div>
      {previewOpen && (
        <RoomDialog
          title={`${map.name} 지형`}
          onClose={() => setPreviewOpen(false)}
        >
          {/* 전경 삽화와 실제 충돌 지형을 구분해 안내하고 동일한 공유 배치를 미리 볼 수 있게 한다. */}
          <MapPreview mapId={mapId} />
          <p>{map.description}</p>
        </RoomDialog>
      )}
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
