import { add, length, random, scale, sub } from '../math';
import type * as Model from '../model';
import type { Vec2 } from '../types';
import type { Camera, WorldBounds } from './Camera';
import type { Drawing, Size } from './Drawing';
import { NebulaCloud } from './NebulaCloud';
import { NebulaParticle, type NebulaColor } from './NebulaParticle';

const CLOUD_GAP_BASE = 15000;
const CLOUD_GAP_JITTER = 15000;
const CLOUD_SIZE = 700;
const WISP_CLOUD_SIZE = 900;
const CLOUD_SPREAD = 1732;
const CLOUD_ASPECT_MIN = 1.4;
const CLOUD_ASPECT_MAX = 2.6;
const WISP_ASPECT_MIN = 2.5;
const WISP_ASPECT_MAX = 3.5;
const BLOB_KERNEL_MIN = 3;
const BLOB_KERNEL_MAX = 5;
const BLOB_KERNEL_RADIUS = 1200;
const PERIPHERAL_FRACTION = 0.5;
const ISLAND_CLEARANCE = 600;
const PARTICLE_MIN = 100;
const PARTICLE_MAX = 240;
const PARTICLE_ALPHA = 0.5;
const MAX_CLOUD_EXTENT = CLOUD_SPREAD * WISP_ASPECT_MAX;
const SPAWN_MARGIN = 400;
const CULL_TAIL = 800;
const SPEED_CLEARANCE_GAIN = 1.2;

const PALETTE: NebulaColor[] = [
  { r: 180, g: 90, b: 220 },
  { r: 90, g: 140, b: 230 },
  { r: 230, g: 100, b: 180 },
  { r: 80, g: 200, b: 200 },
  { r: 140, g: 110, b: 230 },
];

export class NebulaField {
  private clouds: NebulaCloud[] = [];
  private lastCloudProgress = -CLOUD_GAP_BASE;
  private nextGap = CLOUD_GAP_BASE;

  reset(): void { this.clouds = []; this.lastCloudProgress = -CLOUD_GAP_BASE; this.nextGap = CLOUD_GAP_BASE; }

  update(dt: number, model: Model.Game, camera: Camera, viewport: Size): void {
    if (!model.mission.isTraversal) {
      this.clouds = [];
      this.lastCloudProgress = -CLOUD_GAP_BASE;
      this.nextGap = CLOUD_GAP_BASE;
      return;
    }
    this.spawn(model, camera, viewport, model.ship.speed * SPEED_CLEARANCE_GAIN);
    const pushers: Vec2[] = [model.ship.position];
    model.pirateField.forEachPirate((pirate) => pushers.push(pirate.position));
    model.droneField.forEach((drone) => pushers.push(drone.position));
    for (const cloud of this.clouds) cloud.update(dt, pushers);
    this.cull(model.ship.position, camera, viewport, model.ship.speed * SPEED_CLEARANCE_GAIN);
  }

  draw(drawing: Drawing, visibleBounds?: WorldBounds): void {
    drawing.withAdditiveBlend(() => {
      for (const cloud of this.clouds) cloud.draw(drawing, visibleBounds);
    });
  }

  private spawn(model: Model.Game, camera: Camera, viewport: Size, speedClearance: number): void {
    const direction = model.mission.signalDirection;
    if (!direction) return;
    const ship = model.ship.position;
    const progress = ship.x * direction.x + ship.y * direction.y;
    const visibleRadius = camera.getVisibleWorldRadius(viewport);
    const spawnAhead = visibleRadius + MAX_CLOUD_EXTENT + speedClearance + SPAWN_MARGIN;
    const perp: Vec2 = { x: -direction.y, y: direction.x };
    while (progress >= this.lastCloudProgress + this.nextGap) {
      this.lastCloudProgress += this.nextGap;
      this.nextGap = CLOUD_GAP_BASE + random(0, CLOUD_GAP_JITTER);
      const routeCenter = add(ship, scale(direction, spawnAhead));
      let cloudCenter = routeCenter;
      if (random(0, 1) < PERIPHERAL_FRACTION) {
        const lateral = random(-1, 1) * visibleRadius * 0.8;
        cloudCenter = add(routeCenter, scale(perp, lateral));
      }
      if (this.nearIsland(model, cloudCenter)) continue;
      const color = PALETTE[Math.floor(random(0, PALETTE.length))];
      const rotation = random(0, Math.PI * 2);
      const shapeRoll = random(0, 1);
      let particles: NebulaParticle[];
      if (shapeRoll < 1 / 3) {
        particles = this.spawnEllipse(cloudCenter, color, rotation, CLOUD_SIZE);
      } else if (shapeRoll < 2 / 3) {
        particles = this.spawnBlob(cloudCenter, color, rotation, CLOUD_SIZE);
      } else {
        particles = this.spawnWisp(cloudCenter, color, rotation);
      }
      this.clouds.push(new NebulaCloud(particles));
    }
  }

