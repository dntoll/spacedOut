import { add, dot, length, normalize, random, scale, sub } from '../math';
import type * as Model from '../model';
import type { Vec2 } from '../types';
import type { Camera } from './Camera';
import type { Drawing, Size } from './Drawing';
import { Particle } from './Particle';

interface Circle { position: Vec2; radius: number }

const TARGET_POPULATION = 240;
const MAX_POPULATION = 600;
const DUST_RADIUS = 1.2;
const BOUNCE_DAMPING = 0.85;
const CULL_MARGIN = 500;

const DUST_COLOR = { r: 120, g: 200, b: 235 };
const COOL_ALPHA = 0.6;
const FUEL_COLOR = { r: 255, g: 195, b: 92 };
const HOT_ALPHA = 0.9;
const IMPACT_HOT_COLOR = { r: 220, g: 250, b: 255 };
const IMPACT_COOL_COLOR = { r: 70, g: 180, b: 255 };
const IMPACT_HOT_ALPHA = 1;
const IMPACT_COOL_ALPHA = 0.8;

export class ParticleField {
  private particles: Particle[] = [];
  private emissionCarry = 0;
  private droneEmissionCarry = 0;
  private visibility = 1;

  setVisibility(v: number): void { this.visibility = Math.max(0, v); }
  reset(): void { this.particles = []; this.emissionCarry = 0; this.droneEmissionCarry = 0; }

  adopt(position: Vec2, velocity: Vec2): void {
    if (this.particles.length >= MAX_POPULATION) return;
    this.particles.push(new Particle(
      { ...position },
      { ...velocity },
      random(1.2, 3.0),
      0,
      0,
      DUST_COLOR,
      COOL_ALPHA,
    ));
  }

