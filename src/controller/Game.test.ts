import { describe, expect, it, vi } from 'vitest';
import type * as Model from '../model';
import type * as View from '../view';
import { Game } from './Game';

const stubModel = (isGameOver: boolean): Model.Game =>
  ({
    isGameOver,
    mission: { isPaused: false },
    advanceMission: vi.fn(),
    setThrustTarget: vi.fn(),
    setDirectionalThrust: vi.fn(),
    setControlTuning: vi.fn(),
    setSpawnExclusionRadius: vi.fn(),
    recordDiscoveredBounds: vi.fn(),
    startThrust: vi.fn(),
    stopThrust: vi.fn(),
    fireLaser: vi.fn(),
    update: vi.fn(),
    addCollisionObserver: vi.fn(),
    addDamageObserver: vi.fn(),
    addAsteroidDestroyedObserver: vi.fn(),
    addLaserShotObserver: vi.fn(),
    addLaserImpactObserver: vi.fn(),
    addAsteroidCollisionObserver: vi.fn(),
    addCollectablePickupObserver: vi.fn(),
    addDroneDestroyedObserver: vi.fn(),
    addPirateDestroyedObserver: vi.fn(),
  }) as unknown as Model.Game;

const stubView = (restart: boolean, firing = false): View.Game =>
  ({
    isPlayerThrusting: false,
    isPlayerFiring: firing,
    getThrustTarget: vi.fn(() => ({ x: 0, y: 0 })),
    getDirectionalThrust: vi.fn(() => null),
    getControlTuning: vi.fn(() => ({ dampening: 1, thrustAccel: 1, maxSpeed: 1 })),
    getSpawnExclusionRadius: vi.fn(() => 1000),
    getDiscoveredBounds: vi.fn(() => ({ left: -500, top: -500, right: 500, bottom: 500 })),
    consumeRestartRequest: vi.fn(() => restart),
    consumeMissionContinueClick: vi.fn(() => false),
    consumeMissionSelection: vi.fn(() => null),
    render: vi.fn(),
    reset: vi.fn(),
    onCollision: vi.fn(),
    onDamage: vi.fn(),
    onDestroyed: vi.fn(),
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
    expect(freshModel.addAsteroidDestroyedObserver).toHaveBeenCalledWith(view);
    expect(freshModel.addLaserShotObserver).toHaveBeenCalledWith(view);
    expect(freshModel.addLaserImpactObserver).toHaveBeenCalledWith(view);
    expect(freshModel.addAsteroidCollisionObserver).toHaveBeenCalledWith(view);
    expect(freshModel.addCollectablePickupObserver).toHaveBeenCalledWith(view);
    expect(freshModel.addDroneDestroyedObserver).toHaveBeenCalledWith(view);
    expect(freshModel.addPirateDestroyedObserver).toHaveBeenCalledWith(view);
    expect(freshModel.update).toHaveBeenCalled();
    expect(view.render).toHaveBeenCalledWith(freshModel, expect.any(Number));
    expect(deadModel.update).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('REQ-45 registers the sound-effect observers with the model on startup', () => {
    const model = stubModel(false);
    const view = stubView(false);
    new Game(model, view);

    expect(model.addLaserShotObserver).toHaveBeenCalledWith(view);
    expect(model.addLaserImpactObserver).toHaveBeenCalledWith(view);
    expect(model.addAsteroidCollisionObserver).toHaveBeenCalledWith(view);
    expect(model.addCollectablePickupObserver).toHaveBeenCalledWith(view);
  });

  it('REQ-39 fires lasers while the player is firing', () => {
    vi.stubGlobal('performance', { now: () => 1000 });
    const rafCbs: ((t: number) => void)[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => { rafCbs.push(cb); return rafCbs.length; });

    const model = stubModel(false);
    const view = stubView(false, true);
    const controller = new Game(model, view);

    controller.start();
    rafCbs[0](1016);

    expect(model.fireLaser).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('REQ-52 advances the mission on a continue click while paused', () => {
    vi.stubGlobal('performance', { now: () => 1000 });
    const rafCbs: ((t: number) => void)[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => { rafCbs.push(cb); return rafCbs.length; });

    const model = stubModel(false);
    (model.mission as { isPaused: boolean }).isPaused = true;
    const view = stubView(false);
    (view.consumeMissionContinueClick as ReturnType<typeof vi.fn>).mockReturnValueOnce(true);
    const controller = new Game(model, view);

    controller.start();
    rafCbs[0](1016);

    expect(model.advanceMission).toHaveBeenCalledOnce();
    expect(model.setThrustTarget).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('REQ-66 restarts at the selected mission when the missions menu picks one', () => {
    vi.stubGlobal('performance', { now: () => 1000 });
    const rafCbs: ((t: number) => void)[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => { rafCbs.push(cb); return rafCbs.length; });

    const deadModel = stubModel(false);
    const freshModel = stubModel(false);
    const createModel = vi.fn((mission?: 1 | 2 | 3) => freshModel);
    const view = stubView(false);
    (view.consumeMissionSelection as ReturnType<typeof vi.fn>).mockReturnValueOnce(2);
    const controller = new Game(deadModel, view, createModel);

    controller.start();
    rafCbs[0](1016);

    expect(createModel).toHaveBeenCalledWith(2);
    expect(view.reset).toHaveBeenCalledOnce();
    expect(freshModel.addCollisionObserver).toHaveBeenCalledWith(view);
    expect(deadModel.update).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('REQ-66 restarts at the mission 3 cheat when selected', () => {
    vi.stubGlobal('performance', { now: () => 1000 });
    const rafCbs: ((t: number) => void)[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => { rafCbs.push(cb); return rafCbs.length; });
    const createModel = vi.fn(() => stubModel(false));
    const view = stubView(false);
    (view.consumeMissionSelection as ReturnType<typeof vi.fn>).mockReturnValueOnce(3);
    const controller = new Game(stubModel(false), view, createModel);

    controller.start();
    rafCbs[0](1016);

    expect(createModel).toHaveBeenCalledWith(3);
    vi.unstubAllGlobals();
  });
});
