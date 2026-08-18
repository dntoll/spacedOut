import type { AsteroidBelt } from './AsteroidBelt';
import type { DroneField } from './DroneField';
import type { MassiveAsteroidField } from './MassiveAsteroidField';
import type { Ship } from './Ship';
import type { Vec2 } from '../types';
import { length, random, sub } from '../math';
import { VisitedMap } from './VisitedMap';

export enum MissionPhase {
  Mission1Intro,
  Mission1Active,
  Mission1Done,
  Transition,
  Mission2Intro,
  Mission2Active,
  Mission2Done,
}

export enum SpawnMode {
  Normal,
  Suppressed,
  Mission2Travel,
}

const TRAVEL_DISTANCE = 80000;
const DESTINATION_RADII = 100;
const REQUIRED_WEAPON_LEVEL = 2;

export class Mission {
  phase: MissionPhase = MissionPhase.Mission1Intro;
  private chartedCells: ReadonlySet<string> = new Set();
  requestsRestart = false;
  signalDirection: Vec2 | null = null;
  private destination: Vec2 | null = null;
  private destinationRadius = 0;
  private initialDistance = TRAVEL_DISTANCE;
  private cachedRemaining = TRAVEL_DISTANCE;

  get isPaused(): boolean {
    return this.phase === MissionPhase.Mission1Intro
      || this.phase === MissionPhase.Mission1Done
      || this.phase === MissionPhase.Mission2Intro
      || this.phase === MissionPhase.Mission2Done;
  }

  get spawnMode(): SpawnMode {
    if (this.phase === MissionPhase.Transition) return SpawnMode.Suppressed;
    if (this.phase === MissionPhase.Mission2Active) return SpawnMode.Mission2Travel;
    return SpawnMode.Normal;
  }

  get isTraversal(): boolean { return this.phase === MissionPhase.Mission2Active; }

  get destinationPosition(): Vec2 | null { return this.destination; }
  get destinationRadiusValue(): number { return this.destinationRadius; }

  get distanceRemaining(): number { return this.cachedRemaining; }
  get initialTravelDistance(): number { return this.initialDistance; }

  advance(visited: VisitedMap): void {
    if (this.phase === MissionPhase.Mission1Intro) {
      this.phase = MissionPhase.Mission1Active;
    } else if (this.phase === MissionPhase.Mission1Done) {
      this.chartedCells = visited.snapshot();
      this.phase = MissionPhase.Transition;
    } else if (this.phase === MissionPhase.Mission2Intro) {
      this.phase = MissionPhase.Mission2Active;
    } else if (this.phase === MissionPhase.Mission2Done) {
      this.requestsRestart = true;
    }
  }

  jumpToMission2Briefing(): void {
    this.randomizeSignal();
    this.phase = MissionPhase.Mission2Intro;
  }

  private randomizeSignal(): void {
    const angle = random(0, Math.PI * 2);
    this.signalDirection = { x: Math.cos(angle), y: Math.sin(angle) };
  }

  update(
    dt: number,
    ship: Ship,
    droneField: DroneField,
    asteroidBelt: AsteroidBelt,
    massiveAsteroidField: MassiveAsteroidField,
    visited: VisitedMap,
    screenRadius: number,
  ): void {
    if (this.phase === MissionPhase.Mission1Active) {
      if (ship.hp >= 100 && ship.ammo >= 100 && ship.fuel > 80 && !droneField.anyHunting()) {
        this.randomizeSignal();
        this.phase = MissionPhase.Mission1Done;
      }
    } else if (this.phase === MissionPhase.Transition) {
      if (
        !visited.contains(this.chartedCells, ship.position)
        && !asteroidBelt.anyWithin(ship.position, screenRadius)
        && !massiveAsteroidField.anyWithin(ship.position, screenRadius)
      ) {
        this.phase = MissionPhase.Mission2Intro;
      }
    } else if (this.phase === MissionPhase.Mission2Active) {
      this.beginTraversalIfNeeded(ship, massiveAsteroidField);
      this.cachedRemaining = this.computeRemaining(ship, massiveAsteroidField);
      if (this.destination && this.cachedRemaining <= ship.radius && ship.weaponLevel >= REQUIRED_WEAPON_LEVEL) {
        this.phase = MissionPhase.Mission2Done;
      }
    }
  }

  private computeRemaining(ship: Ship, massiveField: MassiveAsteroidField): number {
    if (!this.destination) return this.initialDistance;
    const surface = massiveField.destination
      ? massiveField.boundaryRadiusAt(massiveField.destination, ship.position)
      : this.destinationRadius;
    return Math.max(0, length(sub(this.destination, ship.position)) - surface - ship.radius);
  }

  private beginTraversalIfNeeded(ship: Ship, massiveAsteroidField: MassiveAsteroidField): void {
    if (this.destination || !this.signalDirection) return;
    this.destination = {
      x: ship.position.x + this.signalDirection.x * TRAVEL_DISTANCE,
      y: ship.position.y + this.signalDirection.y * TRAVEL_DISTANCE,
    };
    this.destinationRadius = ship.radius * DESTINATION_RADII;
    this.initialDistance = Math.max(0, TRAVEL_DISTANCE - this.destinationRadius);
    massiveAsteroidField.placeDestination(this.destination, this.destinationRadius);
  }
}
