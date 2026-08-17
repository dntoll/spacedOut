export type MusicCategory = 'calm' | 'medium' | 'action';

const CATEGORIES: readonly MusicCategory[] = ['calm', 'medium', 'action'];

export interface FlightSignals {
  thrust: number;
  turn: number;
  speed: number;
}

export interface AudioTrack {
  readonly category: MusicCategory;
  readonly ended: boolean;
  readonly playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  play(): void;
  pause(): void;
}

export interface MusicSystemOptions {
  fadeSeconds?: number;
  dwellSeconds?: number;
  window?: Window;
}

export interface MusicThresholds {
  medium: number;
  action: number;
}

export const MUSIC_HYSTERESIS = 0.05;
export const DEFAULT_MUSIC_THRESHOLDS: MusicThresholds = { medium: 0.25, action: 0.6 };
export const DEFAULT_MUSIC_DWELL_SECONDS = 5;
export const DEFAULT_MUSIC_FADE_SECONDS = 2.5;

const TURN_REF = 6;
const PULSE_TAU = 1.5;
const PULSE_CEIL = 3;
const EDGE_THRESHOLD = 0.05;
const SPEED_CALM_GATE = 0.0001;
const ACCEL_REF = 0.5;
const W_THRUST = 0.2;
const W_SPEED = 0.2;
const W_ACCEL = 0.2;
const W_TURN = 0.3;
const W_PULSE = 0.1;

export class MusicSystem {
  private readonly byCategory: Record<MusicCategory, AudioTrack[]> = { calm: [], medium: [], action: [] };
  private readonly index: Record<MusicCategory, number> = { calm: 0, medium: 0, action: 0 };
  private readonly fadeSeconds: number;
  private readonly dwellSeconds: number;
  private active: MusicCategory | null = null;
  private unlocked = false;
  private pulse = 0;
  private prevThrust = 0;
  private prevSpeed = -1;
  private intensityValue = 0;
  private thresholds: MusicThresholds = { ...DEFAULT_MUSIC_THRESHOLDS };
  private elapsed = 0;
  private lastSwitchAt = 0;

  constructor(tracks: AudioTrack[], options?: MusicSystemOptions) {
    this.fadeSeconds = options?.fadeSeconds ?? DEFAULT_MUSIC_FADE_SECONDS;
    this.dwellSeconds = options?.dwellSeconds ?? DEFAULT_MUSIC_DWELL_SECONDS;
    for (const track of tracks) this.byCategory[track.category].push(track);
    if (options?.window) this.attachUnlock(options.window);
  }

  static create(): MusicSystem {
    return new MusicSystem(buildTracks(), { window });
  }

  get activeCategory(): MusicCategory | null { return this.active; }
  get intensity(): number { return this.intensityValue; }

  unlock(): void { this.unlocked = true; }

  setThresholds(thresholds: MusicThresholds): void {
    this.thresholds = {
      medium: clamp01(thresholds.medium),
      action: clamp01(thresholds.action),
    };
  }

  update(signals: FlightSignals, level: number, dt: number): void {
    this.intensityValue = this.computeIntensity(signals, dt);
    if (!this.unlocked) { this.pauseAll(); return; }
    this.elapsed += dt;
    const target = signals.speed <= SPEED_CALM_GATE ? 'calm' : this.targetCategory(this.intensityValue);
    if (this.active === null) {
      if (level > 0 && this.byCategory[target].length > 0) {
        this.active = target;
        this.lastSwitchAt = this.elapsed;
      } else { this.pauseAll(); return; }
    } else if (target !== this.active && this.byCategory[target].length > 0) {
      if (this.elapsed - this.lastSwitchAt >= this.dwellSeconds) {
        this.active = target;
        this.lastSwitchAt = this.elapsed;
      }
    }

    const cat = this.active;
    if (cat !== null) {
      const ended = this.activeTrack();
      if (ended && ended.ended) {
        ended.volume = 0;
        ended.currentTime = 0;
        ended.pause();
        const list = this.byCategory[cat];
        this.index[cat] = (this.index[cat] + 1) % list.length;
      }
    }

    const active = this.activeTrack();
    const rate = 1 / this.fadeSeconds;
    for (const c of CATEGORIES) {
      for (const track of this.byCategory[c]) {
        const isActive = track === active;
        const targetVol = isActive ? level : 0;
        if (track.volume < targetVol) track.volume = Math.min(targetVol, track.volume + rate * dt);
        else if (track.volume > targetVol) track.volume = Math.max(targetVol, track.volume - rate * dt);
        const wantPlay = isActive && !track.ended && level > 0;
        if (wantPlay) { if (!track.playing) track.play(); }
        else if (track.volume <= 0.0001) { if (track.playing) track.pause(); }
      }
    }
  }

