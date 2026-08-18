import { describe, expect, it, vi } from 'vitest';
import { AsteroidDestroyed } from './AsteroidDestroyed';
import { AsteroidTier } from './AsteroidTier';
import { CollectablePickup } from './CollectablePickup';
import { DroneDestroyed } from './DroneDestroyed';
import { FuelContainer } from './FuelContainer';
import { Game } from './Game';
import { LaserShot } from './LaserShot';
import { MassiveAsteroid } from './MassiveAsteroid';
import { MissionPhase } from './Mission';
import { PirateDestroyed } from './PirateDestroyed';
import type { SupplyContainer } from './SupplyContainer';
import { WeaponPod } from './WeaponPod';

describe('Game', () => {
  it('REQ-36 reports game over and freezes the simulation when the ship is destroyed', () => {
    const game = new Game();
    expect(game.isGameOver).toBe(false);

    game.ship.takeDamage(100);
    expect(game.isGameOver).toBe(true);

    game.ship.velocity = { x: 500, y: 0 };
    const elapsedBefore = game.elapsed;
    game.update(0.02);

    expect(game.elapsed).toBeCloseTo(elapsedBefore + 0.02, 5);
    expect(game.ship.velocity).toEqual({ x: 500, y: 0 });
  });

  it('REQ-45 forwards laser-shot observers to the laser field', () => {
    const game = new Game();
    const shots: LaserShot[] = [];
    game.addLaserShotObserver({ onLaserShot: (event) => shots.push(event) });
    game.ship.aimAt({ x: 100, y: 0 });
    game.ship.applyControls(0);

    game.fireLaser();

    expect(shots).toHaveLength(1);
  });

  it('REQ-45 forwards collectable-pickup observers to the supply field', () => {
    const game = new Game();
    game.advanceMission();
    const events: CollectablePickup[] = [];
    game.addCollectablePickupObserver({ onCollectablePickup(event) { events.push(event); } });
    const fuel = new FuelContainer({ ...game.ship.position }, 10);
    game.supplyField.drop(fuel);

    game.update(0);

    expect(events).toHaveLength(1);
  });

  it('REQ-52 starts mission 1 paused with the ship at 50% resources', () => {
    const game = new Game();
    expect(game.ship.fuel).toBe(50);
    expect(game.ship.hp).toBe(50);
    expect(game.ship.ammo).toBe(50);
    expect(game.mission.isPaused).toBe(true);

    game.advanceMission();

    expect(game.mission.isPaused).toBe(false);
  });

  it('REQ-51 drops the lowest-meter resource from destroyed asteroids', () => {
    const game = new Game();
    game.ship.aimAt({ x: 1e9, y: 0 });
    game.ship.startThrust();
    for (let i = 0; i < 400 && game.ship.fuel > 0; i++) game.ship.applyControls(0.1);
    expect(game.ship.fuel).toBe(0);
    game.ship.position = { x: 100000, y: 0 };

    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    game.onDestroyed(new AsteroidDestroyed({ ...game.ship.position }, AsteroidTier.Small));
    random.mockRestore();

    const active: SupplyContainer[] = [];
    game.supplyField.forEachActive((container) => active.push(container));
    expect(active.some((container) => container instanceof FuelContainer
      && container.position.x === 100000 && container.position.y === 0)).toBe(true);
  });

  it('REQ-66 starts mission 2 at the briefing with full resources when selected', () => {
    const game = new Game({ startingMission: 2 });
    expect(game.ship.fuel).toBe(100);
    expect(game.ship.hp).toBe(100);
    expect(game.ship.ammo).toBe(100);
    expect(game.mission.phase).toBe(MissionPhase.Mission2Intro);
    expect(game.mission.isPaused).toBe(true);
    expect(game.mission.signalDirection).not.toBeNull();
  });

  it('REQ-62 suppresses ambient massive asteroids when jumping to mission 2 via the menu', () => {
    const game = new Game({ startingMission: 2 });
    const active: MassiveAsteroid[] = [];
    game.massiveAsteroidField.forEachActive((asteroid) => active.push(asteroid));
    const known: MassiveAsteroid[] = [];
    game.massiveAsteroidField.forEachKnown((asteroid) => known.push(asteroid));
    expect(active).toHaveLength(0);
    expect(known).toHaveLength(0);
  });

  it('REQ-68 drops a weapon pod from a destroyed pirate at the 20% threshold', () => {
    const game = new Game();
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.1);

    game.onPirateDestroyed(new PirateDestroyed({ x: 1000, y: 0 }));

    random.mockRestore();
    const active: SupplyContainer[] = [];
    game.supplyField.forEachActive((container) => active.push(container));
    expect(active.some((container) => container instanceof WeaponPod
      && container.position.x === 1000 && container.position.y === 0)).toBe(true);
  });

  it('REQ-68 does not drop a weapon pod above the 20% threshold', () => {
    const game = new Game();
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.5);

    game.onPirateDestroyed(new PirateDestroyed({ x: 1000, y: 0 }));

    random.mockRestore();
    const active: SupplyContainer[] = [];
    game.supplyField.forEachActive((container) => active.push(container));
    expect(active.some((container) => container instanceof WeaponPod)).toBe(false);
  });

  it('REQ-68 drops a fuel/hp/ammo supply container from a destroyed pirate like an asteroid', () => {
    const game = new Game();
    const random = vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.5)
      .mockReturnValue(0);

    game.onPirateDestroyed(new PirateDestroyed({ x: 1000, y: 0 }));

    random.mockRestore();
    const active: SupplyContainer[] = [];
    game.supplyField.forEachActive((container) => active.push(container));
    expect(active.some((container) => !(container instanceof WeaponPod)
      && container.position.x === 1000 && container.position.y === 0)).toBe(true);
    expect(active.some((container) => container instanceof WeaponPod
      && container.position.x === 1000 && container.position.y === 0)).toBe(false);
  });

  it('REQ-68 collects a dropped weapon pod to upgrade the ship weapon', () => {
    const game = new Game();
    game.advanceMission();
    const weaponLevelBefore = game.ship.weaponLevel;
    expect(weaponLevelBefore).toBe(0);

    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    game.onPirateDestroyed(new PirateDestroyed({ ...game.ship.position }));
    vi.restoreAllMocks();

    game.update(0);

    expect(game.ship.weaponLevel).toBe(1);
  });

  it('REQ-72 drops a fuel/hp/ammo supply container from a destroyed drone at the 35% threshold', () => {
    const game = new Game();
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.1);

    game.onDroneDestroyed(new DroneDestroyed({ x: 1000, y: 0 }));

    random.mockRestore();
    const active: SupplyContainer[] = [];
    game.supplyField.forEachActive((container) => active.push(container));
    expect(active.some((container) => !(container instanceof WeaponPod)
      && container.position.x === 1000 && container.position.y === 0)).toBe(true);
    expect(active.some((container) => container instanceof WeaponPod)).toBe(false);
  });

  it('REQ-72 does not drop a supply container from a destroyed drone above the 35% threshold', () => {
    const game = new Game();
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.5);

    game.onDroneDestroyed(new DroneDestroyed({ x: 1000, y: 0 }));

    random.mockRestore();
    const active: SupplyContainer[] = [];
    game.supplyField.forEachActive((container) => active.push(container));
    expect(active.some((container) => !(container instanceof WeaponPod)
      && container.position.x === 1000 && container.position.y === 0)).toBe(false);
  });

  it('REQ-63 does not spawn pirates during the first quarter of the traversal', () => {
    const game = new Game({ startingMission: 2 });
    game.advanceMission();
    game.setSpawnExclusionRadius(1500);
    game.update(0);
    expect(game.mission.distanceRemaining).toBeGreaterThan(game.mission.initialTravelDistance * 0.75);

    game.update(0.1);

    expect(game.pirateField.count).toBe(0);
  });

  it('REQ-63 spawns pirates once the ship has traveled a quarter of the route', () => {
    const game = new Game({ startingMission: 2 });
    game.advanceMission();
    game.setSpawnExclusionRadius(1500);
    game.update(0);
    const destination = game.mission.destinationPosition!;
    const dir = { x: destination.x - game.ship.position.x, y: destination.y - game.ship.position.y };
    const dist = Math.hypot(dir.x, dir.y);
    game.ship.position = {
      x: game.ship.position.x + dir.x / dist * dist * 0.3,
      y: game.ship.position.y + dir.y / dist * dist * 0.3,
    };
    for (let step = 0; step < 60; step++) game.update(0.05);

    expect(game.pirateField.count).toBeGreaterThan(0);
  });
});
