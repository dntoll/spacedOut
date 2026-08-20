import type { AsteroidBelt } from './AsteroidBelt';
import { DiscoveredMap } from './DiscoveredMap';
import type { DroneField } from './DroneField';
import type { Freighter } from './Freighter';
import type { IceRing } from './IceRing';
import type { MassiveAsteroidField } from './MassiveAsteroidField';
import type { Station } from './Station';
import type { Star } from './Star';
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
  Mission3Intro,
  Mission3Active,
  Mission3Done,
  Mission4Intro,
  Mission4Active,
  Mission4Done,
}

export enum SpawnMode {
  Normal,
  Suppressed,
  Mission2Travel,
}

export enum MissionGoalKind {
  RefillFuel,
  RefillHull,
  RefillAmmo,
  AvoidDrones,
  TraverseToSignal,
  RecoverLeftWingGun,
  RecoverRightWingGun,
  OpenGate1,
  OpenGate2,
  OpenGate3,
  ReachCentralChamber,
  ReachOmegaIII,
  ReachFreighter,
}

export interface MissionGoal {
  readonly kind: MissionGoalKind;
  readonly complete: boolean;
}

const TRAVEL_DISTANCE = 80000;
const MISSION4_TRAVEL_DISTANCE = TRAVEL_DISTANCE / 3;
const STATION_RADIUS = 2000;
const REQUIRED_WEAPON_LEVEL = 2;
const ENCOUNTER_SPAWN_START_FRACTION = 0.1;
const ENCOUNTER_SPAWN_END_FRACTION = 0.9;
const MISSION3_STATION_CLEARANCE = 200;
const SIGNAL_PROBE_DISTANCE = 5000;
const SIGNAL_PROBE_RADIUS = 1000;

export class Mission {
  phase: MissionPhase = MissionPhase.Mission1Intro;
  private chartedCells: ReadonlySet<string> = new Set();
  signalDirection: Vec2 | null = null;
  private destination: Vec2 | null = null;
  private destinationRadius = 0;
  private initialDistance = TRAVEL_DISTANCE;
  private cachedRemaining = TRAVEL_DISTANCE;
  private fuelRefilled = false;
  private hullRefilled = false;
  private ammoRefilled = false;
  private dronesAvoided = false;
  private traverseComplete = false;
  private leftWingGunRecovered = false;
  private rightWingGunRecovered = false;
  private gate1Opened = false;
  private gate2Opened = false;
  private gate3Opened = false;
  private centralReached = false;
  private omegaReached = false;
  private freighterReached = false;

  get isPaused(): boolean {
    return this.phase === MissionPhase.Mission1Intro
      || this.phase === MissionPhase.Mission1Done
      || this.phase === MissionPhase.Mission2Intro
      || this.phase === MissionPhase.Mission2Done
      || this.phase === MissionPhase.Mission3Intro
      || this.phase === MissionPhase.Mission3Done
      || this.phase === MissionPhase.Mission4Intro
      || this.phase === MissionPhase.Mission4Done;
  }

  get spawnMode(): SpawnMode {
    if (this.phase === MissionPhase.Transition || this.phase === MissionPhase.Mission3Active) return SpawnMode.Suppressed;
    if (this.phase === MissionPhase.Mission2Active || this.phase === MissionPhase.Mission4Active) return SpawnMode.Mission2Travel;
    return SpawnMode.Normal;
  }

  get isTraversal(): boolean {
    return this.phase === MissionPhase.Mission2Active || this.phase === MissionPhase.Mission4Active;
  }

  get destinationPosition(): Vec2 | null { return this.destination; }
  get destinationRadiusValue(): number { return this.destinationRadius; }

  get distanceRemaining(): number { return this.cachedRemaining; }
  get initialTravelDistance(): number { return this.initialDistance; }
  get encounterSpawningAllowed(): boolean {
    if (!this.isTraversal || this.initialDistance <= 0) return false;
    const traveledFraction = 1 - this.cachedRemaining / this.initialDistance;
    return traveledFraction >= ENCOUNTER_SPAWN_START_FRACTION
      && traveledFraction < ENCOUNTER_SPAWN_END_FRACTION;
  }