  private computeIntensity(signals: FlightSignals, dt: number): number {
    this.pulse *= Math.exp(-dt / PULSE_TAU);
    if (this.prevThrust <= EDGE_THRESHOLD && signals.thrust > EDGE_THRESHOLD) this.pulse += 1;
    this.prevThrust = signals.thrust;

    const t = clamp01(signals.thrust);
    const s = clamp01(signals.speed);
    const r = clamp01(Math.abs(signals.turn) / TURN_REF);
    const f = clamp01(this.pulse / PULSE_CEIL);

    let a = 0;
    if (this.prevSpeed >= 0 && dt > 0) a = clamp01(Math.abs(s - this.prevSpeed) / (dt * ACCEL_REF));
    this.prevSpeed = s;

    return W_THRUST * t + W_SPEED * s + W_ACCEL * a + W_TURN * (r * t) + W_PULSE * f;
  }

  private activeTrack(): AudioTrack | null {
    if (this.active === null) return null;
    const list = this.byCategory[this.active];
    return list[this.index[this.active]] ?? null;
  }

  private targetCategory(intensity: number): MusicCategory {
    const medUp = this.thresholds.medium;
    const medDown = medUp - MUSIC_HYSTERESIS;
    const actUp = this.thresholds.action;
    const actDown = actUp - MUSIC_HYSTERESIS;
    switch (this.active) {
      case 'calm':   return intensity >= actUp ? 'action' : intensity >= medUp ? 'medium' : 'calm';
      case 'medium': return intensity >= actUp ? 'action' : intensity < medDown ? 'calm' : 'medium';
      case 'action': return intensity < medDown ? 'calm' : intensity < actDown ? 'medium' : 'action';
      default:       return intensity >= actUp ? 'action' : intensity >= medUp ? 'medium' : 'calm';
    }
  }

  private pauseAll(): void {
    for (const cat of CATEGORIES) for (const t of this.byCategory[cat]) if (t.playing) t.pause();
  }

  private attachUnlock(win: Window): void {
    const unlock = (): void => {
      this.unlocked = true;
      win.removeEventListener('pointerdown', unlock);
      win.removeEventListener('keydown', unlock);
    };
    win.addEventListener('pointerdown', unlock);
    win.addEventListener('keydown', unlock);
  }
}

function clamp01(n: number): number { return Math.max(0, Math.min(1, n)); }

class HtmlAudioTrack implements AudioTrack {
  private readonly audio: HTMLAudioElement;
  readonly category: MusicCategory;

  constructor(url: string, category: MusicCategory) {
    this.audio = new Audio(url);
    this.audio.preload = 'auto';
    this.audio.loop = false;
    this.audio.volume = 0;
    this.category = category;
  }

  get ended(): boolean { return this.audio.ended; }
  get playing(): boolean { return !this.audio.paused; }
  get currentTime(): number { return this.audio.currentTime; }
  set currentTime(t: number) { this.audio.currentTime = t; }
  get duration(): number { return this.audio.duration || 0; }
  get volume(): number { return this.audio.volume; }
  set volume(v: number) { this.audio.volume = v; }
  play(): void { void this.audio.play().catch(() => { /* not unlocked yet or interrupted */ }); }
  pause(): void { this.audio.pause(); }
}

function buildTracks(): AudioTrack[] {
  const modules = import.meta.glob('/assets/music/*', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
  const tracks: AudioTrack[] = [];
  for (const [path, url] of Object.entries(modules)) {
    const name = path.split('/').pop() ?? '';
    const prefix = name.split(/[_\s]/)[0]?.toLowerCase() ?? '';
    if (prefix !== 'calm' && prefix !== 'medium' && prefix !== 'action') continue;
    tracks.push(new HtmlAudioTrack(url, prefix));
  }
  return tracks;
}
