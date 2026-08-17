import { add, dot, length, normalize, random, scale, sub } from '../math';
import type * as Model from '../model';
import type { Vec2 } from '../types';
import type { Camera } from './Camera';
import type { Drawing, Size } from './Drawing';

interface DustParticle {
  position: Vec2;
  velocity: Vec2;
  size: number;
  ambient: boolean;
}

interface Circle { position: Vec2; radius: number }

const TARGET_AMBIENT = 240;
const MAX_POPULATION = 600;
const DUST_RADIUS = 1.2;
const BOUNCE_DAMPING = 0.85;
const CULL_MARGIN = 500;

export class SpaceDust {
  private particles: DustParticle[] = [];
  private visibility = 1;

  setVisibility(v: number): void { this.visibility = Math.max(0, v); }
  reset(): void { this.particles = []; }

  adopt(position: Vec2, velocity: Vec2): void {
    if (this.particles.length >= MAX_POPULATION) return;
    const speed = length(velocity);
    const minSpeed = 60;
    const v = speed < minSpeed && speed > 0.0001
      ? scale(velocity, minSpeed / speed)
      : velocity;
    this.particles.push({
      position: { ...position },
      velocity: { ...v },
      size: random(1.2, 3.0),
      ambient: false,
    });
  }

  update(dt: number, model: Model.Game, camera: Camera, viewport: Size): void {
    for (const particle of this.particles) {
      particle.position = add(particle.position, scale(particle.velocity, dt));
    }
    this.bounce(model);
    this.cull(camera, viewport);
    this.spawn(dt, camera, viewport);
  }

  draw(drawing: Drawing): void {
    drawing.withAdditiveBlend(() => {
      for (const particle of this.particles) {
        drawing.circle(particle.position, particle.size, `rgba(120,200,235,${0.6 * this.visibility})`);
      }
    });
  }

  private bounce(model: Model.Game): void {
    const circles: Circle[] = [
      { position: model.ship.position, radius: model.ship.radius },
    ];
    model.asteroidBelt.forEach((asteroid) => {
      circles.push({ position: asteroid.position, radius: asteroid.radius });
    });
    const massives: Model.MassiveAsteroid[] = [];
    model.massiveAsteroidField.forEachActive((asteroid) => massives.push(asteroid));

    for (const particle of this.particles) {
      for (const circle of circles) this.bounceCircle(particle, circle);
      for (const asteroid of massives) this.bounceMassive(particle, asteroid);
    }
  }

  private bounceCircle(particle: DustParticle, circle: Circle): void {
    const offset = sub(particle.position, circle.position);
    const dist = length(offset);
    const minDist = circle.radius + DUST_RADIUS;
    if (dist >= minDist || dist < 0.0001) return;
    const normal = scale(offset, 1 / dist);
    particle.position = add(circle.position, scale(normal, minDist));
    const vn = dot(particle.velocity, normal);
    if (vn < 0) particle.velocity = sub(particle.velocity, scale(normal, (1 + BOUNCE_DAMPING) * vn));
  }

  private bounceMassive(particle: DustParticle, asteroid: Model.MassiveAsteroid): void {
    const offset = sub(particle.position, asteroid.position);
    if (length(offset) >= asteroid.radius + DUST_RADIUS) return;
    const local = this.toLocal(particle.position, asteroid);
    const polygon = this.localPolygon(asteroid);
    if (!this.pointInPolygon(local, polygon)) return;
    const nearest = this.nearestEdge(local, polygon);
    if (!nearest) return;
    const outward = normalize(sub(nearest.point, local));
    if (length(outward) < 0.0001) return;
    const pushedLocal = add(nearest.point, scale(outward, DUST_RADIUS));
    particle.position = this.toWorld(pushedLocal, asteroid);
    const localVel = this.rotate(particle.velocity, -asteroid.angle);
    const vn = dot(localVel, outward);
    if (vn < 0) particle.velocity = this.rotate(sub(localVel, scale(outward, (1 + BOUNCE_DAMPING) * vn)), asteroid.angle);
  }

  private spawn(dt: number, camera: Camera, viewport: Size): void {
    const ambientCount = this.particles.reduce((n, p) => n + (p.ambient ? 1 : 0), 0);
    const deficit = TARGET_AMBIENT - ambientCount;
    if (deficit <= 0 || dt <= 0) return;
    const center = camera.worldPosition;
    const radius = camera.getVisibleWorldRadius(viewport);
    const toSpawn = Math.min(deficit, Math.max(1, Math.ceil(120 * dt)));
    for (let i = 0; i < toSpawn; i++) {
      const spawnAngle = random(0, Math.PI * 2);
      const dist = random(radius + 10, radius + 90);
      const dirAngle = random(0, Math.PI * 2);
      const speed = random(40, 160);
      this.particles.push({
        position: add(center, { x: Math.cos(spawnAngle) * dist, y: Math.sin(spawnAngle) * dist }),
        velocity: { x: Math.cos(dirAngle) * speed, y: Math.sin(dirAngle) * speed },
        size: random(1.2, 3.0),
        ambient: true,
      });
    }
  }

  private cull(camera: Camera, viewport: Size): void {
    const maxDist = camera.getVisibleWorldRadius(viewport) + CULL_MARGIN;
    const center = camera.worldPosition;
    this.particles = this.particles.filter((p) => length(sub(p.position, center)) <= maxDist);
  }

  private localPolygon(asteroid: Model.MassiveAsteroid): Vec2[] {
    return asteroid.vertices.map((variation, index) => {
      const angle = (index / asteroid.vertices.length) * Math.PI * 2;
      return { x: Math.cos(angle) * asteroid.radius * variation, y: Math.sin(angle) * asteroid.radius * variation };
    });
  }

  private nearestEdge(point: Vec2, polygon: Vec2[]): { point: Vec2 } | undefined {
    let best = Infinity;
    let closest = { x: 0, y: 0 };
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i];
      const b = polygon[(i + 1) % polygon.length];
      const cp = this.closestPointOnSegment(point, a, b);
      const d = length(sub(point, cp));
      if (d < best) { best = d; closest = cp; }
    }
    return best === Infinity ? undefined : { point: closest };
  }

  private closestPointOnSegment(point: Vec2, a: Vec2, b: Vec2): Vec2 {
    const edge = sub(b, a);
    const denom = dot(edge, edge);
    if (denom < 0.000001) return { ...a };
    const amount = Math.max(0, Math.min(1, dot(sub(point, a), edge) / denom));
    return add(a, scale(edge, amount));
  }

  private pointInPolygon(point: Vec2, polygon: Vec2[]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y, xj = polygon[j].x, yj = polygon[j].y;
      const intersect = ((yi > point.y) !== (yj > point.y)) && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  private toLocal(point: Vec2, asteroid: Model.MassiveAsteroid): Vec2 {
    return this.rotate(sub(point, asteroid.position), -asteroid.angle);
  }

  private toWorld(point: Vec2, asteroid: Model.MassiveAsteroid): Vec2 {
    return add(this.rotate(point, asteroid.angle), asteroid.position);
  }

  private rotate(point: Vec2, angle: number): Vec2 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return { x: point.x * c - point.y * s, y: point.x * s + point.y * c };
  }
}