  get currentGoals(): readonly MissionGoal[] {
    if (
      this.phase === MissionPhase.Mission1Intro
      || this.phase === MissionPhase.Mission1Active
      || this.phase === MissionPhase.Mission1Done
    ) {
      return [
        { kind: MissionGoalKind.RefillFuel, complete: this.fuelRefilled },
        { kind: MissionGoalKind.RefillHull, complete: this.hullRefilled },
        { kind: MissionGoalKind.RefillAmmo, complete: this.ammoRefilled },
        { kind: MissionGoalKind.AvoidDrones, complete: this.dronesAvoided },
      ];
    }
    if (
      this.phase === MissionPhase.Mission2Intro
      || this.phase === MissionPhase.Mission2Active
      || this.phase === MissionPhase.Mission2Done
    ) {
      return [
        { kind: MissionGoalKind.TraverseToSignal, complete: this.traverseComplete },
        { kind: MissionGoalKind.RecoverLeftWingGun, complete: this.leftWingGunRecovered },
        { kind: MissionGoalKind.RecoverRightWingGun, complete: this.rightWingGunRecovered },
      ];
    }
    if (
      this.phase === MissionPhase.Mission3Intro
      || this.phase === MissionPhase.Mission3Active
      || this.phase === MissionPhase.Mission3Done
    ) {
      return [
        { kind: MissionGoalKind.OpenGate1, complete: this.gate1Opened },
        { kind: MissionGoalKind.OpenGate2, complete: this.gate2Opened },
        { kind: MissionGoalKind.OpenGate3, complete: this.gate3Opened },
        { kind: MissionGoalKind.ReachCentralChamber, complete: this.centralReached },
      ];
    }
    if (
      this.phase === MissionPhase.Mission4Intro
      || this.phase === MissionPhase.Mission4Active
      || this.phase === MissionPhase.Mission4Done
    ) {
      return [
        { kind: MissionGoalKind.ReachOmegaIII, complete: this.omegaReached },
        { kind: MissionGoalKind.ReachFreighter, complete: this.freighterReached },
      ];
    }
    return [];
  }

  advance(visited: VisitedMap): void {
    if (this.phase === MissionPhase.Mission1Intro) {
      this.phase = MissionPhase.Mission1Active;
    } else if (this.phase === MissionPhase.Mission1Done) {
      this.chartedCells = visited.snapshot();
      this.phase = MissionPhase.Transition;
    } else if (this.phase === MissionPhase.Mission2Intro) {
      this.phase = MissionPhase.Mission2Active;
    } else if (this.phase === MissionPhase.Mission2Done) {
      this.phase = MissionPhase.Mission3Intro;
    } else if (this.phase === MissionPhase.Mission3Intro) {
      this.phase = MissionPhase.Mission3Active;
    } else if (this.phase === MissionPhase.Mission3Done) {
      this.phase = MissionPhase.Mission4Intro;
    } else if (this.phase === MissionPhase.Mission4Intro) {
      this.phase = MissionPhase.Mission4Active;
    }
  }

  jumpToMission2Briefing(): void {
    this.randomizeSignal();
    this.phase = MissionPhase.Mission2Intro;
  }

  jumpToMission3Briefing(ship: Ship, station: Station): void {
    this.signalDirection = null;
    const radius = STATION_RADIUS;
    const center: Vec2 = { x: ship.position.x - radius, y: ship.position.y };
    const entranceAngle = 0;
    station.placeAt(center, radius, entranceAngle, Math.floor(Math.random() * 0x1_0000_0000));
    this.destinationRadius = station.entranceRadius;
    this.destination = station.entrancePosition ? { ...station.entrancePosition } : null;
    this.cachedRemaining = 0;
    this.initialDistance = 0;
    this.phase = MissionPhase.Mission3Intro;
  }

  jumpToMission4Briefing(ship: Ship, discovered: DiscoveredMap): void {
    this.randomizeUnexploredSignal(ship.position, discovered);
    this.phase = MissionPhase.Mission4Intro;
  }

  private randomizeSignal(): void {
    const angle = random(0, Math.PI * 2);
    this.signalDirection = { x: Math.cos(angle), y: Math.sin(angle) };
  }

  private randomizeUnexploredSignal(from: Vec2, discovered: DiscoveredMap): void {
    for (let attempt = 0; attempt < 24; attempt++) {
      const angle = random(0, Math.PI * 2);
      const direction = { x: Math.cos(angle), y: Math.sin(angle) };
      const probe = {
        x: from.x + direction.x * SIGNAL_PROBE_DISTANCE,
        y: from.y + direction.y * SIGNAL_PROBE_DISTANCE,
      };
      if (!discovered.isCircleDiscovered(probe, SIGNAL_PROBE_RADIUS)) {
        this.signalDirection = direction;
        return;
      }
    }
    this.randomizeSignal();
  }

