import type * as Model from '../model';
import type * as View from '../view';

export class Game {
  private lastTime = performance.now();

  constructor(private model: Model.Game, private view: View.Game) {
    model.addCollisionObserver(view);
  }

  start(): void { requestAnimationFrame((time) => this.frame(time)); }

  private frame(time: number): void {
    const dt = (time - this.lastTime) / 1000;
    this.lastTime = time;
    this.model.setThrustTarget(this.view.getThrustTarget());
    this.model.setSpawnExclusionRadius(this.view.getSpawnExclusionRadius());
    if (this.view.isPlayerThrusting) this.model.startThrust();
    else this.model.stopThrust();
    this.model.update(dt);
    this.view.render(this.model, dt);
    requestAnimationFrame((next) => this.frame(next));
  }
}
