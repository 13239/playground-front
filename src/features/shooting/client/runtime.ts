import type { Room } from "@colyseus/sdk";
import {
  connectionMessage,
  movement,
  playerStats,
  WORLD,
  type GameAction,
  type GameSnapshot,
  type InputFrame,
  type Mode,
} from "@playground/shooting-shared";
import { getBrowserKey } from "@/features/auth/client/browser-key";
import { issueTicket } from "./api";
import { admitGame } from "@/features/games/client/admission";

export interface RuntimeView {
  state?: GameSnapshot;
  id: string;
  code: string;
  hosting: boolean;
  connection: "idle" | "connecting" | "connected" | "reconnecting" | "closed";
  message: string;
  latency: number;
}
type WireState = { toJSON(): GameSnapshot };
const base64url = (buffer: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");

/** 좌표·피해·기록은 서버가 결정한다. 클라이언트에는 입력 예측과 현재 연결만 보관하며 복귀 토큰을 저장하지 않는다. */
export class ShootingRuntime {
  private room?: Room<unknown, WireState>;
  private view: RuntimeView = {
    id: "",
    code: "",
    hosting: false,
    connection: "idle",
    message: "",
    latency: 0,
  };
  private listeners = new Set<() => void>();
  private timer?: ReturnType<typeof setInterval>;
  private controller?: AbortController;
  private generation = 0;
  private sequence = 0;
  private lastEmit = 0;
  private lastPing = 0;
  private pending: { frame: InputFrame; dt: number }[] = [];
  private controls = { moveX: 0, moveY: 0, aim: 0, firing: false };
  private predicted?: { x: number; y: number };
  private keys = new Set<string>();
  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  readonly getView = () => this.view;
  get snapshot(): GameSnapshot | undefined {
    return this.view.state;
  }
  get playerId(): string {
    return this.view.id;
  }
  get position(): { x: number; y: number } | undefined {
    return this.predicted;
  }
  get aim(): number {
    return this.controls.aim;
  }

  async connect(sessionId: string, mode: Mode, code?: string): Promise<void> {
    this.disconnect();
    const generation = ++this.generation;
    const controller = new AbortController();
    this.controller = controller;
    this.view = {
      id: "",
      code: "",
      hosting: false,
      connection: "connecting",
      message: "전투 서버에 접속하고 있어요.",
      latency: 0,
    };
    this.emit();
    try {
      // 선택한 모드를 확인한다. 1인 모드가 점검 중이어도 허용된 2인 모드는 이용할 수 있다.
      await admitGame("SHOOTING", mode, sessionId, controller.signal);
      const ticket = await issueTicket(sessionId, mode, controller.signal);
      const target = code || "create";
      let proof: { key?: JsonWebKey; signature?: string } = {};
      if (ticket.proofRequired) {
        const key = await getBrowserKey(false);
        if (!key)
          throw new Error(
            "로그인한 브라우저의 접속 키를 확인하지 못했습니다. 다시 로그인해 주세요.",
          );
        const signature = await crypto.subtle.sign(
          { name: "ECDSA", hash: "SHA-256" },
          key.privateKey,
          new TextEncoder().encode(
            connectionMessage(ticket.ticket, mode, target, location.origin),
          ),
        );
        proof = { key: key.publicKey, signature: base64url(signature) };
      }
      if (generation !== this.generation) return;
      const { Client } = await import("@colyseus/sdk");
      // SDK의 기본 include를 덮어써 로그인 쿠키가 다른 게임 포트로 전송되지 않게 한다.
      const client = new Client(ticket.endpoint, {
        fetchFn: (input, init) =>
          fetch(input, {
            ...init,
            credentials: "omit",
            redirect: "error",
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(12_000),
            ]),
          }),
      });
      const options = { ticket: ticket.ticket, mode, target, ...proof };
      const room = code
        ? await client.joinById<WireState>(code, options)
        : await client.create<WireState>("shooting", options);
      if (generation !== this.generation) {
        void room.leave();
        return;
      }
      this.room = room;
      // 복귀는 현재 문서의 15초 연결 유예에만 허용한다. 조작을 끊긴 소켓에 쌓아 재생하지 않는다.
      Object.assign(room.reconnection, {
        maxRetries: 20,
        minDelay: 250,
        maxDelay: 1500,
        delay: 250,
        minUptime: 0,
        maxEnqueuedMessages: 0,
      });
      this.view = {
        ...this.view,
        id: room.sessionId,
        code: room.roomId,
        hosting: !code,
        connection: "connected",
        message: "",
      };
      room.onStateChange((state) => {
        if (generation !== this.generation) return;
        const previous = this.view.state;
        const snapshot = state.toJSON();
        // 메뉴·공유 정지로 넘어갈 때 눌려 있던 입력을 폐기해 재개 순간의 의도치 않은 이동·사격을 막는다.
        if (
          snapshot.paused ||
          (snapshot.phase !== "combat" && snapshot.phase !== "loot")
        )
          this.clearInput();
        this.view = {
          ...this.view,
          state: snapshot,
          ...(previous?.pauseReason === "authorization" &&
          snapshot.pauseReason !== "authorization"
            ? { message: "" }
            : {}),
        };
        this.reconcile(snapshot);
        if (
          previous?.phase !== snapshot.phase ||
          previous?.paused !== snapshot.paused ||
          performance.now() - this.lastEmit >= 100
        )
          this.emit();
      });
      room.onMessage("welcome", () => {
        /* 참가자 식별자는 검증된 소켓의 sessionId를 사용한다. */
      });
      room.onMessage("notice", (message: unknown) => {
        if (generation !== this.generation) return;
        if (typeof message === "string") {
          this.view = { ...this.view, message };
          this.emit();
        }
      });
      room.onMessage("pong", (sent: number) => {
        if (generation !== this.generation) return;
        this.view = {
          ...this.view,
          latency: Math.round(performance.now() - sent),
        };
      });
      room.onDrop(() => {
        if (generation !== this.generation) return;
        this.clearInput();
        this.view = {
          ...this.view,
          connection: "reconnecting",
          message: "연결 복구 중 · 최대 15초간 전투가 멈춰요.",
        };
        this.emit();
      });
      room.onReconnect(() => {
        if (generation !== this.generation) return;
        this.view = { ...this.view, connection: "connected", message: "" };
        this.emit();
      });
      room.onLeave((code) => {
        if (generation !== this.generation) return;
        this.clearInput();
        clearInterval(this.timer);
        this.view = {
          ...this.view,
          connection: "closed",
          message:
            code === 4001
              ? "방장이 방을 나갔습니다. 다른 방에 참가해 주세요."
              : "게임 연결이 종료되었습니다.",
        };
        this.emit();
      });
      room.onError((_code, message) => {
        // 이전 도전의 지연된 오류가 새 도전의 표시 상태를 덮어쓰지 않는다.
        if (generation !== this.generation) return;
        this.view = {
          ...this.view,
          message: message || "게임 연결을 확인해 주세요.",
        };
        this.emit();
      });
      this.timer = setInterval(() => this.sendInput(), 1000 / 30);
      this.emit();
    } catch (error) {
      if (generation !== this.generation || controller.signal.aborted) return;
      this.view = {
        ...this.view,
        connection: "closed",
        message:
          error instanceof Error
            ? error.message
            : "게임에 접속하지 못했습니다.",
      };
      this.emit();
    }
  }
  disconnect(): void {
    this.generation++;
    this.controller?.abort();
    clearInterval(this.timer);
    const room = this.room;
    this.room = undefined;
    if (room) void room.leave(true);
    this.clearInput();
    this.pending = [];
    this.predicted = undefined;
    this.sequence = 0;
    this.view = {
      id: "",
      code: "",
      hosting: false,
      connection: "idle",
      message: "",
      latency: 0,
    };
    this.emit();
  }
  action(action: GameAction): void {
    if (this.view.connection === "connected") this.room?.send("action", action);
  }
  key(code: string, pressed: boolean): void {
    if (pressed) this.keys.add(code);
    else this.keys.delete(code);
  }
  setMovement(x: number, y: number): void {
    this.controls.moveX = x;
    this.controls.moveY = y;
  }
  setAim(angle: number, firing?: boolean): void {
    this.controls.aim = angle;
    if (firing !== undefined) this.controls.firing = firing;
  }
  clearInput(): void {
    this.keys.clear();
    this.controls.moveX = 0;
    this.controls.moveY = 0;
    this.controls.firing = false;
  }
  private emit(): void {
    this.lastEmit = performance.now();
    for (const listener of this.listeners) listener();
  }
  private sendInput(): void {
    const room = this.room,
      state = this.snapshot;
    if (!room || this.view.connection !== "connected" || !state) return;
    if (performance.now() - this.lastPing > 3000) {
      this.lastPing = performance.now();
      room.send("ping", this.lastPing);
    }
    if (state.paused || !["combat", "loot"].includes(state.phase)) return;
    const x =
      this.controls.moveX +
      Number(this.keys.has("KeyD") || this.keys.has("ArrowRight")) -
      Number(this.keys.has("KeyA") || this.keys.has("ArrowLeft"));
    const y =
      this.controls.moveY +
      Number(this.keys.has("KeyS") || this.keys.has("ArrowDown")) -
      Number(this.keys.has("KeyW") || this.keys.has("ArrowUp"));
    const length = Math.max(1, Math.hypot(x, y));
    const frame: InputFrame = {
      sequence: ++this.sequence,
      moveX: x / length,
      moveY: y / length,
      aim: this.controls.aim,
      firing: this.controls.firing,
    };
    room.send("input", frame);
    this.pending.push({ frame, dt: 1 / 30 });
    if (this.pending.length > 12) this.pending.shift();
    this.reconcile(state);
  }
  private reconcile(state: GameSnapshot): void {
    const player = state.players[this.playerId];
    if (!player) return;
    this.pending = this.pending.filter(
      (input) => input.frame.sequence > player.inputSequence,
    );
    let position = { x: player.x, y: player.y };
    if (
      !state.paused &&
      player.alive &&
      player.dashRemaining <= 0 &&
      ["combat", "loot"].includes(state.phase)
    ) {
      const speed = playerStats(player.upgrades).speed;
      for (const { frame, dt } of this.pending)
        position = movement(
          position.x,
          position.y,
          frame.moveX * speed * dt,
          frame.moveY * speed * dt,
          WORLD.playerRadius,
          state.walls,
        );
    }
    this.predicted = position;
  }
}