  private spawnEllipse(center: Vec2, color: NebulaColor, rotation: number, count: number): NebulaParticle[] {
    const aspect = random(CLOUD_ASPECT_MIN, CLOUD_ASPECT_MAX);
    const a = CLOUD_SPREAD * aspect;
    const b = CLOUD_SPREAD / aspect;
    return this.scatterEllipse(center, color, rotation, count, a, b);
  }

  private spawnWisp(center: Vec2, color: NebulaColor, rotation: number): NebulaParticle[] {
    const aspect = random(WISP_ASPECT_MIN, WISP_ASPECT_MAX);
    const a = CLOUD_SPREAD * aspect;
    const b = CLOUD_SPREAD / aspect;
    return this.scatterEllipse(center, color, rotation, WISP_CLOUD_SIZE, a, b);
  }

  private spawnBlob(center: Vec2, color: NebulaColor, rotation: number, count: number): NebulaParticle[] {
    const kernelCount = Math.floor(random(BLOB_KERNEL_MIN, BLOB_KERNEL_MAX + 1));
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const kernels: Vec2[] = [];
    for (let k = 0; k < kernelCount; k++) {
      const local: Vec2 = { x: random(-CLOUD_SPREAD * 0.4, CLOUD_SPREAD * 0.4), y: random(-CLOUD_SPREAD * 0.4, CLOUD_SPREAD * 0.4) };
      kernels.push(add(center, { x: local.x * cos - local.y * sin, y: local.x * sin + local.y * cos }));
    }
    const perKernel = Math.ceil(count / kernelCount);
    const particles: NebulaParticle[] = [];
    for (const kernel of kernels) {
      particles.push(...this.scatterEllipse(kernel, color, rotation, perKernel, BLOB_KERNEL_RADIUS, BLOB_KERNEL_RADIUS));
    }
    return particles;
  }

  private scatterEllipse(center: Vec2, color: NebulaColor, rotation: number, count: number, a: number, b: number): NebulaParticle[] {
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const particles: NebulaParticle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = random(0, Math.PI * 2);
      const t = Math.sqrt(random(0, 1));
      const local: Vec2 = { x: a * t * Math.cos(angle), y: b * t * Math.sin(angle) };
      const home = add(center, {
        x: local.x * cos - local.y * sin,
        y: local.x * sin + local.y * cos,
      });
      const size = random(PARTICLE_MIN, PARTICLE_MAX);
      const tint = this.tint(color);
      particles.push(new NebulaParticle({ ...home }, home, size, tint, PARTICLE_ALPHA));
    }
    return particles;
  }

  private nearIsland(model: Model.Game, cloudCenter: Vec2): boolean {
    let blocked = false;
    model.asteroidBelt.forEachIsland((island) => {
      if (blocked) return;
      const clearance = island.radius + CLOUD_SPREAD + ISLAND_CLEARANCE;
      if (length(sub(island.center, cloudCenter)) <= clearance) blocked = true;
    });
    return blocked;
  }

  private tint(base: NebulaColor): NebulaColor {
    const jitter = 30;
    return {
      r: Math.max(0, Math.min(255, base.r + random(-jitter, jitter))),
      g: Math.max(0, Math.min(255, base.g + random(-jitter, jitter))),
      b: Math.max(0, Math.min(255, base.b + random(-jitter, jitter))),
    };
  }

  private cull(shipPosition: Vec2, camera: Camera, viewport: Size, speedClearance: number): void {
    const maxDist = camera.getVisibleWorldRadius(viewport) + 2 * MAX_CLOUD_EXTENT + speedClearance + SPAWN_MARGIN + CULL_TAIL;
    this.clouds = this.clouds.filter((cloud) => cloud.isWithin(shipPosition, maxDist));
  }
}
