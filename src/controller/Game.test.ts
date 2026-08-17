import { describe, expect, it, vi } from 'vitest';
import type * as Model from '../model';
import type * as View from '../view';
import { Game } from './Game';

const stubModel = (isGameOver: boolean): Model.Game =>
  ({
    isGameOver,
    setThrustTarget: vi.fn(),
    setControlTuning: vi.fn(),
    setSpawnExclusionRadius: vi.fn(),
    startThrust: vi.fn(),
    stopThrust: vi.fn(),
    update: vi.fn(),
    addCollisionObserver: vi.fn(),
    addDamageObserver: vi.fn(),
  }) as unknown as Model.Game;

const stubView = (restart: boolean): View.Game =>
  ({
    isPlayerThrusting: false,
    getThrustTarget: vi.fn(() => ({ x: 0, y: 0 })),
    getDirectionalThrust: vi.fn(() => null),
    getControlTuning: vi.fn(() => ({ dampening: 1, thrustAccel: 1, maxSpeed: 1 })),
    getSpawnExclusionRadius: vi.fn(() => 1000),
    consumeRestartRequest: vi.fn(() => restart),
    render: vi.fn(),
    reset: vi.fn(),
    onCollision: vi.fn(),
    onDamage: vi.fn(),
  }) as unknown as View.Game;

describe('Controller Game', () => {
  it('REQ-36 starts a new game on click after game over', () => {
    vi.stubGlobal('performance', { now: () => 1000 });
    const rafCbs: ((t: number) => void)[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => { rafCbs.push(cb); return rafCbs.length; });

    const deadModel = stubModel(true);
    const freshModel = stubModel(false);
    const createModel = vi.fn(() => freshModel);
    const view = stubView(true);
    const controller = new Game(deadModel, view, createModel);

    controller.start();
    rafCbs[0](1016);

    expect(createModel).toHaveBeenCalledOnce();
    expect(view.reset).toHaveBeenCalledOnce();
    expect(freshModel.addCollisionObserver).toHaveBeenCalledWith(view);
    expect(freshModel.addDamageObserver).toHaveBeenCalledWith(view);
    expect(freshModel.update).toHaveBeenCalled();
    expect(view.render).toHaveBeenCalledWith(freshModel, expect.any(Number));
    expect(deadModel.update).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
