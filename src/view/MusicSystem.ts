export type MusicCategory = 'calm' | 'medium' | 'action';

const CATEGORIES: readonly MusicCategory[] = ['calm', 'medium', 'action'];

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
  window?: Window;
}

const DWELL_SECONDS = 5;
const SHOT_WINDOW_SECONDS = 5;
const SHOT_THRESHOLD = 3;

export const DEFAULT_MUSIC_FADE_SECONDS = 2.5;

export class MusicSystem {
  private readonly byCategory: Record<MusicCategory, AudioTrack[]> = { calm: [], medium: [], action: [] };
  private readonly index: Record<MusicCategory, number> = { calm: 0, medium: 0, action: 0 };
  private readonly fadeSeconds: number;
  private active: MusicCategory | null = null;
  private unlocked = false;
  private time = 0;
  private categoryTimer = 0;
  private readonly shotTimes: number[] = [];
  private missionUnlock = 0;

  constructor(tracks: AudioTrack[], options?: MusicSystemOptions) {
    this.fadeSeconds = options?.fadeSeconds ?? DEFAULT_MUSIC_FADE_SECONDS;
    for (const track of tracks) this.byCategory[track.category].push(track);
    if (options?.window) this.attachUnlock(options.window);
  }

  static create(): MusicSystem {
    return new MusicSystem(buildTracks(), { window });
  }

  get activeCategory(): MusicCategory | null { return this.active; }

  unlock(): void { this.unlocked = true; }

  recordLaserShot(): void {
    this.shotTimes.push(this.time);
  }

  startMission(mission: 1 | 2 | 3): void {
    this.missionUnlock = mission;
    const list = this.byCategory.calm;
    if (list.length === 0) return;
    const count = Math.min(mission, list.length);
    this.index.calm = count - 1;
    const theme = list[this.index.calm];
    if (theme) {
      theme.currentTime = 0;
      this.active = 'calm';
      this.categoryTimer = 0;
    }
  }

  resetMission(): void {
    this.missionUnlock = 0;
    this.index.calm = 0;
  }

  update(level: number, dt: number, enemyPursuing: boolean): void {
    this.time += dt;
    this.pruneShots();

    if (!this.unlocked) { this.pauseAll(); return; }

    const desired = this.desiredCategory(enemyPursuing);

    if (this.active === null) {
      if (level > 0 && this.categoryCount(desired) > 0) { this.active = desired; this.categoryTimer = 0; }
      else { this.pauseAll(); return; }
    } else if (desired !== this.active) {
      this.categoryTimer += dt;
      const involvesAction = desired === 'action' || this.active === 'action';
      if (involvesAction || this.categoryTimer >= DWELL_SECONDS) {
        if (this.categoryCount(desired) > 0) { this.active = desired; this.categoryTimer = 0; }
      }
    } else {
      this.categoryTimer += dt;
    }

    const cat = this.active;
    if (cat !== null) {
      const ended = this.activeTrack();
      if (ended && ended.ended) {
        ended.volume = 0;
        ended.currentTime = 0;
        ended.pause();
        const count = this.categoryCount(cat);
        if (count > 0) this.index[cat] = (this.index[cat] + 1) % count;
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

  private desiredCategory(enemyPursuing: boolean): MusicCategory {
    if (enemyPursuing) return 'action';
    if (this.shotTimes.length >= SHOT_THRESHOLD) return 'medium';
    return 'calm';
  }

  private categoryCount(cat: MusicCategory): number {
    if (cat === 'calm') return Math.min(this.missionUnlock, this.byCategory.calm.length);
    return this.byCategory[cat].length;
  }

  private pruneShots(): void {
    const cutoff = this.time - SHOT_WINDOW_SECONDS;
    while (this.shotTimes.length > 0 && this.shotTimes[0] < cutoff) this.shotTimes.shift();
  }

  private activeTrack(): AudioTrack | null {
    if (this.active === null) return null;
    const list = this.byCategory[this.active];
    if (this.active === 'calm') {
      const count = this.categoryCount('calm');
      if (count === 0) return null;
      return list[Math.min(this.index.calm, count - 1)] ?? null;
    }
    return list[this.index[this.active]] ?? null;
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
  const calm: { track: AudioTrack; mission: number }[] = [];
  const medium: AudioTrack[] = [];
  const action: AudioTrack[] = [];
  for (const [path, url] of Object.entries(modules)) {
    const name = path.split('/').pop() ?? '';
    const prefix = name.split(/[_\s]/)[0]?.toLowerCase() ?? '';
    const missionMatch = /^mission(\d+)$/.exec(prefix);
    if (missionMatch) {
      calm.push({ track: new HtmlAudioTrack(url, 'calm'), mission: Number(missionMatch[1]) });
    } else if (prefix === 'calm') {
      calm.push({ track: new HtmlAudioTrack(url, 'calm'), mission: Number.MAX_SAFE_INTEGER });
    } else if (prefix === 'medium') {
      medium.push(new HtmlAudioTrack(url, 'medium'));
    } else if (prefix === 'action') {
      action.push(new HtmlAudioTrack(url, 'action'));
    }
  }
  calm.sort((a, b) => a.mission - b.mission);
  return [...calm.map((c) => c.track), ...medium, ...action];
}
