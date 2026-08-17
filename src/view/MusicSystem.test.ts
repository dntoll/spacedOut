import { describe, expect, it } from 'vitest';
import { MusicSystem, type AudioTrack, type MusicCategory } from './MusicSystem';

class FakeTrack implements AudioTrack {
  readonly category: MusicCategory;
  readonly duration = 120;
  volume = 0;
  playing = false;
  ended = false;
  private t = 0;

  constructor(category: MusicCategory) { this.category = category; }

  get currentTime(): number { return this.t; }
  set currentTime(value: number) { this.t = value; this.ended = false; }
  play(): void { this.playing = true; }
  pause(): void { this.playing = false; }
}

function tracks(...categories: MusicCategory[]): FakeTrack[] {
  return categories.map((c) => new FakeTrack(c));
}

const DT = 0.1;

function hold(system: MusicSystem, level: number, enemyPursuing: boolean, seconds: number): void {
  const steps = Math.max(1, Math.round(seconds / DT));
  for (let i = 0; i < steps; i++) system.update(level, DT, enemyPursuing);
}

function fire(system: MusicSystem, shots: number): void {
  for (let i = 0; i < shots; i++) system.recordLaserShot();
}

describe('MusicSystem', () => {
  it('REQ-29 stays silent until unlocked', () => {
    const calm = tracks('calm');
    const system = new MusicSystem(calm, { fadeSeconds: 1 });

    system.update(1, 1, false);

    expect(calm[0].playing).toBe(false);
    expect(system.activeCategory).toBeNull();
  });

  it('REQ-29 plays calm as the default when the player is just piloting and idle', () => {
    const calm = tracks('calm', 'calm');
    const medium = tracks('medium', 'medium');
    const action = tracks('action', 'action');
    const system = new MusicSystem([...calm, ...medium, ...action], { fadeSeconds: 1 });
    system.unlock();

    hold(system, 1, false, 1);

    expect(system.activeCategory).toBe('calm');
    expect(calm[0].playing).toBe(true);
    expect(medium[0].playing).toBe(false);
    expect(action[0].playing).toBe(false);
  });

  it('REQ-29 does not leave calm before three laser shots are fired', () => {
    const calm = tracks('calm');
    const medium = tracks('medium');
    const system = new MusicSystem([...calm, ...medium], { fadeSeconds: 1 });
    system.unlock();
    hold(system, 1, false, 1);

    fire(system, 2);
    hold(system, 1, false, 6);

    expect(system.activeCategory).toBe('calm');
  });

  it('REQ-29 switches to medium after three laser shots within five seconds, once the dwell elapses', () => {
    const calm = tracks('calm');
    const medium = tracks('medium');
    const system = new MusicSystem([...calm, ...medium], { fadeSeconds: 1 });
    system.unlock();
    hold(system, 1, false, 1);

    fire(system, 3);
    hold(system, 1, false, 4);
    expect(system.activeCategory).toBe('calm'); // dwell not yet elapsed

    hold(system, 1, false, 2);
    expect(system.activeCategory).toBe('medium');
    expect(medium[0].playing).toBe(true);
  });

  it('REQ-29 requires the three shots to fall within a single five-second window', () => {
    const calm = tracks('calm');
    const medium = tracks('medium');
    const system = new MusicSystem([...calm, ...medium], { fadeSeconds: 1 });
    system.unlock();
    hold(system, 1, false, 1);

    fire(system, 1);
    hold(system, 1, false, 6); // first shot ages out
    fire(system, 1);
    hold(system, 1, false, 6); // second shot ages out
    fire(system, 1);
    hold(system, 1, false, 6); // third shot ages out alone

    expect(system.activeCategory).toBe('calm');
  });

  it('REQ-29 returns to calm when the firing window empties, after the dwell', () => {
    const calm = tracks('calm');
    const medium = tracks('medium');
    const system = new MusicSystem([...calm, ...medium], { fadeSeconds: 1 });
    system.unlock();
    hold(system, 1, false, 1);

    fire(system, 3);
    hold(system, 1, false, 6); // dwell elapses -> medium
    expect(system.activeCategory).toBe('medium');

    hold(system, 1, false, 6); // shots age out, dwell elapses -> calm
    expect(system.activeCategory).toBe('calm');
  });

  it('REQ-29 switches to action immediately when an enemy is pursuing', () => {
    const calm = tracks('calm');
    const action = tracks('action');
    const system = new MusicSystem([...calm, ...action], { fadeSeconds: 1 });
    system.unlock();
    hold(system, 1, false, 1);

    system.update(1, DT, true);

    expect(system.activeCategory).toBe('action');
    expect(action[0].playing).toBe(true);
  });

  it('REQ-29 ends action immediately when no enemy is pursuing', () => {
    const calm = tracks('calm');
    const action = tracks('action');
    const system = new MusicSystem([...calm, ...action], { fadeSeconds: 1 });
    system.unlock();
    hold(system, 1, false, 1);
    hold(system, 1, true, 0.5); // enter action
    expect(system.activeCategory).toBe('action');

    system.update(1, DT, false);

    expect(system.activeCategory).toBe('calm');
    expect(calm[0].playing).toBe(true);
  });

  it('REQ-29 action overrides medium and starts without waiting for the dwell', () => {
    const calm = tracks('calm');
    const medium = tracks('medium');
    const action = tracks('action');
    const system = new MusicSystem([...calm, ...medium, ...action], { fadeSeconds: 1 });
    system.unlock();
    hold(system, 1, false, 1);

    fire(system, 3);
    hold(system, 1, false, 6); // reach medium
    expect(system.activeCategory).toBe('medium');

    system.update(1, DT, true); // enemy appears -> action immediately
    expect(system.activeCategory).toBe('action');
  });

  it('REQ-29 crossfades between categories when the selection changes', () => {
    const calm = tracks('calm');
    const medium = tracks('medium');
    const system = new MusicSystem([...calm, ...medium], { fadeSeconds: 1 });
    system.unlock();
    hold(system, 1, false, 6); // calm active, dwell satisfied, volume full
    expect(calm[0].volume).toBeCloseTo(1, 5);

    fire(system, 3);
    system.update(1, 0.5, false); // dwell already satisfied -> commit medium, halfway crossfade
    expect(calm[0].volume).toBeCloseTo(0.5, 5);
    expect(medium[0].volume).toBeCloseTo(0.5, 5);
    expect(calm[0].playing).toBe(true);
    expect(medium[0].playing).toBe(true);

    system.update(1, 0.5, false); // finish crossfade
    expect(calm[0].volume).toBeCloseTo(0, 5);
    expect(medium[0].volume).toBeCloseTo(1, 5);
    expect(calm[0].playing).toBe(false);
    expect(medium[0].playing).toBe(true);
  });

  it('REQ-29 rotates to the next track when the current song ends', () => {
    const calm = tracks('calm', 'calm');
    const system = new MusicSystem(calm, { fadeSeconds: 1 });
    system.unlock();
    hold(system, 1, false, 1);
    expect(calm[0].playing).toBe(true);

    calm[0].ended = true;
    system.update(1, 0.1, false);

    expect(calm[0].currentTime).toBe(0);
    expect(calm[0].playing).toBe(false);
    expect(calm[1].playing).toBe(true);
  });

  it('REQ-29 resumes a paused track from its remembered position', () => {
    const calm = tracks('calm');
    const medium = tracks('medium');
    const system = new MusicSystem([...calm, ...medium], { fadeSeconds: 0.5 });
    system.unlock();
    hold(system, 1, false, 1);
    calm[0].currentTime = 30;

    fire(system, 3);
    hold(system, 1, false, 6); // switch to medium, calm fades out and pauses
    expect(calm[0].playing).toBe(false);
    expect(calm[0].currentTime).toBe(30);

    hold(system, 1, false, 6); // shots age out, dwell elapses -> calm
    expect(system.activeCategory).toBe('calm');
    expect(calm[0].playing).toBe(true);
    expect(calm[0].currentTime).toBe(30);
  });

  it('REQ-19 REQ-29 fades to silence when the music level is zero', () => {
    const calm = tracks('calm');
    const system = new MusicSystem(calm, { fadeSeconds: 1 });
    system.unlock();
    hold(system, 1, false, 1);
    expect(calm[0].volume).toBeCloseTo(1, 5);

    hold(system, 0, false, 2);
    expect(calm[0].volume).toBeCloseTo(0, 5);
    expect(calm[0].playing).toBe(false);
  });
});
