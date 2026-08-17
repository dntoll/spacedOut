import { clamp } from '../math';

export type ThrustPhase = 'idle' | 'starting' | 'looping' | 'ending';

export interface ThrustAudio {
  readonly duration: number;
  readonly currentTime: number;
  readonly playing: boolean;
  play(): void;
  pause(): void;
  seek(time: number): void;
  setVolume(volume: number): void;
}

export interface ThrustSplitOptions {
  startFraction: number;
  endFraction: number;
}

export const DEFAULT_THRUST_SPLITS: ThrustSplitOptions = { startFraction: 0.1, endFraction: 0.1 };

export class ThrustSound {
  private phaseValue: ThrustPhase = 'idle';
  private volume = 0;

  constructor(
    private readonly audio: ThrustAudio,
    private readonly splits: ThrustSplitOptions = DEFAULT_THRUST_SPLITS,
  ) {}

  get currentPhase(): ThrustPhase { return this.phaseValue; }
  get currentVolume(): number { return this.volume; }

  setVolume(volume: number): void {
    this.volume = clamp(volume, 0, 1);
    this.audio.setVolume(this.volume);
  }

  start(): void {
    if (this.phaseValue === 'starting' || this.phaseValue === 'looping') return;
    this.audio.seek(0);
    this.audio.play();
    this.phaseValue = 'starting';
  }

  stop(): void {
    if (this.phaseValue === 'idle' || this.phaseValue === 'ending') return;
    const duration = this.audio.duration;
    if (!Number.isFinite(duration) || duration <= 0) {
      this.audio.pause();
      this.phaseValue = 'idle';
      return;
    }
    this.audio.seek(this.loopEnd(duration));
    this.phaseValue = 'ending';
  }

  update(): void {
    const duration = this.audio.duration;
    if (this.phaseValue === 'idle' || !Number.isFinite(duration) || duration <= 0) return;
    const time = this.audio.currentTime;
    if (this.phaseValue === 'starting') {
      const loopStart = this.loopStart(duration);
      if (time >= loopStart) {
        this.audio.seek(loopStart);
        this.phaseValue = 'looping';
      }
    } else if (this.phaseValue === 'looping') {
      if (time >= this.loopEnd(duration)) this.audio.seek(this.loopStart(duration));
    } else if (this.phaseValue === 'ending') {
      if (time >= duration - 0.001 || !this.audio.playing) {
        this.audio.pause();
        this.phaseValue = 'idle';
      }
    }
  }

  reset(): void {
    this.audio.pause();
    this.phaseValue = 'idle';
  }

  private loopStart(duration: number): number { return this.splits.startFraction * duration; }
  private loopEnd(duration: number): number { return duration - this.splits.endFraction * duration; }
}
