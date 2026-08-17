import { describe, expect, it } from 'vitest';
import { MusicSystem, type AudioTrack, type FlightSignals, type MusicCategory } from './MusicSystem';

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

const IDLE: FlightSignals = { thrust: 0, turn: 0, speed: 0 };
const TURN_REF = 6;
const DT = 0.1;

function turn(rate: number): number { return rate * TURN_REF; }

function hold(system: MusicSystem, signals: FlightSignals, level: number, count = 4): void {
  for (let i = 0; i < count; i++) system.update(signals, level, DT);
}

describe('MusicSystem', () => {
  it('REQ-29 stays silent until unlocked', () => {
    const calm = tracks('calm');
    const system = new MusicSystem(calm, { fadeSeconds: 1, dwellSeconds: 0 });

    system.update(IDLE, 1, 1);

    expect(calm[0].playing).toBe(false);
    expect(system.activeCategory).toBeNull();
  });

  it('REQ-29 selects calm when the ship is idle or making only small adjustments', () => {
    const calm = tracks('calm', 'calm');
    const medium = tracks('medium', 'medium');
    const action = tracks('action', 'action');
    const system = new MusicSystem([...calm, ...medium, ...action], { fadeSeconds: 1, dwellSeconds: 0 });
    system.unlock();

    system.update({ thrust: 0.1, turn: turn(0.05), speed: 0.05 }, 1, DT);

    expect(system.activeCategory).toBe('calm');
    expect(calm[0].playing).toBe(true);
    expect(medium[0].playing).toBe(false);
    expect(action[0].playing).toBe(false);
  });

  it('REQ-29 selects medium under more thrust even without turning', () => {
    const calm = tracks('calm');
    const medium = tracks('medium');
    const action = tracks('action');
    const system = new MusicSystem([...calm, ...medium, ...action], { fadeSeconds: 1, dwellSeconds: 0 });
    system.unlock();
    hold(system, IDLE, 1); // settle baseline

    hold(system, { thrust: 1, turn: 0, speed: 0.5 }, 1); // steady thrust, no turn

    expect(system.activeCategory).toBe('medium');
    expect(medium[0].playing).toBe(true);
  });

  it('REQ-29 requires hard turning plus full speed to reach action', () => {
    const calm = tracks('calm');
    const medium = tracks('medium');
    const action = tracks('action');
    const system = new MusicSystem([...calm, ...medium, ...action], { fadeSeconds: 1, dwellSeconds: 0 });
    system.unlock();
    hold(system, IDLE, 1);

    // full speed, full thrust, but no turning -> medium
    hold(system, { thrust: 1, turn: 0, speed: 1 }, 1);
    expect(system.activeCategory).toBe('medium');

    // add hard turning -> action
    hold(system, { thrust: 1, turn: turn(1), speed: 1 }, 1);
    expect(system.activeCategory).toBe('action');
    expect(action[0].playing).toBe(true);
  });

  it('REQ-29 ignores turning when the ship is not thrusting', () => {
    const calm = tracks('calm');
    const medium = tracks('medium');
    const action = tracks('action');
    const system = new MusicSystem([...calm, ...medium, ...action], { fadeSeconds: 1, dwellSeconds: 0 });
    system.unlock();
    hold(system, IDLE, 1);

    // drifting at moderate speed while turning hard, but no thrust -> calm
    hold(system, { thrust: 0, turn: turn(1), speed: 0.6 }, 1);
    expect(system.activeCategory).toBe('calm');
    expect(calm[0].playing).toBe(true);

    // applying thrust while turning the same amount escalates
    hold(system, { thrust: 1, turn: turn(1), speed: 0.6 }, 1);
    expect(system.activeCategory).not.toBe('calm');
  });

  it('REQ-29 reflects acceleration: a burst raises intensity above steady cruising', () => {
    const calm = tracks('calm');
    const medium = tracks('medium');
    const action = tracks('action');
    const system = new MusicSystem([...calm, ...medium, ...action], { fadeSeconds: 1, dwellSeconds: 0 });
    system.unlock();
    // accelerate hard from rest in one step
    system.update({ thrust: 1, turn: 0, speed: 0.6 }, 1, 0.016);
    const burst = system.intensity;

    // now cruising steady at the same speed
    system.update({ thrust: 1, turn: 0, speed: 0.6 }, 1, 0.016);
    const steady = system.intensity;

    expect(burst).toBeGreaterThan(steady);
  });

  it('REQ-29 applies hysteresis around the medium/action boundary', () => {
    const medium = tracks('medium');
    const action = tracks('action');
    const system = new MusicSystem([...medium, ...action], { fadeSeconds: 1, dwellSeconds: 0 });
    system.unlock();

    hold(system, { thrust: 1, turn: turn(1), speed: 1 }, 1); // action
    expect(system.activeCategory).toBe('action');

    // ease off into the sticky band [0.55, 0.6) -> still action
    hold(system, { thrust: 1, turn: turn(0.6), speed: 0.85 }, 1);
    expect(system.intensity).toBeLessThan(0.6);
    expect(system.intensity).toBeGreaterThanOrEqual(0.55);
    expect(system.activeCategory).toBe('action');

    // drop below the downgrade point -> medium
    hold(system, { thrust: 1, turn: turn(0.4), speed: 0.7 }, 1);
    expect(system.intensity).toBeLessThan(0.55);
    expect(system.activeCategory).toBe('medium');
  });

  it('REQ-29 applies hysteresis around the calm/medium boundary', () => {
    const calm = tracks('calm');
    const medium = tracks('medium');
    const system = new MusicSystem([...calm, ...medium], { fadeSeconds: 1, dwellSeconds: 0 });
    system.unlock();
    hold(system, IDLE, 1);
    expect(system.activeCategory).toBe('calm');

    hold(system, { thrust: 1, turn: 0, speed: 0.5 }, 1); // ~0.32 -> medium
    expect(system.activeCategory).toBe('medium');

    hold(system, { thrust: 0.5, turn: 0, speed: 0.5 }, 1); // ~0.22, still >= 0.20 -> medium
    expect(system.intensity).toBeGreaterThanOrEqual(0.2);
    expect(system.intensity).toBeLessThan(0.25);
    expect(system.activeCategory).toBe('medium');

    hold(system, { thrust: 0.3, turn: 0, speed: 0.3 }, 1); // ~0.14, < 0.20 -> calm
    expect(system.intensity).toBeLessThan(0.2);
    expect(system.activeCategory).toBe('calm');
  });

  it('REQ-29 lowering the action threshold reaches action without turning', () => {
    const calm = tracks('calm');
    const medium = tracks('medium');
    const action = tracks('action');
    const system = new MusicSystem([...calm, ...medium, ...action], { fadeSeconds: 1, dwellSeconds: 0 });
    system.unlock();
    system.setThresholds({ medium: 0.25, action: 0.4 });
    hold(system, IDLE, 1);

    // full thrust + full speed, no turning -> steady intensity ~0.43 >= 0.4 -> action
    hold(system, { thrust: 1, turn: 0, speed: 1 }, 1);
    expect(system.intensity).toBeGreaterThanOrEqual(0.4);
    expect(system.activeCategory).toBe('action');
    expect(action[0].playing).toBe(true);
  });

  it('REQ-29 raising the action threshold keeps full driving in medium', () => {
    const calm = tracks('calm');
    const medium = tracks('medium');
    const action = tracks('action');
    const system = new MusicSystem([...calm, ...medium, ...action], { fadeSeconds: 1, dwellSeconds: 0 });
    system.unlock();
    system.setThresholds({ medium: 0.25, action: 0.95 });
    hold(system, IDLE, 1);

    hold(system, { thrust: 1, turn: turn(1), speed: 1 }, 1); // ~0.72 < 0.95 -> medium
    expect(system.intensity).toBeLessThan(0.95);
    expect(system.activeCategory).toBe('medium');
    expect(action[0].playing).toBe(false);
  });

  it('REQ-29 crossfades between categories when the intensity changes', () => {
    const calm = tracks('calm');
    const medium = tracks('medium');
    const system = new MusicSystem([...calm, ...medium], { fadeSeconds: 1, dwellSeconds: 0 });
    system.unlock();
    system.update(IDLE, 1, 1); // calm fades to full
    expect(calm[0].volume).toBeCloseTo(1, 5);

    system.update({ thrust: 1, turn: 0, speed: 0.5 }, 1, 0.5); // switch to medium, halfway crossfade
    expect(calm[0].volume).toBeCloseTo(0.5, 5);
    expect(medium[0].volume).toBeCloseTo(0.5, 5);
    expect(calm[0].playing).toBe(true);
    expect(medium[0].playing).toBe(true);

    system.update({ thrust: 1, turn: 0, speed: 0.5 }, 1, 0.5); // finish crossfade
    expect(calm[0].volume).toBeCloseTo(0, 5);
    expect(medium[0].volume).toBeCloseTo(1, 5);
    expect(calm[0].playing).toBe(false);
    expect(medium[0].playing).toBe(true);
  });

  it('REQ-29 rotates to the next track when the current song ends', () => {
    const calm = tracks('calm', 'calm');
    const system = new MusicSystem(calm, { fadeSeconds: 1, dwellSeconds: 0 });
    system.unlock();
    system.update(IDLE, 1, 1); // calm[0] active
    expect(calm[0].playing).toBe(true);

    calm[0].ended = true; // simulate song end
    system.update(IDLE, 1, 0.1);

    expect(calm[0].currentTime).toBe(0);
    expect(calm[0].playing).toBe(false);
    expect(calm[1].playing).toBe(true);
  });

  it('REQ-29 resumes a paused track from its remembered position', () => {
    const calm = tracks('calm');
    const medium = tracks('medium');
    const system = new MusicSystem([...calm, ...medium], { fadeSeconds: 1, dwellSeconds: 0 });
    system.unlock();
    system.update(IDLE, 1, 1); // calm active
    calm[0].currentTime = 30; // simulate playback progress

    system.update({ thrust: 1, turn: 0, speed: 0.5 }, 1, 1); // switch to medium, calm fades out
    system.update({ thrust: 1, turn: 0, speed: 0.5 }, 1, 1); // settle fade out
    expect(calm[0].playing).toBe(false);
    expect(calm[0].currentTime).toBe(30);

    system.update(IDLE, 1, 0.1); // switch back to calm
    expect(calm[0].playing).toBe(true);
    expect(calm[0].currentTime).toBe(30);
  });

  it('REQ-29 plays calm when the ship has no speed even under full thrust and turning', () => {
    const calm = tracks('calm');
    const medium = tracks('medium');
    const action = tracks('action');
    const system = new MusicSystem([...calm, ...medium, ...action], { fadeSeconds: 1, dwellSeconds: 0 });
    system.unlock();
    hold(system, IDLE, 1);

    hold(system, { thrust: 1, turn: turn(1), speed: 0 }, 1);
    expect(system.activeCategory).toBe('calm');
    expect(calm[0].playing).toBe(true);
    expect(action[0].playing).toBe(false);

    hold(system, { thrust: 1, turn: turn(1), speed: 1 }, 1);
    expect(system.activeCategory).toBe('action');
  });

  it('REQ-19 REQ-29 fades to silence when the music level is zero', () => {
    const calm = tracks('calm');
    const system = new MusicSystem(calm, { fadeSeconds: 1, dwellSeconds: 0 });
    system.unlock();
    system.update(IDLE, 1, 1); // calm at full
    expect(calm[0].volume).toBeCloseTo(1, 5);

    system.update(IDLE, 0, 1); // mute
    system.update(IDLE, 0, 1); // settle
    expect(calm[0].volume).toBeCloseTo(0, 5);
    expect(calm[0].playing).toBe(false);
  });

  it('REQ-29 holds the current category for the dwell window before switching', () => {
    const calm = tracks('calm');
    const medium = tracks('medium');
    const system = new MusicSystem([...calm, ...medium], { fadeSeconds: 1, dwellSeconds: 5 });
    system.unlock();
    system.update(IDLE, 1, DT); // calm
    expect(system.activeCategory).toBe('calm');

    // intensity jumps well past the medium threshold, but dwell not elapsed
    system.update({ thrust: 1, turn: 0, speed: 0.5 }, 1, 2);
    expect(system.activeCategory).toBe('calm');

    system.update({ thrust: 1, turn: 0, speed: 0.5 }, 1, 2);
    expect(system.activeCategory).toBe('calm');

    // dwell elapsed (5s) -> switch allowed
    system.update({ thrust: 1, turn: 0, speed: 0.5 }, 1, 2);
    expect(system.activeCategory).toBe('medium');
    expect(medium[0].playing).toBe(true);
  });

  it('REQ-29 does not let a second switch immediately follow the first', () => {
    const calm = tracks('calm');
    const medium = tracks('medium');
    const action = tracks('action');
    const system = new MusicSystem([...calm, ...medium, ...action], { fadeSeconds: 1, dwellSeconds: 5 });
    system.unlock();
    system.update({ thrust: 1, turn: turn(1), speed: 1 }, 1, DT); // action
    expect(system.activeCategory).toBe('action');

    // drop to calm-level intensity right after -> held in action by dwell
    system.update(IDLE, 1, 2);
    expect(system.activeCategory).toBe('action');

    system.update(IDLE, 1, 2);
    expect(system.activeCategory).toBe('action');

    // after dwell, finally drops
    system.update(IDLE, 1, 2);
    expect(system.activeCategory).toBe('calm');
  });
});
