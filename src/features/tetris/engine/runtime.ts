import {
  ACTIONS,
  MAX_INPUTS,
  TetrisRules,
  type Action,
  type Phase,
  type ReplayInput,
} from "./rules";

export type GameView = Readonly<{
  phase: Phase;
  score: number;
  lines: number;
  level: number;
  hold: number;
  holdUsed: boolean;
  next: number[];
}>;
const KEY_ACTIONS: Readonly<Record<string, Action>> = {
  ArrowLeft: "LEFT",
  ArrowRight: "RIGHT",
  ArrowDown: "DOWN",
  ArrowUp: "CW",
  KeyX: "CW",
  KeyZ: "CCW",
  Space: "DROP",
  KeyC: "HOLD",
  ShiftLeft: "HOLD",
  ShiftRight: "HOLD",
};

/** Phaser에 고정 tick을 공급한다. React에는 표시 값이 바뀔 때만 알리고 입력 재생 로그는 메모리에 제한해 보관한다. */
export class TetrisRuntime {
  game = new TetrisRules(1);
  phase: Phase = "ready";
  inputs: ReplayInput[] = [];
  ghost = true;
  sound = true;
  private accumulator = 0;
  private pending: Action[] = [];
  private held = new Map<Action, number>();
  private audio?: AudioContext;
  private published = "";
  private clearSerial = 0;
  private disposed = false;

  private finished: () => void = () => {};
  constructor(private changed: (view: GameView) => void) {}
  onFinished(callback: () => void) {
    this.finished = callback;
  }
  setSound(value: boolean) {
    this.sound = value;
  }
  setGhost(value: boolean) {
    this.ghost = value;
  }
  activate() {
    this.disposed = false;
  }
  begin(seed: number) {
    this.game = new TetrisRules(seed);
    this.inputs = [];
    this.phase = "playing";
    this.accumulator = 0;
    this.clearSerial = 0;
    this.clearInput();
    this.publish();
  }
  clearInput() {
    this.pending = [];
    this.held.clear();
  }
  pause() {
    if (this.phase !== "playing") return;
    this.phase = "paused";
    this.accumulator = 0;
    this.clearInput();
    this.publish();
  }
  togglePause() {
    if (this.phase === "playing") this.pause();
    else if (this.phase === "paused") {
      this.phase = "playing";
      this.accumulator = 0;
      this.publish();
    }
  }
  press(action: Action) {
    if (this.phase !== "playing" || this.held.has(action)) return;
    // 반대 방향 입력은 가장 최근 입력만 반복한다. OS 키 반복에는 의존하지 않는다.
    if (action === "LEFT") this.held.delete("RIGHT");
    if (action === "RIGHT") this.held.delete("LEFT");
    this.pending.push(action);
    this.held.set(action, this.game.ticks + (action === "DOWN" ? 2 : 9));
  }
  release(action: Action) {
    this.held.delete(action);
  }
  keyDown(event: KeyboardEvent) {
    const element = event.target instanceof HTMLElement ? event.target : null;
    if (
      element?.closest("input,select,textarea,[contenteditable=true],dialog") ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    )
      return;
    if (event.code === "KeyP" || event.code === "Escape") {
      if (this.phase === "playing" || this.phase === "paused") {
        event.preventDefault();
        if (!event.repeat) this.togglePause();
      }
      return;
    }
    const action = KEY_ACTIONS[event.code];
    // 버튼의 Space/Enter 활성화와 게임 하드드롭을 중복 실행하지 않는다.
    if (
      !action ||
      element?.closest("button,a,summary") ||
      this.phase !== "playing"
    )
      return;
    event.preventDefault();
    if (!event.repeat) this.press(action);
  }
  keyUp(event: KeyboardEvent) {
    const action = KEY_ACTIONS[event.code];
    if (action) this.release(action);
  }
  update(delta: number) {
    if (this.disposed || this.phase !== "playing") return;
    // 긴 백그라운드 지연을 한 번에 따라잡지 않는다. 숨김/blur에서는 별도로 자동 일시정지한다.
    this.accumulator += Math.min(delta, 100);
    while (this.accumulator + 1e-7 >= 1000 / 60 && this.phase === "playing") {
      // 부동소수점 나눗셈 오차로 정확한 100ms가 5 tick만 처리되는 경계도 보정한다.
      this.accumulator = Math.max(0, this.accumulator - 1000 / 60);
      for (const [action, next] of this.held)
        if (
          ["LEFT", "RIGHT", "DOWN"].includes(action) &&
          this.game.ticks >= next
        ) {
          this.pending.push(action);
          this.held.set(action, this.game.ticks + 2);
        }
      const actions = this.pending.splice(0, 4);
      if (this.inputs.length + actions.length > MAX_INPUTS) {
        this.end();
        break;
      }
      for (const action of actions)
        this.inputs.push([this.game.ticks + 1, ACTIONS.indexOf(action)]);
      this.game.step(actions);
      if (this.game.clearSerial !== this.clearSerial) {
        this.clearSerial = this.game.clearSerial;
        this.beep(this.game.lastClear === 4 ? 880 : 660);
      } else if (actions.includes("DROP")) this.beep(180);
      if (this.game.over) this.end();
    }
    this.publish();
  }
  private end() {
    this.phase = "over";
    this.clearInput();
    this.publish();
    this.finished();
  }
  stop() {
    if (this.phase === "playing" || this.phase === "paused") this.end();
  }
  private publish() {
    const value: GameView = {
      phase: this.phase,
      score: this.game.score,
      lines: this.game.lines,
      level: this.game.level,
      hold: this.game.hold,
      holdUsed: this.game.holdUsed,
      next: this.game.queue.slice(0, 5),
    };
    const key = JSON.stringify(value);
    if (key !== this.published && !this.disposed) {
      this.published = key;
      this.changed(value);
    }
  }
  /** 사용자의 시작/소리 버튼 입력 안에서만 오디오를 연다. 브라우저 자동재생 정책을 우회하지 않는다. */
  unlockAudio() {
    if (!this.sound) return;
    try {
      this.audio ??= new AudioContext();
      void this.audio.resume().catch(() => {});
    } catch {
      /* 소리 미지원에서도 플레이를 유지한다. */
    }
  }
  private beep(frequency: number) {
    if (!this.sound || !this.audio || this.audio.state !== "running") return;
    const now = this.audio.currentTime,
      oscillator = this.audio.createOscillator(),
      gain = this.audio.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    oscillator.connect(gain);
    gain.connect(this.audio.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.1);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }
  dispose() {
    this.disposed = true;
    this.clearInput();
    void this.audio?.close().catch(() => {});
    this.audio = undefined;
  }
}
