import type * as Model from '../model';
import type { Vec2 } from '../types';
import { AsteroidBelt } from './AsteroidBelt';
import { Camera } from './Camera';
import { CollisionEffects } from './CollisionEffects';
import { Drawing } from './Drawing';
import { ExhaustTrail } from './ExhaustTrail';
import { ExplorationMap } from './ExplorationMap';
import { Hud } from './Hud';
import { MassiveAsteroidField } from './MassiveAsteroidField';
import { Minimap } from './Minimap';
import { PlayerInput } from './PlayerInput';
import { Ship } from './Ship';
import { SpaceBackground } from './SpaceBackground';
import { SupplyField } from './SupplyField';

export class Game implements Model.CollisionObserver {
  private readonly drawing: Drawing;
  private readonly camera = new Camera();
  private readonly hud = new Hud();
  private readonly input: PlayerInput;
  private readonly background = new SpaceBackground();
  private readonly ship = new Ship();
  private readonly asteroidBelt = new AsteroidBelt();
  private readonly massiveAsteroidField = new MassiveAsteroidField();
  private readonly supplyField = new SupplyField();
  private readonly exhaustTrail = new ExhaustTrail();
  private readonly collisionEffects = new CollisionEffects();
  private readonly explorationMap = new ExplorationMap();
  private readonly minimap = new Minimap();

  constructor(canvasSelector: string) {
    this.drawing = new Drawing(canvasSelector);
    this.input = new PlayerInput(this.drawing, () => this.hud.dismissHint());
    this.resize();
    this.drawing.onResize(() => this.resize());
  }

  get isPlayerThrusting(): boolean { return this.input.isThrusting; }
  getThrustTarget(): Vec2 { return this.input.getTarget(this.camera); }
  getSpawnExclusionRadius(): number { return this.camera.getVisibleWorldRadius(this.drawing.size); }

  onCollision(collision: Model.Collision): void {
    this.collisionEffects.emit(collision);
  }

  render(model: Model.Game, dt: number): void {
    this.camera.update(model.ship.position, model.speed, dt);
    this.explorationMap.observe(this.camera.getVisibleWorldBounds(this.drawing.size));
    this.exhaustTrail.update(dt, model.ship);
    this.collisionEffects.update(dt);

    this.background.draw(this.drawing, this.camera.worldPosition);
    this.camera.drawWorld(this.drawing, () => {
      this.massiveAsteroidField.draw(this.drawing, model.massiveAsteroidField, model.ship.position, this.camera);
      this.exhaustTrail.draw(this.drawing);
      this.collisionEffects.draw(this.drawing);
      this.supplyField.draw(this.drawing, model.supplyField);
      this.asteroidBelt.draw(this.drawing, model.asteroidBelt, model.ship.position, this.camera);
      this.ship.draw(this.drawing, model.ship);
    });
    this.background.drawVignette(this.drawing);
    this.minimap.draw(this.drawing, this.explorationMap, model, this.camera);
    this.hud.updateSpeed(model.speed);
    this.hud.updateResources(model.ship.air, model.ship.fuel);
  }

  private resize(): void {
    this.drawing.resize();
    this.background.resize(this.drawing.size);
  }
}
