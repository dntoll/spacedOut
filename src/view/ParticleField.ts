import { add, dot, length, random, scale, sub } from '../math';
import type * as Model from '../model';
import type { Vec2 } from '../types';
import type { Camera } from './Camera';
import type { Drawing, Size } from './Drawing';
import { Particle } from './Particle';
import type { ShadowCasters, StarLight } from './StarLight';

interface Circle { position: Vec2; radius: number }
interface MassiveCollider extends Circle {
  polygon: Vec2[];
  cos: number;
  sin: number;
}

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
const BRIGHT_HEAT_THRESHOLD = 0.6;

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
      const life = random(0.5, 1.4);
      const heat = random(0.55, 1);
      this.particles.push(new Particle(
        { ...collision.position },
        scale({ x: Math.cos(angle), y: Math.sin(angle) }, speed),
        random(1, 3.4),
        life,
        life,
        heat > BRIGHT_HEAT_THRESHOLD ? IMPACT_HOT_COLOR : IMPACT_COOL_COLOR,
        heat > BRIGHT_HEAT_THRESHOLD ? IMPACT_HOT_ALPHA : IMPACT_COOL_ALPHA,
      ));
    }
  }

  emitDamageBurst(position: Vec2): void {
    this.burst(position, 40, 40, 220, 0.7, 1.8, 1.5, 3.8);
  }

  emitExplosion(position: Vec2, hotColor: { r: number; g: number; b: number } = IMPACT_HOT_COLOR): void {
    this.burst(position, 150, 30, 380, 1.0, 2.5, 2, 5.5, hotColor);
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
    hotColor: { r: number; g: number; b: number } = IMPACT_HOT_COLOR,
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
        heat > BRIGHT_HEAT_THRESHOLD ? hotColor : IMPACT_COOL_COLOR,
        heat > BRIGHT_HEAT_THRESHOLD ? IMPACT_HOT_ALPHA : IMPACT_COOL_ALPHA,
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

  draw(drawing: Drawing, starLight?: StarLight, casters?: ShadowCasters | null): void {
    const shadowCasters = casters ?? null;
    drawing.withAdditiveBlend(() => {
      for (const particle of this.particles) {
        const t = particle.burnMax > 0 ? particle.burn / particle.burnMax : 0;
        const r = Math.round(DUST_COLOR.r + (particle.hotColor.r - DUST_COLOR.r) * t);
        const g = Math.round(DUST_COLOR.g + (particle.hotColor.g - DUST_COLOR.g) * t);
        const b = Math.round(DUST_COLOR.b + (particle.hotColor.b - DUST_COLOR.b) * t);
        let a = (COOL_ALPHA + (particle.hotAlpha - COOL_ALPHA) * t) * this.visibility;
        if (starLight) a = starLight.particleAlpha(particle.position, a, shadowCasters);
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
    const massives: MassiveCollider[] = [];
    model.massiveAsteroidField.forEachActive((asteroid) => massives.push({
      position: asteroid.position,
      radius: asteroid.radius,
      polygon: this.localPolygon(asteroid),
      cos: Math.cos(asteroid.angle),
      sin: Math.sin(asteroid.angle),
    }));

    for (const particle of this.particles) {
      for (const circle of circles) this.bounceCircle(particle, circle);
      for (const asteroid of massives) this.bounceMassive(particle, asteroid);
    }
  }

  private bounceCircle(particle: Particle, circle: Circle): void {
    const minDist = circle.radius + DUST_RADIUS;
    const dx = particle.position.x - circle.position.x;
    if (Math.abs(dx) >= minDist) return;
    const dy = particle.position.y - circle.position.y;
    if (Math.abs(dy) >= minDist) return;
    const distSq = dx * dx + dy * dy;
    if (distSq >= minDist * minDist || distSq < 0.00000001) return;
    const dist = Math.sqrt(distSq);
    const normal = { x: dx / dist, y: dy / dist };
    particle.position = add(circle.position, scale(normal, minDist));
    const vn = dot(particle.velocity, normal);
    if (vn < 0) particle.velocity = sub(particle.velocity, scale(normal, (1 + BOUNCE_DAMPING) * vn));
  }

  private bounceMassive(particle: Particle, collider: MassiveCollider): void {
    const maxDist = collider.radius + DUST_RADIUS;
    const dx = particle.position.x - collider.position.x;
    if (Math.abs(dx) >= maxDist) return;
    const dy = particle.position.y - collider.position.y;
    if (Math.abs(dy) >= maxDist || dx * dx + dy * dy >= maxDist * maxDist) return;
    const local = {
      x: dx * collider.cos + dy * collider.sin,
      y: -dx * collider.sin + dy * collider.cos,
    };
    if (!this.pointInPolygon(local, collider.polygon)) return;
    const nearest = this.nearestEdge(local, collider.polygon);
    if (!nearest) return;
    const outwardX = nearest.point.x - local.x;
    const outwardY = nearest.point.y - local.y;
    const outwardLength = Math.hypot(outwardX, outwardY);
    if (outwardLength < 0.0001) return;
    const outward = { x: outwardX / outwardLength, y: outwardY / outwardLength };
    const pushedLocal = add(nearest.point, scale(outward, DUST_RADIUS));
    particle.position = {
      x: collider.position.x + pushedLocal.x * collider.cos - pushedLocal.y * collider.sin,
      y: collider.position.y + pushedLocal.x * collider.sin + pushedLocal.y * collider.cos,
    };
    const localVel = {
      x: particle.velocity.x * collider.cos + particle.velocity.y * collider.sin,
      y: -particle.velocity.x * collider.sin + particle.velocity.y * collider.cos,
    };
    const vn = dot(localVel, outward);
    if (vn < 0) {
      const bounced = sub(localVel, scale(outward, (1 + BOUNCE_DAMPING) * vn));
      particle.velocity = {
        x: bounced.x * collider.cos - bounced.y * collider.sin,
        y: bounced.x * collider.sin + bounced.y * collider.cos,
      };
    }
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
    const maxDistSq = maxDist * maxDist;
    const center = camera.worldPosition;
    this.particles = this.particles.filter((particle) => {
      const dx = particle.position.x - center.x;
      const dy = particle.position.y - center.y;
      return dx * dx + dy * dy <= maxDistSq;
    });
  }

  private localPolygon(asteroid: Model.MassiveAsteroid): Vec2[] {
    return asteroid.vertices.map((variation, index) => {
      const angle = (index / asteroid.vertices.length) * Math.PI * 2;
      return { x: Math.cos(angle) * asteroid.radius * variation, y: Math.sin(angle) * asteroid.radius * variation };
    });
  }

  private nearestEdge(point: Vec2, polygon: Vec2[]): { point: Vec2 } | undefined {
    let bestSq = Infinity;
    let closest = { x: 0, y: 0 };
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i];
      const b = polygon[(i + 1) % polygon.length];
      const edgeX = b.x - a.x;
      const edgeY = b.y - a.y;
      const denom = edgeX * edgeX + edgeY * edgeY;
      const amount = denom < 0.000001
        ? 0
        : Math.max(0, Math.min(1, ((point.x - a.x) * edgeX + (point.y - a.y) * edgeY) / denom));
      const candidateX = a.x + edgeX * amount;
      const candidateY = a.y + edgeY * amount;
      const dx = point.x - candidateX;
      const dy = point.y - candidateY;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq < bestSq) {
        bestSq = distanceSq;
        closest = { x: candidateX, y: candidateY };
      }
    }
    return bestSq === Infinity ? undefined : { point: closest };
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

  private rotate(point: Vec2, angle: number): Vec2 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return { x: point.x * c - point.y * s, y: point.x * s + point.y * c };
  }
}
