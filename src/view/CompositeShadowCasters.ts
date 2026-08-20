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
  readonly casters: readonly ShadowCaster[];
  private readonly bodies: readonly OutlinedBody[];

  constructor(
    massive: Model.MassiveAsteroidField | null,
    belt: Model.AsteroidBelt | null,
    iceRing?: Model.IceRing | null,
    freighter?: Model.Freighter | null,
  ) {
    const bodies: OutlinedBody[] = [];
    const casters: ShadowCaster[] = [];
    massive?.forEachActive((asteroid) => bodies.push(asteroid));
    belt?.forEach((asteroid) => bodies.push(asteroid));
    iceRing?.forEach((block) => bodies.push(block));
    if (freighter?.isPlaced) bodies.push(freighter);
    for (const body of bodies) casters.push({ position: body.position, radius: body.radius });
    this.bodies = bodies;
    this.casters = casters;
  }

  forEachCaster(visitor: (caster: ShadowCaster) => void): void {
    this.casters.forEach(visitor);
  }

  forEachOutlinedCaster(visitor: (caster: ShadowCaster) => void): void {
    for (const body of this.bodies) visitor(this.caster(body));
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