  update(
    dt: number,
    ship: Ship,
    droneField: DroneField,
    asteroidBelt: AsteroidBelt,
    massiveAsteroidField: MassiveAsteroidField,
    station: Station,
    visited: VisitedMap,
    screenRadius: number,
    discovered: DiscoveredMap = new DiscoveredMap(),
    star: Star | null = null,
    iceRing: IceRing | null = null,
    freighter: Freighter | null = null,
  ): void {
    if (this.phase === MissionPhase.Mission1Active) {
      this.fuelRefilled = ship.fuel > 90;
      this.hullRefilled = ship.hp >= 100;
      this.ammoRefilled = ship.ammo > 90;
      this.dronesAvoided = !droneField.anyHunting();
      if (this.fuelRefilled && this.hullRefilled && this.ammoRefilled && this.dronesAvoided) {
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
      this.beginTraversalIfNeeded(ship, station);
      this.cachedRemaining = this.computeRemaining(ship, station);
      this.traverseComplete = this.cachedRemaining <= ship.radius;
      this.leftWingGunRecovered = ship.weaponLevel >= 1;
      this.rightWingGunRecovered = ship.weaponLevel >= REQUIRED_WEAPON_LEVEL;
      if (this.destination && this.traverseComplete && this.leftWingGunRecovered && this.rightWingGunRecovered) {
        this.phase = MissionPhase.Mission2Done;
      }
    } else if (this.phase === MissionPhase.Mission3Active) {
      this.gate1Opened = station.isGateOpen(1);
      this.gate2Opened = station.isGateOpen(2);
      this.gate3Opened = station.isGateOpen(3);
      this.centralReached = station.isCentralReached(ship);
      if (this.centralReached) {
        ship.installShield();
        this.phase = MissionPhase.Mission3Done;
      }
    } else if (this.phase === MissionPhase.Mission4Active && star && iceRing && freighter) {
      this.beginMission4IfNeeded(ship, discovered, star, iceRing, freighter);
      if (freighter.isPlaced) {
        this.destination = { ...freighter.position };
        this.destinationRadius = freighter.radius;
      }
      this.cachedRemaining = this.computeRemaining(ship, station);
      this.omegaReached = star.isPlaced
        && length(sub(star.position, ship.position)) <= iceRing.outerRadius + ship.radius;
      this.freighterReached = freighter.reachedBy(ship.position, ship.radius);
      if (this.destination && this.freighterReached) {
        this.phase = MissionPhase.Mission4Done;
      }
    }
  }

  private computeRemaining(ship: Ship, station: Station): number {
    if (!this.destination) return this.initialDistance;
    return Math.max(0, length(sub(this.destination, ship.position)) - this.destinationRadius - ship.radius);
  }

  private beginTraversalIfNeeded(ship: Ship, station: Station): void {
    if (this.destination || !this.signalDirection) return;
    const center: Vec2 = {
      x: ship.position.x + this.signalDirection.x * TRAVEL_DISTANCE,
      y: ship.position.y + this.signalDirection.y * TRAVEL_DISTANCE,
    };
    const entranceAngle = Math.atan2(
      ship.position.y - center.y,
      ship.position.x - center.x,
    );
    station.placeAt(center, STATION_RADIUS, entranceAngle, Math.floor(Math.random() * 0x1_0000_0000));
    this.destination = station.entrancePosition ? { ...station.entrancePosition } : null;
    this.destinationRadius = station.entranceRadius;
    this.initialDistance = Math.max(0, TRAVEL_DISTANCE - STATION_RADIUS - this.destinationRadius);
  }

  private beginMission4IfNeeded(
    ship: Ship,
    discovered: DiscoveredMap,
    star: Star,
    iceRing: IceRing,
    freighter: Freighter,
  ): void {
    if (star.isPlaced) return;
    if (!this.signalDirection) this.randomizeUnexploredSignal(ship.position, discovered);
    if (!this.signalDirection) return;
    const center: Vec2 = {
      x: ship.position.x + this.signalDirection.x * MISSION4_TRAVEL_DISTANCE,
      y: ship.position.y + this.signalDirection.y * MISSION4_TRAVEL_DISTANCE,
    };
    star.placeAt(center);
    iceRing.placeAround(star);
    freighter.placeAround(star);
    this.destination = { ...freighter.position };
    this.destinationRadius = freighter.radius;
    this.initialDistance = Math.max(0, length(sub(this.destination, ship.position)) - this.destinationRadius - ship.radius);
    this.cachedRemaining = this.initialDistance;
  }
}
