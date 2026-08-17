import { describe, expect, it } from 'vitest';
import { Game } from './Game';

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
});
