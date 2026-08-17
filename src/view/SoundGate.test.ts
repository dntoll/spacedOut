import { describe, expect, it } from 'vitest';
import { Collision } from '../model/Collision';
import { Damage } from '../model/Damage';
import { LaserShot } from '../model/LaserShot';
import { Camera } from './Camera';
import { SoundGate } from './SoundGate';
import type { SoundSystem } from './SoundSystem';

class FakeSounds {
  laserShot = 0;
  laserImpact = 0;
  asteroidCollision = 0;
  shipCollision = 0;
  onLaserShot(): void { this.laserShot++; }
  onLaserImpact(): void { this.laserImpact++; }
  onAsteroidCollision(): void { this.asteroidCollision++; }
  onShipCollision(): void { this.shipCollision++; }
}

function buildGate(): { gate: SoundGate; sounds: FakeSounds } {
  const camera = new Camera();
  camera.update({ x: 0, y: 0 }, 0, 1); // zoom 1 -> bounds [-100,100] each axis for a 200x200 viewport
  const sounds = new FakeSounds();
  const gate = new SoundGate(camera, sounds as unknown as SoundSystem, () => ({ width: 200, height: 200 }));
  return { gate, sounds };
}

const ONSCREEN = { x: 50, y: -50 };
const OFFSCREEN = { x: 500, y: 500 };

describe('SoundGate', () => {
  it('REQ-45 plays the laser-shot sound for on-screen firings', () => {
    const { gate, sounds } = buildGate();

    gate.onLaserShot(new LaserShot(ONSCREEN));

    expect(sounds.laserShot).toBe(1);
  });

  it('REQ-45 stays silent for laser shots fired off-screen', () => {
    const { gate, sounds } = buildGate();

    gate.onLaserShot(new LaserShot(OFFSCREEN));

    expect(sounds.laserShot).toBe(0);
  });

  it('REQ-45 plays the laser-impact sound for on-screen impacts', () => {
    const { gate, sounds } = buildGate();

    gate.onLaserImpact(new Collision(ONSCREEN, { x: 1, y: 0 }, 100));

    expect(sounds.laserImpact).toBe(1);
  });

  it('REQ-45 stays silent for laser impacts off-screen', () => {
    const { gate, sounds } = buildGate();

    gate.onLaserImpact(new Collision(OFFSCREEN, { x: 1, y: 0 }, 100));

    expect(sounds.laserImpact).toBe(0);
  });

  it('REQ-45 plays the asteroid-collision sound for on-screen collisions', () => {
    const { gate, sounds } = buildGate();

    gate.onAsteroidCollision(new Collision(ONSCREEN, { x: 0, y: 1 }, 200));

    expect(sounds.asteroidCollision).toBe(1);
  });

  it('REQ-45 stays silent for asteroid collisions off-screen', () => {
    const { gate, sounds } = buildGate();

    gate.onAsteroidCollision(new Collision(OFFSCREEN, { x: 0, y: 1 }, 200));

    expect(sounds.asteroidCollision).toBe(0);
  });

  it('REQ-45 plays the ship-collision sound for on-screen damage', () => {
    const { gate, sounds } = buildGate();

    gate.onShipCollision(new Damage(ONSCREEN, 10, false));

    expect(sounds.shipCollision).toBe(1);
  });

  it('REQ-45 stays silent for ship damage dealt off-screen', () => {
    const { gate, sounds } = buildGate();

    gate.onShipCollision(new Damage(OFFSCREEN, 100, true));

    expect(sounds.shipCollision).toBe(0);
  });
});
