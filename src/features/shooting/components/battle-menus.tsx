"use client";
import { useState } from "react";
import {
  formatTime,
  SKILL_IDS,
  UPGRADE_IDS,
  UPGRADES,
  WEAPONS,
  type GameSnapshot,
  type PlayerView,
  type SkillId,
  type WeaponId,
} from "@playground/shooting-shared";
import { Icon } from "@/components/ui/icon";
import { Select } from "@/components/ui/select";
import type { ShootingRuntime } from "../client/runtime";
import { BattleDialog } from "./battle-dialog";
import { ShootingWaitingRoom } from "./shooting-waiting-room";
import { UpgradeIcon } from "./upgrade-icon";
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
  const [slot, setSlot] = useState<0 | 1>(0);
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
        <p className={styles.dialogSub}>
          레벨업마다 하나를 선택하세요. 시간 초과 시 무작위로 강화됩니다.
        </p>
        {player.choiceDone ? (
          <div className={styles.waiting}>선택 완료 · 잠시 후 전투 재개</div>
        ) : (
          <div className={styles.upgradeChoices}>
            <div className={styles.upgradeGrid}>
              {UPGRADE_IDS.map((id) => (
                <button
                  key={id}
                  className={styles.upgrade}
                  onClick={() =>
                    runtime.action({
                      type: "upgrade",
                      upgrade: id,
                      ...(SKILL_IDS.includes(id as SkillId) &&
                      !player.skills.includes(id as SkillId) &&
                      player.skills.length >= 2
                        ? { slot }
                        : {}),
                    })
                  }
                >
                  <div>
                    <UpgradeIcon id={id} />
                    <span>{UPGRADES[id].category}</span>
                    <b>
                      Lv.{player.upgrades[id]} → {player.upgrades[id] + 1}
                    </b>
                  </div>
                  <strong>{UPGRADES[id].name}</strong>
                  <small>{UPGRADES[id].description}</small>
                </button>
              ))}
            </div>
            {player.skills.length >= 2 && (
              <div className={styles.slotChoice}>
                <span>새 스킬을 배울 때 교체할 슬롯</span>
                {([0, 1] as const).map((index) => (
                  <button
                    key={index}
                    aria-pressed={slot === index}
                    onClick={() => setSlot(index)}
                  >
                    {index === 0 ? "Q" : "E"} ·{" "}
                    {UPGRADES[player.skills[index]].name}
                  </button>
                ))}
              </div>
            )}
            <Equipment
              player={player}
              equip={(skill, index) =>
                runtime.action({ type: "equip", skill, slot: index })
              }
            />
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
  if (state.phase === "refit")
    return (
      <Refit
        key={`${state.stage}:${player.id}`}
        runtime={runtime}
        state={state}
        player={player}
      />
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
        <button className={styles.primary} onClick={() => runtime.disconnect()}>
          결과 확인 · 새 도전
        </button>
      </BattleDialog>
    );
  return null;
}
function Refit({
  runtime,
  state,
  player,
}: {
  runtime: ShootingRuntime;
  state: GameSnapshot;
  player: PlayerView;
}) {
  const [weapon, setWeapon] = useState(player.weapon);
  const [skills, setSkills] = useState(player.skills);
  return (
    <BattleDialog
      title={
        player.choiceDone
          ? "팀원의 정비를 기다리고 있어요"
          : "다음 구간을 준비하세요"
      }
      eyebrow={`BOSS CLEAR · ${Math.ceil(state.deadline)}초`}
    >
      <p>강화는 그대로 유지됩니다. 무기와 장착 스킬을 바꿀 수 있어요.</p>
      <WeaponChoices
        weapon={weapon}
        setWeapon={setWeapon}
        disabled={player.choiceDone}
      />
      <Equipment
        player={{ ...player, skills }}
        equip={(skill, slot) => {
          if (player.choiceDone) return;
          const next = skills.filter((value) => value !== skill);
          next.splice(slot, 0, skill);
          setSkills(next.slice(0, 2));
        }}
      />
      <button
        className={styles.primary}
        disabled={player.choiceDone}
        onClick={() => runtime.action({ type: "refit", weapon, skills })}
      >
        {player.choiceDone ? "정비 완료" : "정비 완료 · 다음 전투"}
      </button>
      <button onClick={() => runtime.action({ type: "pause" })}>
        정비 일시정지
      </button>
    </BattleDialog>
  );
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
    <div className={styles.weaponChoices}>
      {(Object.keys(WEAPONS) as WeaponId[]).map((id) => (
        <button
          key={id}
          aria-pressed={weapon === id}
          disabled={disabled}
          onClick={() => setWeapon(id)}
        >
          <Icon name={id === "launcher" ? "sun" : "target"} />
          <b>{WEAPONS[id].name}</b>
          <small>{WEAPONS[id].detail}</small>
        </button>
      ))}
    </div>
  );
}
function Equipment({
  player,
  equip,
}: {
  player: PlayerView;
  equip(skill: SkillId, slot: 0 | 1): void;
}) {
  const learned = SKILL_IDS.filter((id) => player.upgrades[id] > 0);
  if (learned.length <= 2) return null;
  return (
    <div className={styles.equipment}>
      <span>배운 스킬 장착</span>
      {([0, 1] as const).map((slot) => (
        <Select
          key={slot}
          label={`${slot === 0 ? "Q" : "E"} 장착 스킬`}
          value={player.skills[slot] ?? ""}
          options={learned.map((id) => ({
            value: id,
            label: `${slot === 0 ? "Q" : "E"} · ${UPGRADES[id].name} Lv.${player.upgrades[id]}`,
          }))}
          onValueChange={(value) => equip(value as SkillId, slot)}
        />
      ))}
    </div>
  );
}
