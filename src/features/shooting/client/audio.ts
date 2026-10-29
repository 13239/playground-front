import type { GameSnapshot, WeaponId } from "@playground/shooting-shared";

/** 외부 음원을 내려받지 않는 짧은 합성 효과음이다. 사용자 조작 후에만 AudioContext를 연다. */
export class ShootingAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private enabled = true;
  private lastShot = 0;
  private lastEffect = 0;

  unlock(): void {
    if (!this.enabled || typeof window === "undefined") return;
    try {
      this.context ??= new AudioContext();
      if (!this.master) {
        this.master = this.context.createGain();
        this.master.gain.value = 0.16;
        this.master.connect(this.context.destination);
      }
      if (this.context.state !== "running")
        void this.context.resume().catch(() => {});
    } catch {
      /* 오디오 미지원·브라우저 차단이 게임 접속을 실패시키지는 않는다. */
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (this.master && this.context)
      this.master.gain.setTargetAtTime(
        enabled ? 0.16 : 0,
        this.context.currentTime,
        0.02,
      );
    if (enabled) this.unlock();
  }

  update(
    previous: GameSnapshot | undefined,
    state: GameSnapshot,
    ownId: string,
  ): void {
    if (!previous || state.paused || document.hidden || !this.enabled) return;
    const now = performance.now();
    // 한 번의 상태 패치에 산탄 여러 발이 포함되어도 총성은 발사 주기당 하나만 재생한다.
    const shot = Object.values(state.bullets).find(
      (b) => b.owner === ownId && !b.hostile && !previous.bullets[b.id],
    );
    if (shot && now - this.lastShot > 65) {
      this.lastShot = now;
      this.shot(shot.weapon as WeaponId);
    }
    const self = state.players[ownId],
      prior = previous.players[ownId];
    if (self && prior && self.hp < prior.hp)
      this.tone(150, 55, 0.15, "sawtooth", 0.32);
    if (state.phase !== previous.phase) {
      if (state.phase === "over") this.melody([330, 262, 196]);
      else if (state.phase === "upgrade") this.melody([523, 659, 784]);
      else if (state.phase === "loot") this.melody([392, 523, 784]);
      else if (previous.phase === "lobby" && state.phase === "combat")
        this.melody([262, 392, 523]);
    }
    if (now - this.lastEffect < 90) return;
    const effect = Object.values(state.effects).find(
      (e) =>
        !previous.effects[e.id] &&
        [
          "explosion",
          "enemy-explosion",
          "heal",
          "revive",
          "hit",
          "down",
          "death",
          "boss-death",
        ].includes(e.kind),
    );
    if (!effect) return;
    this.lastEffect = now;
    if (effect.kind.includes("explosion")) this.noise(0.23, 0.8, 500);
    else if (effect.kind === "heal" || effect.kind === "revive")
      this.melody([440, 660]);
    else this.tone(180, 90, 0.045, "triangle", 0.16);
  }

  close(): void {
    const context = this.context;
    this.context = undefined;
    this.master = undefined;
    if (context) void context.close().catch(() => {});
  }

  private shot(weapon: WeaponId): void {
    this.noise(
      weapon === "rifle" ? 0.055 : 0.12,
      weapon === "sniper" ? 0.7 : 0.42,
      weapon === "launcher" ? 400 : 1800,
    );
    this.tone(weapon === "launcher" ? 110 : 220, 45, 0.08, "triangle", 0.5);
  }
  private melody(notes: number[]): void {
    notes.forEach((note, i) =>
      this.tone(note, note, 0.17, "sine", 0.38, i * 0.11),
    );
  }
  private tone(
    from: number,
    to: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    delay = 0,
  ): void {
    const context = this.context;
    if (
      !context ||
      context.state !== "running" ||
      !this.master ||
      !this.enabled
    )
      return;
    const oscillator = context.createOscillator(),
      gain = context.createGain(),
      start = context.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, start);
    oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }
  private noise(duration: number, volume: number, frequency: number): void {
    const context = this.context;
    if (
      !context ||
      context.state !== "running" ||
      !this.master ||
      !this.enabled
    )
      return;
    const buffer = context.createBuffer(
      1,
      Math.ceil(context.sampleRate * duration),
      context.sampleRate,
    );
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++)
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
    const source = context.createBufferSource(),
      filter = context.createBiquadFilter(),
      gain = context.createGain();
    source.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.value = frequency;
    gain.gain.value = volume;
    source.connect(filter).connect(gain).connect(this.master);
    source.start();
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }
}
