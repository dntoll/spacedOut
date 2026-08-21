import * as Model from '../model';
import type * as View from '../view';

export class Game {
  private lastTime = performance.now();

  constructor(
    private model: Model.Game,
    private view: View.Game,
    private readonly createModel: (mission?: 1 | 2 | 3 | 4) => Model.Game = (mission) => new Model.Game(
      mission === 2 || mission === 3 || mission === 4 ? { startingMission: mission } : {},
    ),
  ) {
    this.attachObservers(this.model);
  }

  start(): void { requestAnimationFrame((time) => this.frame(time)); }

  private frame(time: number): void {
    const dt = (time - this.lastTime) / 1000;
    this.lastTime = time;
    const selection = this.view.consumeMissionSelection();
    if (selection) {
      this.restart(selection);
    } else if (this.model.isGameOver) {
      if (this.view.consumeRestartRequest()) this.restart();
    } else if (this.model.mission.isPaused) {
      if (this.view.consumeMissionContinueClick()) this.model.advanceMission();
    } else {
      this.model.setThrustTarget(this.view.getThrustTarget());
      this.model.setDirectionalThrust(this.view.getDirectionalThrust());
      this.model.setControlTuning(this.view.getControlTuning());
      this.model.setSpawnExclusionRadius(this.view.getSpawnExclusionRadius());
      if (this.view.isPlayerThrusting) this.model.startThrust();
      else this.model.stopThrust();
      if (this.view.isPlayerFiring) this.model.fireLaser();
    }
    this.model.recordDiscoveredBounds(this.view.getDiscoveredBounds());
    this.model.update(dt);
    this.view.render(this.model, dt);
    requestAnimationFrame((next) => this.frame(next));
  }

  private restart(mission: 1 | 2 | 3 | 4 = 1): void {
    this.model = this.createModel(mission);
    this.attachObservers(this.model);
    this.view.reset();
  }

  private attachObservers(model: Model.Game): void {
    model.addCollisionObserver(this.view);
    model.addDamageObserver(this.view);
    model.addAsteroidDestroyedObserver(this.view);
    model.addLaserShotObserver(this.view);
    model.addLaserImpactObserver(this.view);
    model.addAsteroidCollisionObserver(this.view);
    model.addCollectablePickupObserver(this.view);
    model.addDroneDestroyedObserver(this.view);
    model.addPirateDestroyedObserver(this.view);
    model.addPirateLaserShotObserver(this.view);
    model.addPirateCollisionObserver(this.view);
  }
}
