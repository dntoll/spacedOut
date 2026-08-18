import type * as Model from '../model';
import type { Vec2 } from '../types';
import type { OutlinedShadowCasters, ShadowCaster } from './StarLight';

interface OutlinedBody {
  position: Vec2;
  angle: number;
  radius: number;
  vertices: number[];
}

export class CompositeShadowCasters implements OutlinedShadowCasters {
  constructor(
    private readonly massive: Model.MassiveAsteroidField | null,
    private readonly belt: Model.AsteroidBelt | null,
  ) {}

  forEachCaster(visitor: (caster: ShadowCaster) => void): void {
    this.massive?.forEachActive((asteroid) => visitor({ position: asteroid.position, radius: asteroid.radius }));
    this.belt?.forEach((asteroid) => visitor({ position: asteroid.position, radius: asteroid.radius }));
  }

  forEachOutlinedCaster(visitor: (caster: ShadowCaster) => void): void {
    this.massive?.forEachActive((asteroid) => visitor(this.caster(asteroid)));
    this.belt?.forEach((asteroid) => visitor(this.caster(asteroid)));
  }

  private caster(body: OutlinedBody): ShadowCaster {
    return { position: body.position, radius: body.radius, outline: this.worldOutline(body) };
  }

  private worldOutline(body: OutlinedBody): Vec2[] {
    const { position, angle, radius, vertices } = body;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return vertices.map((variation, index) => {
      const a = (index / vertices.length) * Math.PI * 2;
      const lx = Math.cos(a) * radius * variation;
      const ly = Math.sin(a) * radius * variation;
      return { x: position.x + lx * cos - ly * sin, y: position.y + lx * sin + ly * cos };
    });
  }
}
