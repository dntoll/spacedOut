import * as Model from '../model';
import type * as View from '../view';

export class Game {
  private lastTime = performance.now();

  constructor(
    private model: Model.Game,
    private view: View.Game,
    private readonly createModel: () => Model.Game = () => new Model.Game(),
  ) {
    model.addCollisionObserver(view);
    model.addDamageObserver(view);
  }

  start(): void { requestAnimationFrame((time) => this.frame(time)); }

  private frame(time: number): void {
    const dt = (time - this.lastTime) / 1000;
    this.lastTime = time;
    if (this.model.isGameOver) {
      if (this.view.consumeRestartRequest()) this.restart();
    } else {
      this.model.setThrustTarget(this.view.getThrustTarget());
      this.model.setDirectionalThrust(this.view.getDirectionalThrust());
      this.model.setControlTuning(this.view.getControlTuning());
      this.model.setSpawnExclusionRadius(this.view.getSpawnExclusionRadius());
      if (this.view.isPlayerThrusting) this.model.startThrust();
      else this.model.stopThrust();
    }
    this.model.update(dt);
    this.view.render(this.model, dt);
    requestAnimationFrame((next) => this.frame(next));
  }

  private restart(): void {
    this.model = this.createModel();
    this.model.addCollisionObserver(this.view);
    this.model.addDamageObserver(this.view);
    this.view.reset();
  }
}