  emitCollision(collision: Model.Collision): void {
    const count = Math.min(28, Math.max(4, Math.round(collision.impactSpeed * 0.12)));
    const normalAngle = Math.atan2(collision.normal.y, collision.normal.x);
    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const angle = normalAngle + (side < 0 ? Math.PI : 0) + random(-1.15, 1.15);
      const speed = random(22, 75 + collision.impactSpeed * 0.65);
      const life = random(0.18, 0.58);
      const heat = random(0.55, 1);
      this.particles.push(new Particle(
        { ...collision.position },
        scale({ x: Math.cos(angle), y: Math.sin(angle) }, speed),
        random(1, 3.4),
        life,
        life,
        heat > 0.78 ? IMPACT_HOT_COLOR : IMPACT_COOL_COLOR,
        heat > 0.78 ? IMPACT_HOT_ALPHA : IMPACT_COOL_ALPHA,
      ));
    }
  }

  emitDamageBurst(position: Vec2): void {
    this.burst(position, 40, 40, 220, 0.25, 0.7, 1.5, 3.8);
  }

  emitExplosion(position: Vec2): void {
    this.burst(position, 150, 30, 380, 0.4, 1.2, 2, 5.5);
  }

  private burst(
    position: Vec2,
    count: number,
    speedMin: number,
    speedMax: number,
    lifeMin: number,
    lifeMax: number,
    sizeMin: number,
    sizeMax: number,
  ): void {
    for (let i = 0; i < count; i++) {
      const angle = random(0, Math.PI * 2);
      const speed = random(speedMin, speedMax);
      const life = random(lifeMin, lifeMax);
      const heat = random(0.6, 1);
      this.particles.push(new Particle(
        { ...position },
        scale({ x: Math.cos(angle), y: Math.sin(angle) }, speed),
        random(sizeMin, sizeMax),
        life,
        life,
        heat > 0.78 ? IMPACT_HOT_COLOR : IMPACT_COOL_COLOR,
        heat > 0.78 ? IMPACT_HOT_ALPHA : IMPACT_COOL_ALPHA,
      ));
    }
  }

  update(dt: number, model: Model.Game, camera: Camera, viewport: Size): void {
    if (model.ship.isThrusting && model.ship.isAlive) this.emitExhaust(dt, model.ship);
    this.emitDroneExhaust(dt, model);
    for (const particle of this.particles) particle.update(dt);
    this.bounce(model);
    this.cull(camera, viewport);
    this.spawn(dt, camera, viewport);
  }

  draw(drawing: Drawing): void {
    drawing.withAdditiveBlend(() => {
      for (const particle of this.particles) {
        const t = particle.burnMax > 0 ? particle.burn / particle.burnMax : 0;
        const r = Math.round(DUST_COLOR.r + (particle.hotColor.r - DUST_COLOR.r) * t);
        const g = Math.round(DUST_COLOR.g + (particle.hotColor.g - DUST_COLOR.g) * t);
        const b = Math.round(DUST_COLOR.b + (particle.hotColor.b - DUST_COLOR.b) * t);
        const a = (COOL_ALPHA + (particle.hotAlpha - COOL_ALPHA) * t) * this.visibility;
        drawing.circle(particle.position, particle.size * (0.5 + 0.5 * (1 - t)), `rgba(${r},${g},${b},${a})`);
      }
    });
  }

  private emitExhaust(dt: number, ship: Model.Ship): void {
    const forward = { x: Math.cos(ship.angle), y: Math.sin(ship.angle) };
    const dir = ship.directionalThrust;
    const dirVec = dir?.vec ?? { x: 0, y: 0 };
    const level = dir?.level ?? 0;
    const nozzles = [
      { offset: { x: -15, y: 0 }, emit: { x: -1, y: 0 }, power: ship.pointerThrust + Math.max(0, dirVec.x) * level },
      { offset: { x: 20, y: 0 }, emit: { x: 1, y: 0 }, power: Math.max(0, -dirVec.x) * level },
      { offset: { x: -4, y: -13 }, emit: { x: 0, y: -1 }, power: Math.max(0, dirVec.y) * level },
      { offset: { x: -4, y: 13 }, emit: { x: 0, y: 1 }, power: Math.max(0, -dirVec.y) * level },
    ];
    for (const nozzle of nozzles) {
      if (nozzle.power <= 0.001) continue;
      this.emissionCarry += dt * nozzle.power * (28 + nozzle.power * 46 + ship.speed * 0.06);
      while (this.emissionCarry >= 1) {
        this.emissionCarry--;
        this.particles.push(this.createExhaustParticle(ship, forward, nozzle));
      }
    }
  }

  private emitDroneExhaust(dt: number, model: Model.Game): void {
    model.droneField.forEach((drone) => {
      if (!drone.isHunting) return;
      this.droneEmissionCarry += dt * 22;
      while (this.droneEmissionCarry >= 1) {
        this.droneEmissionCarry--;
        this.particles.push(this.createDroneExhaustParticle(drone));
      }
    });
  }

  private createDroneExhaustParticle(drone: Model.Drone): Particle {
    const back = { x: -Math.cos(drone.angle), y: -Math.sin(drone.angle) };
    const side = { x: -back.y, y: back.x };
    const jitter = random(-1, 1);
    const burn = random(0.3, 0.55);
    const offset = add(scale(back, drone.radius * 0.5), scale(side, jitter * 2));
    return new Particle(
      add(drone.position, offset),
      add(
        scale(drone.velocity, 0.08),
        add(scale(back, random(120, 200)), scale(side, jitter * 14)),
      ),
      random(1.2, 3),
      burn,
      burn,
      FUEL_COLOR,
      HOT_ALPHA,
    );
  }

  private createExhaustParticle(ship: Model.Ship, forward: Vec2, nozzle: { offset: Vec2; emit: Vec2; power: number }): Particle {
    const side = { x: -forward.y, y: forward.x };
    const emitWorld = this.rotate(nozzle.emit, ship.angle);
    const offsetWorld = this.rotate(nozzle.offset, ship.angle);
    const jitter = random(-1, 1);
    const burn = random(0.4, 0.7);
    return new Particle(
      add(ship.position, add(offsetWorld, scale(side, jitter * 3))),
      add(
        scale(ship.velocity, 0.1),
        add(scale(emitWorld, random(150, 230) * (0.55 + nozzle.power * 0.65)), scale(side, jitter * 18)),
      ),
      random(1.5, 4),
      burn,
      burn,
      FUEL_COLOR,
      HOT_ALPHA,
    );
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

  private bounceCircle(particle: Particle, circle: Circle): void {
    const offset = sub(particle.position, circle.position);
    const dist = length(offset);
    const minDist = circle.radius + DUST_RADIUS;
    if (dist >= minDist || dist < 0.0001) return;
    const normal = scale(offset, 1 / dist);
    particle.position = add(circle.position, scale(normal, minDist));
    const vn = dot(particle.velocity, normal);
    if (vn < 0) particle.velocity = sub(particle.velocity, scale(normal, (1 + BOUNCE_DAMPING) * vn));
  }

  private bounceMassive(particle: Particle, asteroid: Model.MassiveAsteroid): void {
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
    const deficit = TARGET_POPULATION - this.particles.length;
    if (deficit <= 0 || dt <= 0) return;
    const center = camera.worldPosition;
    const radius = camera.getVisibleWorldRadius(viewport);
    const toSpawn = Math.min(deficit, Math.max(1, Math.ceil(120 * dt)));
    for (let i = 0; i < toSpawn; i++) {
      const spawnAngle = random(0, Math.PI * 2);
      const dist = random(radius + 10, radius + 90);
      const dirAngle = random(0, Math.PI * 2);
      const speed = random(40, 160);
      this.particles.push(new Particle(
        add(center, { x: Math.cos(spawnAngle) * dist, y: Math.sin(spawnAngle) * dist }),
        { x: Math.cos(dirAngle) * speed, y: Math.sin(dirAngle) * speed },
        random(1.2, 3.0),
        0,
        0,
        DUST_COLOR,
        COOL_ALPHA,
      ));
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
