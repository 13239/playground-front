"use client";
import { useRef, useState, type PointerEvent } from "react";
import Image from "next/image";
import {
  formatTime,
  STAGE_MAPS,
  STAGES_PER_MAP,
  encounterFor,
  formatShieldTime,
  characterImage,
  WEAPON_UPGRADES,
  playerStats,
  UPGRADES,
  WEAPONS,
  type GameSnapshot,
  type PlayerView,
} from "@playground/shooting-shared";
import { Icon } from "@/components/ui/icon";
import type { ShootingRuntime } from "../client/runtime";
import { UpgradeIcon } from "./upgrade-icon";
import styles from "./shooting.module.css";

export function BattleHud({
  runtime,
  state,
  player,
  latency,
}: {
  runtime: ShootingRuntime;
  state: GameSnapshot;
  player: PlayerView;
  latency: number;
}) {
  const ally = Object.values(state.players).find(
    (value) => value.id !== player.id && !value.departed,
  );
  const boss = Object.values(state.enemies).find((enemy) => enemy.boss);
  const plan = encounterFor(state.mapId, state.stage);
  // 제한시간과 공략 진행은 실제 서버 상태를 사용하며 조작 안내 대신 현재 임무를 보여 준다.
  const remaining = state.objectiveWindow;
  const urgent = state.objectiveComplete && remaining > 0 && remaining < 4;
  const objective = `${state.objectiveText}${remaining > 0 ? ` · ${remaining.toFixed(1)}s` : ""}`;
  return (
    <>
      {/* 진행도는 10개 노드로 고정하고 보스(5·10)와 현재·완료 상태를 색과 기호로 함께 구분한다. */}
      <div className={styles.stageProgress} aria-label={`${STAGE_MAPS[state.mapId].name} · ${state.stage} / ${STAGES_PER_MAP} 스테이지`}>
        <strong><span>{plan.title}</span>{STAGE_MAPS[state.mapId].name}</strong>
        <ol>
          {Array.from({ length: STAGES_PER_MAP }, (_, index) => index + 1).map((stage) => (
            <li key={stage} data-cleared={stage <= state.clearedStage} data-current={stage === state.stage}
              data-boss={stage % 5 === 0} aria-current={stage === state.stage ? "step" : undefined}
              aria-label={`${stage} 스테이지${stage % 5 === 0 ? " · 보스" : ""}${stage <= state.clearedStage ? " · 완료" : ""}`}>
              <span>{stage <= state.clearedStage ? "✓" : stage}</span>
            </li>
          ))}
        </ol>
        <b>STAGE {String(state.stage).padStart(2, "0")} / {STAGES_PER_MAP}</b>
      </div>
      <div className={styles.hudTop}>
        <div className={styles.vitals}>
          <div>
            <Image
              src={characterImage(player.character)}
              width={30}
              height={30}
              alt=""
            />
            <i className={styles.onlineDot} />
            <b>{player.nickname}</b>
            <span>
              {Math.ceil(player.hp)}
              <small> / {player.maxHp}</small>
            </span>
          </div>
          <div className={styles.healthTrack}>
            <i style={{ width: `${(100 * player.hp) / player.maxHp}%` }} />
          </div>
          {ally && (
            <div className={styles.ally}>
              <Image
                src={characterImage(ally.character)}
                width={24}
                height={24}
                alt=""
              />
              <span>02 · {ally.nickname}</span>
              <span>
                {!ally.connected
                  ? "복귀 대기"
                  : !ally.alive
                    ? "구조 대기"
                    : `${Math.ceil(ally.hp)} / ${ally.maxHp}`}
              </span>
            </div>
          )}
          <div className={styles.xpRow}>
            <b>Lv.{state.level}</b>
            <div>
              <i style={{ width: `${(100 * state.xp) / state.nextXp}%` }} />
            </div>
          </div>
          {player.shieldRemaining > 0 && (
            <output className={styles.activeShieldBadge} aria-label="무적 아이템 활성화">
              <Icon name="shield" /> SHIELD · {formatShieldTime(player.shieldRemaining)}
            </output>
          )}
        </div>
        <div className={styles.stage}>
          <small>{state.mode === "COOP" ? "2인 협동" : "1인 도전"}</small>
          <strong><Icon name="clock" /> {formatTime(state.combatMillis)}</strong>
          <span>
            {state.phase === "loot"
              ? "전장 정리"
              : state.bossName || `WAVE ${state.wave} / ${state.waveCount}`}
            <i /> 남은 적 {Math.max(0, state.enemyTotal - state.enemiesKilled)}
          </span>
        </div>
        <div className={styles.hudActions}>
          <span className={styles.timerTarget}>
            ★★★ {formatTime(STAGE_MAPS[state.mapId].times[state.mode][0])} 이내
          </span>
          <span className={styles.latency}>{latency} ms</span>
          <button
            title="공유 일시정지 (Esc)"
            aria-label="공유 일시정지"
            onClick={() => runtime.action({ type: "pause" })}
          >
            <Icon name="pause" />
          </button>
          <button
            title="전체 화면"
            aria-label="전체 화면"
            onClick={(event) => {
              const arena = event.currentTarget.closest("section");
              if (document.fullscreenElement) void document.exitFullscreen();
              else if (arena?.requestFullscreen) void arena.requestFullscreen();
            }}
          >
            <Icon name="expand" />
          </button>
        </div>
      </div>
      {boss && (
        <div className={styles.boss}>
          <div>
            <b>{state.bossName} · PHASE {boss.combatPhase ?? 1}</b>
            {!state.objectiveComplete ? <small>공략 필요 · 방어 중</small> : boss.exposed > 0 && (
              <small>약점 노출 {boss.exposed.toFixed(1)}초</small>
            )}
            <span>{Math.ceil((100 * boss.hp) / boss.maxHp)}%</span>
          </div>
          <div>
            <i style={{ width: `${(100 * boss.hp) / boss.maxHp}%` }} />
          </div>
        </div>
      )}
      <div className={styles.buildStrip} aria-label="현재 강화 현황">
        {/* 레벨 자동 성장과 총별 투자 현황을 분리해 보여 준다. */}
        <span title="레벨업 자동 성장">
          <small>
            공격 +{Math.round((playerStats(state.level).damage - 1) * 100)}% ·
            방어 {player.armor}
          </small>
        </span>
        {WEAPON_UPGRADES[player.weapon]
          .filter((id) => player.upgrades[id] > 0)
          .map((id) => (
            <span
              key={id}
              title={`${UPGRADES[id].name} ${player.upgrades[id]}`}
            >
              <UpgradeIcon id={id} />
              <small>{UPGRADES[id].name}</small>
              <b>{player.upgrades[id]}</b>
            </span>
          ))}
      </div>
      {state.phase === "loot" && !state.paused && (
        <div className={styles.clearBanner}>
          <span>STAGE CLEAR</span>
          <strong>{state.stage} 스테이지 클리어</strong>
          <small>다음 전투를 준비해요</small>
        </div>
      )}
      <div className={styles.hudBottom}>
        <div className={styles.weaponInfo}>
          <span>∞</span>
          <div>
            <b>{WEAPONS[player.weapon].name}</b>
            <small>무제한 탄약 · 도전 중 변경 불가</small>
          </div>
        </div>
        <div className={styles.skillBar}>
          <ActionButton
            label="대시"
            hotkey="SPACE"
            cooldown={player.dashCooldown}
            icon="lightning"
            disabled={!player.alive}
            onClick={() => runtime.action({ type: "dash" })}
          />
          {/* 소모 아이템은 바닥 드롭과 같은 방패·하트 색을 사용하고 무적 단축키는 E로 표시한다. */}
          <ActionButton
            label={`무적 ×${player.invuls}`}
            hotkey="E"
            item="invul"
            cooldown={player.invulCooldown}
            icon="shield"
            disabled={!player.alive || !player.invuls}
            onClick={() => runtime.action({ type: "invul" })}
          />
          <ActionButton
            label={`부활 ×${player.revives}`}
            hotkey="R"
            item="revive"
            cooldown={0}
            icon="heart"
            disabled={player.alive || !player.revives}
            onClick={() => runtime.action({ type: "revive", target: "self" })}
          />
          {ally && (
            <ActionButton
              label="아군 부활"
              hotkey="F"
              cooldown={0}
              icon="users"
              disabled={!player.alive || ally.alive || !player.revives}
              onClick={() => runtime.action({ type: "revive", target: "ally" })}
            />
          )}
        </div>
        {/* 조작 설명은 상단 도움말 팝업으로 모으고 하단에는 전투 목표만 표시한다. */}
        <span className={styles.battleObjective} data-urgent={urgent}>{objective}</span>
      </div>
      {/* 작은 화면에서도 목표가 숨겨지지 않게 전투 영역 안에 짧은 임무 배지를 별도로 제공한다. */}
      <div className={styles.missionBadge} data-urgent={urgent}>
        <Icon name="target" /><div><strong>{objective}</strong><span>{state.objectiveHint}</span></div>
      </div>
      {!player.alive && state.phase === "combat" && !state.paused && (
        <div className={styles.deathNotice}>
          <b>전투 불능</b>
          <span>
            {player.revives
              ? "R 키 또는 부활 버튼으로 복귀할 수 있어요."
              : ally?.alive
                ? "아군의 부활 아이템을 기다리고 있어요."
                : "부활 가능한 팀원을 기다리고 있어요."}
          </span>
        </div>
      )}
      {state.phase === "combat" && !state.paused && player.alive && (
        <div className={styles.touchControls}>
          <TouchStick
            label="이동"
            onChange={(x, y) => runtime.setMovement(x, y)}
          />
          <TouchStick
            label="조준 · 사격"
            onChange={(x, y) =>
              runtime.setAim(
                Math.hypot(x, y) > 0.15 ? Math.atan2(y, x) : runtime.aim,
                Math.hypot(x, y) > 0.15,
              )
            }
          />
        </div>
      )}
    </>
  );
}

