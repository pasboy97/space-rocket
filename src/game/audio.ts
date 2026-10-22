/**
 * 100% Procedural Web Audio Retro-Pixel & Space Telemetry Synthesizer
 */
class SpaceNetAudioEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;
  private thrusterGain: GainNode | null = null;
  private thrusterOsc: OscillatorNode | null = null;

  constructor() {
    // Lazy-init AudioContext on first user interaction
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    if (mute) {
      this.stopThrusterLoop();
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  public updateThruster(throttle: number): void {
    if (this.muted || throttle <= 0.02) {
      this.stopThrusterLoop();
      return;
    }
    const ctx = this.ensureContext();
    if (!ctx) return;

    if (!this.thrusterOsc || !this.thrusterGain) {
      const osc = ctx.createOscillator();
      const sub = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      sub.type = 'square';
      osc.frequency.value = 58;
      sub.frequency.value = 29;

      filter.type = 'lowpass';
      filter.frequency.value = 210;

      gain.gain.value = 0.001;

      osc.connect(filter);
      sub.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      sub.start();

      this.thrusterOsc = osc;
      this.thrusterGain = gain;
    }

    const now = ctx.currentTime;
    const targetFreq = 52 + throttle * 46 + (Math.random() - 0.5) * 6;
    const targetGain = Math.min(0.11, throttle * 0.11);
    this.thrusterOsc.frequency.setTargetAtTime(targetFreq, now, 0.04);
    this.thrusterGain.gain.setTargetAtTime(targetGain, now, 0.04);
  }

  public stopThrusterLoop(): void {
    if (this.thrusterGain && this.ctx) {
      try {
        this.thrusterGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.03);
      } catch {
        // ignore
      }
    }
  }

  public playRingSync(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      const t = ctx.currentTime + idx * 0.045;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.13);
    });
  }

  public playBoostBurst(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(640, now + 0.14);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  public playLanding(grade: 'perfect' | 'safe' | 'hard' | 'crash'): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (grade === 'perfect' || grade === 'safe') {
      const chord = grade === 'perfect' ? [440, 554.37, 659.25, 880] : [392, 493.88, 587.33];
      chord.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        const start = now + i * 0.05;
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.09, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.26);
      });
    } else {
      this.playHullHit();
    }
  }

  public playTelegraphAlert(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.linearRampToValueAtTime(760, now + 0.22);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  public playHullHit(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(36, now + 0.28);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.32);
  }

  public playOutcomeSting(victory: boolean): void {
    this.stopThrusterLoop();
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const seq = victory ? [523.25, 659.25, 783.99, 1046.5, 1318.5] : [349.23, 311.13, 277.18, 207.65];
    seq.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = victory ? 'square' : 'sawtooth';
      const t = now + idx * 0.09;
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.09, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }
}

export const soundEngine = new SpaceNetAudioEngine();
