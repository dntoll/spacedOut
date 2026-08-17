import { describe, expect, it } from 'vitest';
import { AirContainer } from './AirContainer';
import { CollectablePickup } from './CollectablePickup';
import { Game } from './Game';
import { LaserShot } from './LaserShot';

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
    const air = new AirContainer({ ...game.ship.position }, 10);
    game.supplyField.drop(air);

    game.update(0);

    expect(events).toHaveLength(1);
  });
});
