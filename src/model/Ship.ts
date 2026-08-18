import { add, clamp, dot, length, scale, sub } from '../math';
import type { ControlTuning, DirectionalThrust, Vec2 } from '../types';
import { BodyMass } from './BodyMass';
import { PhysicsBody } from './PhysicsBody';

const RAMP_UP = 3;
const RAMP_DOWN = 6;
const MAX_AMMO = 100;
const EMERGENCY_RELOAD_INTERVAL = 2;
const EMERGENCY_RELOAD_AMOUNT = 1;
const MAX_WEAPON_LEVEL = 2;

export interface ShipInitialLevels {
  fuel?: number;
  hp?: number;
  ammo?: number;
}

export class Ship extends PhysicsBody {
  private aimTarget: Vec2 = { x: 0, y: -100 };
  private throttle = 0;
  private fuelLevel: number;
  private hpLevel: number;
  private ammoLevel: number;
  private weaponLevelValue = 0;
  private ammoReloadTimer = 0;
  private fuelReloadTimer = 0;
  private invulnerableTime = 0;
  private alive = true;
  private dampening = 1.5;
  private thrustAccel = 170;
  private maxSpeed = 1000;
  private turningRate = 0;
  private directionalVec: Vec2 | null = null;
  private directionalLevel = 0;

  constructor(initial?: ShipInitialLevels) {
    const radius = 18;
    super(
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      radius,
      BodyMass.fromRadius(radius, 0.011),
      -Math.PI / 2,
      0,
    );
    this.fuelLevel = initial?.fuel ?? 100;
    this.hpLevel = initial?.hp ?? 100;
    this.ammoLevel = initial?.ammo ?? 100;
  }

  get speed(): number { return length(this.velocity); }
  get isThrusting(): boolean { return this.throttle > 0 || this.directionalLevel > 0.0001; }
  get thrustAmount(): number { return Math.max(this.throttle, this.directionalLevel); }
  get pointerThrust(): number { return this.throttle; }
  get fuel(): number { return this.fuelLevel; }
  get hp(): number { return this.hpLevel; }
  get ammo(): number { return this.ammoLevel; }
  get weaponLevel(): number { return this.weaponLevelValue; }
  get isInvulnerable(): boolean { return this.invulnerableTime > 0; }
  get isAlive(): boolean { return this.alive; }
  get turnRate(): number { return this.turningRate; }
  get speedFraction(): number { return this.maxSpeed > 0 ? clamp(this.speed / this.maxSpeed, 0, 1) : 0; }
  get directionalThrust(): DirectionalThrust | null {
    if (this.directionalLevel <= 0.0001 || !this.directionalVec) return null;
    return { vec: { ...this.directionalVec }, level: this.directionalLevel };
  }

  aimAt(target: Vec2): void { this.aimTarget = { ...target }; }

  setControlTuning(tuning: ControlTuning): void {
    this.dampening = Math.max(0, tuning.dampening);
    this.thrustAccel = Math.max(0, tuning.thrustAccel);
    this.maxSpeed = Math.max(0, tuning.maxSpeed);
  }

  setDirectionalThrust(vec: Vec2 | null): void { this.directionalVec = vec ? { ...vec } : null; }

  startThrust(): void {
    if (this.fuelLevel <= 0) {
      this.throttle = 0;
      return;
    }
    const distanceToTarget = length(sub(this.aimTarget, this.position));
    this.throttle = clamp((distanceToTarget - 18) / 360, 0, 1);
  }

  stopThrust(): void { this.throttle = 0; }
  collectFuel(amount: number): void { this.fuelLevel = clamp(this.fuelLevel + amount, 0, 100); }
  collectAmmo(amount: number): void { this.ammoLevel = clamp(this.ammoLevel + amount, 0, MAX_AMMO); }
  upgradeWeapon(): void { this.weaponLevelValue = Math.min(MAX_WEAPON_LEVEL, this.weaponLevelValue + 1); }
  consumeAmmo(amount: number): boolean {
    if (this.ammoLevel < amount) return false;
    this.ammoLevel -= amount;
    return true;
  }
  takeDamage(amount: number): void {
    this.hpLevel = Math.max(0, this.hpLevel - amount);
    if (this.hpLevel === 0) this.alive = false;
    this.invulnerableTime = 0.5;
  }
  repair(amount: number): void {
    if (!this.alive) return;
    this.hpLevel = clamp(this.hpLevel + amount, 0, 100);
  }

