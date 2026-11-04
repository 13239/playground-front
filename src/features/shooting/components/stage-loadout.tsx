"use client";
import Image from "next/image";
import {
  CHARACTER_IDS,
  SHOOTING_CHARACTERS,
  characterImage,
  STAGE_MAPS,
  type ShootingCharacterId,
  type GameSnapshot,
} from "@playground/shooting-shared";
import type { ReactNode } from "react";
import { TimeTargets } from "./stage-hub";
import styles from "./stage-mode.module.css";

/** 프로필 캐릭터 중 선택한 5종만 노출한다. 캐릭터와 무기를 독립적으로 선택한다. */
export function CharacterChoices({
  value,
  change,
  disabled = false,
}: {
  value: ShootingCharacterId;
  change(value: ShootingCharacterId): void;
  disabled?: boolean;
}) {
  return (
    <section>
      <h3>캐릭터 선택</h3>
      <p>모든 캐릭터의 능력치와 피격 범위는 같아요.</p>
      <div className={styles.characterGrid}>
        {CHARACTER_IDS.map((id) => (
          <button
            key={id}
            data-hover-frame
            aria-pressed={value === id}
            disabled={disabled}
            onClick={() => change(id)}
          >
            <Image
              src={characterImage(id)}
              width={140}
              height={140}
              sizes="(max-width: 700px) 18vw, 9vw"
              alt=""
            />
            <span>{SHOOTING_CHARACTERS[id].name}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function StageLoadout({
  state,
  character,
  changeCharacter,
  children,
  start,
  leave,
  canStart,
}: {
  state: GameSnapshot;
  character: ShootingCharacterId;
  changeCharacter(value: ShootingCharacterId): void;
  children: ReactNode;
  start(): void;
  leave(): void;
  canStart: boolean;
}) {
  return (
    <div className={styles.loadout}>
      <aside className={styles.characterPreview}>
        <strong>{SHOOTING_CHARACTERS[character].name}</strong>
        <Image
          src={characterImage(character)}
          width={360}
          height={360}
          sizes="(max-width: 700px) 112px, 22vw"
          alt="선택한 캐릭터"
        />
        <span>{STAGE_MAPS[state.mapId].name} · 1인 도전</span>
        <TimeTargets mapId={state.mapId} mode={state.mode} />
      </aside>
      <div className={styles.loadoutOptions}>
        <CharacterChoices value={character} change={changeCharacter} />
        <section>
          <h3>무기 선택</h3>
          {children}
        </section>
      </div>
      <footer className={styles.loadoutFooter}>
        <p>선택한 무기는 이번 맵 도전이 끝날 때까지 유지돼요.</p>
        <div>
          <button className={styles.secondary} onClick={leave}>
            맵 선택
          </button>
          <button
            className={styles.primary}
            disabled={!canStart}
            onClick={start}
          >
            {canStart ? "출격" : "전장 불러오는 중…"}
          </button>
        </div>
      </footer>
    </div>
  );
}
