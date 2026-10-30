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
import { ShootingAudio } from "./audio";

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
export interface RoomOptions {
  title?: string;
  privateRoom?: boolean;
  password?: string;
  // 방 코드·링크·친구 초대만 특정 방용 참가권을 요청한다.
  entry?: "code";
}
const base64url = (buffer: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");

/** 좌표·피해·기록은 서버가 결정한다. 클라이언트에는 입력 예측과 현재 연결만 보관하며 복귀 토큰을 저장하지 않는다. */
export class ShootingRuntime {
  readonly audio = new ShootingAudio();
  private room?: Room<unknown, WireState>;
  private leaving: Promise<void> = Promise.resolve();
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
  private snapshotReceivedAt = 0;
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
  /** 서버 패치 사이의 표시만 짧게 보간한다. 정지·연결 복구 중에는 보호 시간과 효과를 진행하지 않는다. */
  get snapshotAgeSeconds(): number {
    const state = this.view.state;
    return state && this.view.connection === "connected" && !state.paused && ["combat", "loot"].includes(state.phase)
      ? Math.min(0.15, Math.max(0, (performance.now() - this.snapshotReceivedAt) / 1000)) : 0;
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

  async connect(
    sessionId: string,
    mode: Mode,
    code?: string,
    settings: RoomOptions = {},
  ): Promise<void> {
    const released = this.disconnect();
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
      // 이전 방의 사용권 반환 확인을 기다려 즉시 방 만들기가 중복 접속으로 거절되지 않게 한다.
      await released;
      if (generation !== this.generation) return;
      // 선택한 모드를 확인한다. 1인 모드가 점검 중이어도 허용된 2인 모드는 이용할 수 있다.
      await admitGame("SHOOTING", mode, sessionId, controller.signal);
      const ticket = await issueTicket(sessionId, mode, controller.signal, settings.entry === "code" ? code : undefined);
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
      const options = {
        ticket: ticket.ticket,
        mode,
        target,
        ...proof,
        ...settings,
      };
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
        this.snapshotReceivedAt = performance.now();
        this.audio.update(previous, snapshot, room.sessionId);
        // 같은 소켓의 재도전도 새 입력 시퀀스로 시작해 이전 전투의 예측 이동을 재생하지 않는다.
        if (previous?.phase === "over" && snapshot.phase === "lobby")
          this.sequence = 0;
        // 메뉴·공유 정지로 넘어갈 때 눌려 있던 입력을 폐기해 재개 순간의 의도치 않은 이동·사격을 막는다.
        if (
          snapshot.paused ||
          (snapshot.phase !== "combat" && snapshot.phase !== "loot")
        )
          this.clearInput();
        this.view = {
          ...this.view,
          state: snapshot,
          hosting: snapshot.hostId === room.sessionId,
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
        this.room = undefined;
        this.view = {
          ...this.view,
          connection: "closed",
          message:
            code === 4000
              ? "로그인 또는 게임 참가 권한이 종료되었습니다."
              : "서버와 연결이 끊겼습니다. 다시 입장해 주세요.",
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
  disconnect(): Promise<void> {
    this.generation++;
    this.controller?.abort();
    clearInterval(this.timer);
    const room = this.room;
    this.room = undefined;
    // leave 요청의 확인 응답을 받은 뒤 소켓을 닫는다. 네트워크 단절은 제한 시간 뒤 복구 경로로 넘긴다.
    this.leaving = this.leaving.then(() =>
      room
        ? new Promise<void>((resolve) => {
            const timer = setTimeout(done, 12_000);
            function done() {
              clearTimeout(timer);
              void room!.leave(true);
              resolve();
            }
            room.onMessage("released", done);
            room.onLeave(() => {
              clearTimeout(timer);
              resolve();
            });
            try {
              room.send("leave");
            } catch {
              done();
            }
          })
        : undefined,
    );
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
    return this.leaving;
  }

  /** 알림 닫기는 표시만 지우며 접속 상태·인증 실패 처리를 변경하지 않는다. */
  dismissMessage(): void {
    this.view = { ...this.view, message: "" };
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
    // 정지·퇴장·재도전 경계에서는 미확정 예측 프레임도 버리고 서버 좌표를 따른다.
    this.pending = [];
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
      const speed = playerStats(state.level).speed;
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
