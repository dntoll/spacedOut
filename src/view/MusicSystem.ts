export type MusicCategory = 'calm' | 'medium' | 'action';

const CATEGORIES: readonly MusicCategory[] = ['calm', 'medium', 'action'];

export interface FlightSignals {
  thrust: number;
  turn: number;
  firing: number;
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
  decaySeconds?: number;
  window?: Window;
}

export interface MusicThresholds {
  medium: number;
  action: number;
}

export const DEFAULT_MUSIC_THRESHOLDS: MusicThresholds = { medium: 0.25, action: 0.6 };
export const DEFAULT_MUSIC_FADE_SECONDS = 2.5;
export const DEFAULT_MUSIC_DECAY_SECONDS = 3;
const THRESHOLD_FLOOR = 0.01;

const TURN_REF = 6;
const THRUST_RATE = 0.1;
const TURN_RATE = 0.1;
const FIRING_RATE = 0.05;
const FIRING_REF = 5;
const SPIKE_EXPLOSION = 0.1;
const SPIKE_SHIP_DAMAGE = 0.3;
const SPIKE_LASER_IMPACT = 0.08;

export class MusicSystem {
  private readonly byCategory: Record<MusicCategory, AudioTrack[]> = { calm: [], medium: [], action: [] };
  private readonly index: Record<MusicCategory, number> = { calm: 0, medium: 0, action: 0 };
  private readonly fadeSeconds: number;
  private decaySeconds: number;
  private active: MusicCategory | null = null;
  private unlocked = false;
  private intensityValue = 0;
  private thresholds: MusicThresholds = { ...DEFAULT_MUSIC_THRESHOLDS };

  constructor(tracks: AudioTrack[], options?: MusicSystemOptions) {
    this.fadeSeconds = options?.fadeSeconds ?? DEFAULT_MUSIC_FADE_SECONDS;
    this.decaySeconds = options?.decaySeconds ?? DEFAULT_MUSIC_DECAY_SECONDS;
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

  setDecay(seconds: number): void { this.decaySeconds = Math.max(0.1, seconds); }

  recordExplosion(): void { this.intensityValue = clamp01(this.intensityValue + SPIKE_EXPLOSION); }
  recordShipDamage(): void { this.intensityValue = clamp01(this.intensityValue + SPIKE_SHIP_DAMAGE); }
  recordLaserImpact(): void { this.intensityValue = clamp01(this.intensityValue + SPIKE_LASER_IMPACT); }

  update(signals: FlightSignals, level: number, dt: number): void {
    this.intensityValue = clamp01(this.intensityValue * Math.exp(-dt / this.decaySeconds));
    const thrust = clamp01(signals.thrust);
    const turnBoost = clamp01(Math.abs(signals.turn) / TURN_REF) * thrust;
    const firing = clamp01(signals.firing / FIRING_REF);
    const charge = (THRUST_RATE * thrust) + (TURN_RATE * turnBoost) + (FIRING_RATE * firing);
    this.intensityValue = clamp01(this.intensityValue + charge * dt);

    if (!this.unlocked) { this.pauseAll(); return; }
    const target = this.targetCategory(this.intensityValue);
    if (this.active === null) {
      if (level > 0 && this.byCategory[target].length > 0) this.active = target;
      else { this.pauseAll(); return; }
    } else if (target !== this.active && this.byCategory[target].length > 0) {
      this.active = target;
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

  private activeTrack(): AudioTrack | null {
    if (this.active === null) return null;
    const list = this.byCategory[this.active];
    return list[this.index[this.active]] ?? null;
  }

  private targetCategory(intensity: number): MusicCategory {
    if (intensity >= this.thresholds.action) return 'action';
    if (intensity >= this.thresholds.medium) return 'medium';
    return 'calm';
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

export { THRESHOLD_FLOOR };
