"use client";

import type { Mode, ModeDefinition } from "../contracts";
import { Feedback, Field, formNumber, formText, Reason, useAdminMutation, useAdminScope } from "./admin-ui";
import { GameAvailabilityEditor } from "./game-availability-editor";
import styles from "./admin.module.css";

/** 실제 지원하는 방식과 인원 범위만 사용한다. 1인·2인·다인, 2D·3D를 모드 데이터로 표시한다. */
export function GameModeEditor({ gameCode, mode, definition, saved }: { gameCode: string; mode?: Mode; definition: ModeDefinition; saved: () => void }) {
  const { can } = useAdminScope();
  const mutation = useAdminMutation();
  const path = `games/${gameCode}/modes/${definition.code}`;
  return <section className={styles.inset}>
    <div className={styles.panelHeading}><div><h3>{mode?.name ?? definition.code}</h3><p>{definition.graphicsType === "TWO_D" ? "2D" : "3D"} · {definition.connectionType === "ONLINE" ? "온라인" : "로컬"} · {{ SOLO: "1인 플레이", COMPETITIVE: "경쟁", COOPERATIVE: "협동" }[definition.interactionType]}</p></div><span className={styles.tag}>{mode ? "등록됨" : "미등록"}</span></div>
    <form onSubmit={e => {
      e.preventDefault(); if (!can("GAME_WRITE")) return;
      const form = new FormData(e.currentTarget);
      void mutation.run(path, mode ? "PUT" : "POST", { name: formText(form, "name"), minHumanPlayers: formNumber(form, "minHumanPlayers"), maxHumanPlayers: formNumber(form, "maxHumanPlayers"), sortOrder: formNumber(form, "sortOrder"), expectedVersion: mode?.version ?? 0, reason: formText(form, "reason") }, saved);
    }}><fieldset disabled={!can("GAME_WRITE") || mutation.busy} className={styles.formFields}>
      <Field label="모드 이름"><input name="name" required maxLength={100} defaultValue={mode?.name ?? definition.code} /></Field>
      <div className={styles.formColumns}><Field label="최소 인원"><input name="minHumanPlayers" type="number" min={definition.minHumanPlayers} max={definition.maxHumanPlayers} required defaultValue={mode?.minHumanPlayers ?? definition.minHumanPlayers} /></Field><Field label="최대 인원"><input name="maxHumanPlayers" type="number" min={definition.minHumanPlayers} max={definition.maxHumanPlayers} required defaultValue={mode?.maxHumanPlayers ?? definition.maxHumanPlayers} /></Field></div>
      <p className={styles.hint}>지원 인원: {definition.minHumanPlayers === definition.maxHumanPlayers ? `${definition.minHumanPlayers}명` : `${definition.minHumanPlayers}–${definition.maxHumanPlayers}명`}</p>
      <Field label="노출 순서"><input name="sortOrder" type="number" min={0} max={1000000} required defaultValue={mode?.sortOrder ?? 0} /></Field>
      {can("GAME_WRITE") && <Reason />}
    </fieldset>{can("GAME_WRITE") && <div className={styles.actions}><button className={styles.primary} disabled={mutation.busy}>{mode ? "모드 정보 저장" : "모드 등록"}</button></div>}<Feedback error={mutation.error} success={mutation.success} /></form>
    {mode && <GameAvailabilityEditor key={`availability:${mode.version}`} item={mode} path={`${path}/availability`} saved={saved} title="모드 공개 및 이용 상태" />}
  </section>;
}
