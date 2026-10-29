"use client";
import { useState } from "react";
import {
  formatTime,
  BALANCE,
  WEAPON_UPGRADES,
  canUpgrade,
  upgradePreview,
  UPGRADES,
  WEAPONS,
  type GameSnapshot,
  type PlayerView,
  type WeaponId,
} from "@playground/shooting-shared";
import type { ShootingRuntime } from "../client/runtime";
import { BattleDialog } from "./battle-dialog";
import { ShootingWaitingRoom } from "./shooting-waiting-room";
import { UpgradeIcon } from "./upgrade-icon";
import { WeaponArtwork } from "./weapon-artwork";
import styles from "./shooting.module.css";

export function BattleMenus({
  runtime,
  state,
  player,
  code,
  sessionId,
}: {
  runtime: ShootingRuntime;
  state: GameSnapshot;
  player: PlayerView;
  code: string;
  sessionId: string;
}) {
  const [weapon, setWeapon] = useState<WeaponId>("rifle");
  const [leave, setLeave] = useState(false);
  if (leave)
    return (
      <BattleDialog title="도전을 종료할까요?">
        <p>
          현재까지 완료한 스테이지를 기록합니다. 이어하기는 없어요.
          {state.mode === "COOP" && " 팀원은 2인 난이도로 계속 진행해요."}
        </p>
        <button className={styles.danger} onClick={() => runtime.disconnect()}>
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
        ready={() => runtime.action({ type: "ready", weapon })}
      >
        <WeaponChoices
          weapon={weapon}
          setWeapon={setWeapon}
          disabled={player.ready}
        />
      </ShootingWaitingRoom>
    );
  if (state.phase === "lobby")
    return (
      <BattleDialog title="시작 무기를 선택하세요" eyebrow="SOLO SURVIVAL">
        <p className={styles.dialogSub}>
          선택한 총은 이번 도전이 끝날 때까지 유지됩니다.
        </p>
        <WeaponChoices
          weapon={weapon}
          setWeapon={setWeapon}
          disabled={player.ready}
        />
        <button
          className={styles.primary}
          disabled={player.ready}
          onClick={() => runtime.action({ type: "ready", weapon })}
        >
          준비 완료 · 출격
        </button>
        <button onClick={() => runtime.disconnect()}>나가기</button>
      </BattleDialog>
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
          레벨당 공격력 +{BALANCE.growth.damage * 100}% · 체력 +{BALANCE.growth.health}{" "}
          · 방어력 +{BALANCE.growth.armor} 자동 성장
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
      <BattleDialog title="이번 도전이 끝났어요" eyebrow="RUN COMPLETE">
        <div className={styles.result}>
          <small>최고 완료 스테이지</small>
          <strong>{state.clearedStage.toString().padStart(2, "0")}</strong>
          <span>
            {formatTime(state.clearMillis)}
            <small> 누적 전투 시간</small>
          </span>
        </div>
        <p>
          실패한 스테이지의 시간은 기록에서 제외돼요.
          <br />
          스테이지가 높을수록, 같은 스테이지에서는 빠를수록 높은 순위입니다.
        </p>
        <button
          className={styles.primary}
          disabled={player.vote}
          onClick={() => runtime.action({ type: "replay" })}
        >
          {player.vote ? "팀원의 다시하기를 기다리고 있어요" : "다시하기"}
        </button>
        <button onClick={() => void runtime.disconnect()}>나가기</button>
      </BattleDialog>
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
