import { describe, expect, it, vi } from 'vitest';
import { AsteroidDestroyed } from './AsteroidDestroyed';
import { AsteroidTier } from './AsteroidTier';
import { CollectablePickup } from './CollectablePickup';
import { FuelContainer } from './FuelContainer';
import { Game } from './Game';
import { LaserShot } from './LaserShot';
import type { SupplyContainer } from './SupplyContainer';

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
    const events: CollectablePickup[] = [];
    game.addCollectablePickupObserver({ onCollectablePickup(event) { events.push(event); } });
    const fuel = new FuelContainer({ ...game.ship.position }, 10);
    game.supplyField.drop(fuel);

    game.update(0);

    expect(events).toHaveLength(1);
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
});
