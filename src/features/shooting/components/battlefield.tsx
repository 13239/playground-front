"use client";
import { useEffect, useRef, useState } from "react";
import type { ShootingRuntime } from "../client/runtime";
import styles from "./shooting.module.css";

let renderer: Promise<typeof import("../engine/arena")> | undefined;
/** 인증된 대기 화면에서 코드만 미리 읽고 GPU 렌더러는 전투 시작 때 생성한다. 실패한 읽기는 다시 시도할 수 있다. */
export function preloadBattlefield() {
  return (renderer ??= import("../engine/arena").catch((error) => {
    renderer = undefined;
    throw error;
  }));
}

/** Phaser 표시는 인증 확인 뒤 지연 로딩한다. 실제 전투 연결은 선택한 모드의 입장 확인을 별도로 거친다. */
export function Battlefield({ runtime }: { runtime: ShootingRuntime }) {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false,
      arena: { destroy(): void } | undefined;
    void preloadBattlefield()
      .then(({ createArena }) => {
        if (!cancelled && host.current)
          arena = createArena(host.current, runtime);
      })
      .catch(() => {
        if (!cancelled)
          setError(
            "전장을 표시하지 못했어요. 브라우저의 그래픽 가속 설정을 확인해 주세요.",
          );
      });
    return () => {
      cancelled = true;
      arena?.destroy();
    };
  }, [runtime, attempt]);
  useEffect(() => {
    const key = (event: KeyboardEvent, pressed: boolean) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.matches("input,textarea,select") || target.isContentEditable)
      )
        return;
      if (
        !runtime.snapshot ||
        runtime.snapshot.phase === "lobby" ||
        runtime.snapshot.phase === "over"
      )
        return;
      if (
        [
          "KeyW",
          "KeyA",
          "KeyS",
          "KeyD",
          "ArrowUp",
          "ArrowLeft",
          "ArrowDown",
          "ArrowRight",
        ].includes(event.code)
      ) {
        if (
          !runtime.snapshot.paused &&
          ["combat", "loot"].includes(runtime.snapshot.phase)
        ) {
          event.preventDefault();
          runtime.key(event.code, pressed);
        }
      }
      if (!pressed || event.repeat) return;
      const actions = {
        Space: { type: "dash" },
        // 전투 입력은 이동·대시와 소모 아이템만 제공하며 무적은 HUD와 같은 E 키를 사용한다.
        KeyE: { type: "invul" },
        KeyR: { type: "revive", target: "self" },
        KeyF: { type: "revive", target: "ally" },
        Escape: { type: "pause" },
      } as const;
      const action = actions[event.code as keyof typeof actions];
      if (
        action &&
        (event.code === "Escape" ||
          (["combat", "loot"].includes(runtime.snapshot.phase) &&
            !runtime.snapshot.paused))
      ) {
        event.preventDefault();
        runtime.action(action);
      }
    };
    const down = (event: KeyboardEvent) => key(event, true),
      up = (event: KeyboardEvent) => key(event, false);
    const blur = () => {
      runtime.clearInput();
      const state = runtime.snapshot;
      if (
        state &&
        state.phase !== "lobby" &&
        state.phase !== "over" &&
        !state.paused
      )
        runtime.action({ type: "pause" });
    };
    const release = () => runtime.setAim(runtime.aim, false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    window.addEventListener("pointerup", release);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      window.removeEventListener("pointerup", release);
      runtime.clearInput();
    };
  }, [runtime]);
  return (
    <>
      <div
        ref={host}
        className={styles.canvas}
        tabIndex={0}
        aria-label="전투 조작 영역"
      />
      {error && (
        <div className={styles.graphicsError} role="alert">
          {error}
          <button
            onClick={() => {
              setError("");
              setAttempt((value) => value + 1);
            }}
          >
            다시 표시
          </button>
        </div>
      )}
    </>
  );
}
