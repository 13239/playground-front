"use client";
import { useEffect, useState } from "react";
import {
  BALANCE,
  WEAPON_UPGRADES,
  canUpgrade,
  upgradePreview,
  UPGRADES,
  WEAPONS,
  type GameSnapshot,
  type PlayerView,
  type WeaponId,
  type ShootingCharacterId,
  type StageMapId,
} from "@playground/shooting-shared";
import type { ShootingRuntime } from "../client/runtime";
import { BattleDialog } from "./battle-dialog";
import { ShootingWaitingRoom } from "./shooting-waiting-room";
import { UpgradeIcon } from "./upgrade-icon";
import { WeaponArtwork } from "./weapon-artwork";
import { CharacterChoices, StageLoadout } from "./stage-loadout";
import { StageResults } from "./stage-results";
import type { ShootingProgress } from "../contracts";
import type { RuntimeView } from "../client/runtime";
import { warmStageArt } from "../client/stage-assets";
import styles from "./shooting.module.css";

export function BattleMenus({
  runtime,
  state,
  player,
  code,
  sessionId,
  before,
  recordState,
  exit,
}: {
  runtime: ShootingRuntime;
  state: GameSnapshot;
  player: PlayerView;
  code: string;
  sessionId: string;
  before?: ShootingProgress;
  recordState?: RuntimeView["recordState"];
  exit(): void;
}) {
  const [weapon, setWeapon] = useState<WeaponId>("rifle");
  const [character, setCharacter] = useState<ShootingCharacterId>(
    player.character,
  );
  const [leave, setLeave] = useState(false);
  const [art, setArt] = useState<{ mapId: StageMapId; ready: boolean }>();
  const [artAttempt, setArtAttempt] = useState(0);
  useEffect(() => {
    if (state.phase !== "lobby") return;
    let cancelled = false;
    void warmStageArt(state.mapId)
      .then(() => {
        if (!cancelled) setArt({ mapId: state.mapId, ready: true });
      })
      .catch(() => {
        if (!cancelled) setArt({ mapId: state.mapId, ready: false });
      });
    return () => {
      cancelled = true;
    };
  }, [state.phase, state.mapId, artAttempt]);
  const artReady = art?.mapId === state.mapId && art.ready;
  if (state.phase === "lobby" && art?.mapId === state.mapId && !art.ready)
    return (
      <BattleDialog title="전장 이미지를 불러오지 못했어요">
        <p>연결을 확인한 뒤 다시 시도해 주세요.</p>
        <button
          className={styles.primary}
          onClick={() => {
            setArt(undefined);
            setArtAttempt((value) => value + 1);
          }}
        >
          다시 불러오기
        </button>
        <button onClick={exit}>맵 선택</button>
      </BattleDialog>
    );
  if (leave)
    return (
      <BattleDialog title="도전을 종료할까요?">
        <p>
          현재까지 완료한 스테이지를 기록합니다. 이어하기는 없어요.
          {state.mode === "COOP" && " 팀원은 2인 난이도로 계속 진행해요."}
        </p>
        <button className={styles.danger} onClick={exit}>
          나가기
        </button>
        <button onClick={() => setLeave(false)}>돌아가기</button>
      </BattleDialog>
    );
  if (state.paused)
    return (
      <BattleDialog
        title={
          state.pauseReason === "authorization"
            ? "접속 권한을 확인하고 있어요"
            : state.pauseReason === "connection"
              ? "팀원의 복귀를 기다리고 있어요"
              : "잠시 쉬어가세요"
        }
        eyebrow="PAUSED"
      >
        <p>
          {state.pauseReason === "authorization"
            ? "서버 연결을 확인한 뒤 재개할 수 있어요. 잠시만 기다려 주세요."
            : state.reconnectRemaining > 0
              ? `연결 복귀 유예 ${Math.ceil(state.reconnectRemaining)}초`
              : state.mode === "COOP"
                ? "참가자 모두 동의하면 전투를 재개합니다."
                : "준비되면 도전을 이어가세요."}
        </p>
        <div className={styles.playerVotes}>
          {Object.values(state.players)
            .filter((value) => !value.departed)
            .map((value) => (
              <span key={value.id}>
                <i className={value.vote ? styles.onlineDot : styles.waitDot} />
                {value.nickname}
                <b>
                  {!value.connected
                    ? "복귀 대기"
                    : value.vote
                      ? "재개 동의"
                      : "대기"}
                </b>
              </span>
            ))}
        </div>
        <button
          className={styles.primary}
          disabled={
            !player.connected ||
            state.reconnectRemaining > 0 ||
            player.vote ||
            state.pauseReason === "authorization"
          }
          onClick={() => runtime.action({ type: "resume" })}
        >
          {player.vote ? "팀원의 동의를 기다리고 있어요" : "재개 동의"}
        </button>
        <button onClick={() => setLeave(true)}>도전 종료</button>
      </BattleDialog>
    );
  if (state.phase === "lobby" && state.mode === "COOP")
    return (
      <ShootingWaitingRoom
        runtime={runtime}
        state={state}
        player={player}
        sessionId={sessionId}
        code={code}
        canStart={!!artReady}
        ready={() => runtime.action({ type: "ready", weapon, character })}
      >
        <CharacterChoices
          value={character}
          change={setCharacter}
          disabled={player.ready}
        />
        <WeaponChoices
          weapon={weapon}
          setWeapon={setWeapon}
          disabled={player.ready}
        />
      </ShootingWaitingRoom>
    );
  if (state.phase === "lobby")
    return (
      <StageLoadout
        state={state}
        character={character}
        changeCharacter={setCharacter}
        start={() => runtime.action({ type: "ready", weapon, character })}
        leave={exit}
        canStart={!!artReady}
      >
        <WeaponChoices
          weapon={weapon}
          setWeapon={setWeapon}
          disabled={player.ready}
        />
      </StageLoadout>
    );
  if (state.phase === "upgrade")
    return (
      <BattleDialog
        title={
          player.choiceDone ? "팀원이 강화하고 있어요" : "다음 전투를 위한 선택"
        }
        eyebrow={`LEVEL ${state.level} · ${Math.ceil(state.deadline)}초`}
        wide
      >
        {/* 기본 능력은 자동 성장하며 현재 총 전용 강화 세 개만 선택한다. */}
        <p className={styles.dialogSub}>
          레벨당 공격력 +{BALANCE.growth.damage * 100}% · 체력 +
          {BALANCE.growth.health} · 방어력 +{BALANCE.growth.armor} 자동 성장
          <br />
          {WEAPONS[player.weapon].name} 강화 하나를 선택하세요. 시간 초과 시
          가능한 강화 중 하나가 선택됩니다.
        </p>
        {player.choiceDone ? (
          <div className={styles.waiting}>선택 완료 · 잠시 후 전투 재개</div>
        ) : (
          <div className={styles.upgradeChoices}>
            <div className={styles.upgradeGrid}>
              {WEAPON_UPGRADES[player.weapon].map((id) => (
                <button
                  key={id}
                  className={styles.upgrade}
                  disabled={!canUpgrade(id, player.upgrades)}
                  onClick={() =>
                    runtime.action({ type: "upgrade", upgrade: id })
                  }
                >
                  <div>
                    <UpgradeIcon id={id} />
                    <span>무기 강화</span>
                    <b>Lv.{player.upgrades[id]}</b>
                  </div>
                  <strong>{UPGRADES[id].name}</strong>
                  <em className={styles.upgradeValue}>
                    {upgradePreview(
                      player.weapon,
                      player.upgrades,
                      state.level,
                      id,
                    )}
                  </em>
                  <small>{UPGRADES[id].description}</small>
                </button>
              ))}
            </div>
          </div>
        )}
        <button
          className={styles.quiet}
          onClick={() => runtime.action({ type: "pause" })}
        >
          선택 일시정지
        </button>
      </BattleDialog>
    );
  if (state.phase === "over")
    return (
      <StageResults
        state={state}
        player={player}
        runtime={runtime}
        sessionId={sessionId}
        before={before}
        recordState={recordState}
        leave={exit}
      />
    );
  return null;
}
function WeaponChoices({
  weapon,
  setWeapon,
  disabled,
}: {
  weapon: WeaponId;
  setWeapon(value: WeaponId): void;
  disabled?: boolean;
}) {
  return (
    // 무기 선택은 출격 전 대기 화면에서만 제공한다.
    <div className={styles.weaponChoices}>
      {(Object.keys(WEAPONS) as WeaponId[]).map((id) => (
        <button
          key={id}
          aria-pressed={weapon === id}
          disabled={disabled}
          onClick={() => setWeapon(id)}
        >
          <WeaponArtwork weapon={id} />
          <b>{WEAPONS[id].name}</b>
          <small>{WEAPONS[id].detail}</small>
        </button>
      ))}
    </div>
  );
}