function ActionButton({
  label,
  hotkey,
  cooldown,
  icon,
  disabled,
  onClick,
  item,
}: {
  label: string;
  hotkey: string;
  cooldown: number;
  icon: Parameters<typeof Icon>[0]["name"];
  disabled: boolean;
  onClick(): void;
  /** 공통 버튼 구조는 유지하고 소모 아이템의 SVG 색만 구분한다. */
  item?: "invul" | "revive";
}) {
  return (
    <button
      className={styles.skillButton}
      data-item={item}
      onClick={onClick}
      disabled={disabled || cooldown > 0}
      aria-label={`${label}${cooldown > 0 ? ` · ${cooldown.toFixed(1)}초` : ""}`}
    >
      <kbd>{hotkey}</kbd>
      <Icon name={icon} />
      <span>{cooldown > 0 ? `${cooldown.toFixed(1)}s` : label}</span>
    </button>
  );
}
function TouchStick({
  label,
  onChange,
}: {
  label: string;
  onChange(x: number, y: number): void;
}) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const pointer = useRef<number | undefined>(undefined);
  const update = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect(),
      radius = bounds.width * 0.33;
    const x = (event.clientX - bounds.left - bounds.width / 2) / radius,
      y = (event.clientY - bounds.top - bounds.height / 2) / radius;
    const length = Math.max(1, Math.hypot(x, y));
    setPosition({ x: (x / length) * radius, y: (y / length) * radius });
    onChange(x / length, y / length);
  };
  const end = () => {
    pointer.current = undefined;
    setPosition({ x: 0, y: 0 });
    onChange(0, 0);
  };
  // 같은 스틱 위에서 끝난 다른 손가락이 현재 조작을 취소하지 않게 포인터를 확인한다.
  const release = (event: PointerEvent<HTMLDivElement>) => {
    if (pointer.current === event.pointerId) end();
  };
  // 포인터 캡처로 스틱 바깥까지 끌어도 방향을 유지하며 멀티터치의 다른 손가락은 무시한다.
  return (
    <div
      className={styles.stick}
      aria-label={`${label} 터치 스틱`}
      onPointerDown={(event) => {
        if (pointer.current !== undefined) return;
        pointer.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        update(event);
      }}
      onPointerMove={(event) => {
        if (pointer.current === event.pointerId) update(event);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      <i style={{ transform: `translate(${position.x}px, ${position.y}px)` }} />
      <span>{label}</span>
    </div>
  );
}