  updateInvulnerability(dt: number): void {
    this.invulnerableTime = Math.max(0, this.invulnerableTime - dt);
  }

  updateEmergencyReload(dt: number): void {
    if (this.ammoLevel === 0) {
      this.ammoReloadTimer += dt;
      if (this.ammoReloadTimer >= EMERGENCY_RELOAD_INTERVAL) {
        this.ammoReloadTimer -= EMERGENCY_RELOAD_INTERVAL;
        this.ammoLevel = Math.min(MAX_AMMO, this.ammoLevel + EMERGENCY_RELOAD_AMOUNT);
      }
    } else this.ammoReloadTimer = 0;

    if (this.fuelLevel === 0) {
      this.fuelReloadTimer += dt;
      if (this.fuelReloadTimer >= EMERGENCY_RELOAD_INTERVAL) {
        this.fuelReloadTimer -= EMERGENCY_RELOAD_INTERVAL;
        this.fuelLevel = Math.min(100, this.fuelLevel + EMERGENCY_RELOAD_AMOUNT);
      }
    } else this.fuelReloadTimer = 0;
  }

  applyControls(dt: number): void {
    const aim = sub(this.aimTarget, this.position);
    if (length(aim) > 3) {
      const target = Math.atan2(aim.y, aim.x);
      const delta = Math.atan2(Math.sin(target - this.angle), Math.cos(target - this.angle));
      this.angle = target;
      this.turningRate = dt > 0 ? Math.abs(delta) / dt : 0;
    } else {
      this.turningRate = 0;
    }

    if (this.directionalVec) this.directionalLevel = Math.min(1, this.directionalLevel + RAMP_UP * dt);
    else this.directionalLevel = Math.max(0, this.directionalLevel - RAMP_DOWN * dt);
    if (this.directionalLevel <= 0.0001 && !this.directionalVec) this.directionalVec = null;

    const ptrActive = this.throttle > 0;
    const dirActive = this.directionalLevel > 0.0001 && this.directionalVec !== null;
    if (!ptrActive && !dirActive) return;

    const forward = { x: Math.cos(this.angle), y: Math.sin(this.angle) };
    let thrustDirWorld: Vec2 = { x: 0, y: 0 };
    if (ptrActive) thrustDirWorld = add(thrustDirWorld, scale(forward, this.throttle));
    if (dirActive) {
      const dv = this.directionalVec!;
      const dirWorld = this.rotate(dv, this.angle);
      thrustDirWorld = add(thrustDirWorld, scale(dirWorld, this.directionalLevel));
    }
    const tmag = length(thrustDirWorld);
    if (tmag < 0.0001) return;
    const tdir = scale(thrustDirWorld, 1 / tmag);
    const tmagClamped = Math.min(1, tmag);

    const along = Math.max(0, dot(this.velocity, tdir));
    const across = sub(this.velocity, scale(tdir, along));
    const dampFactor = Math.exp(-this.dampening * dt);
    this.velocity = add(scale(tdir, along), scale(across, dampFactor));

    this.velocity = add(this.velocity, scale(tdir, this.thrustAccel * tmagClamped * dt));
    this.fuelLevel = Math.max(0, this.fuelLevel - 5 * tmagClamped * dt);
    if (this.fuelLevel <= 0) {
      this.throttle = 0;
      this.directionalLevel = 0;
      this.directionalVec = null;
    }
    if (this.speed > this.maxSpeed) this.velocity = scale(this.velocity, this.maxSpeed / this.speed);
  }

  private rotate(v: Vec2, angle: number): Vec2 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
  }
}
