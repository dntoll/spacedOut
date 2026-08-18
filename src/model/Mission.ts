import type { AsteroidBelt } from './AsteroidBelt';
import type { DroneField } from './DroneField';
import type { MassiveAsteroidField } from './MassiveAsteroidField';
import type { Ship } from './Ship';
import type { Vec2 } from '../types';
import { random } from '../math';
import { VisitedMap } from './VisitedMap';

export enum MissionPhase {
  Mission1Intro,
  Mission1Active,
  Mission1Done,
  Transition,
  Mission2Intro,
}

export class Mission {
  phase: MissionPhase = MissionPhase.Mission1Intro;
  private chartedCells: ReadonlySet<string> = new Set();
  requestsRestart = false;
  signalDirection: Vec2 | null = null;

  get isPaused(): boolean {
    return this.phase === MissionPhase.Mission1Intro
      || this.phase === MissionPhase.Mission1Done
      || this.phase === MissionPhase.Mission2Intro;
  }

  get suppressSpawning(): boolean {
    return this.phase === MissionPhase.Transition;
  }

  advance(visited: VisitedMap): void {
    if (this.phase === MissionPhase.Mission1Intro) {
      this.phase = MissionPhase.Mission1Active;
    } else if (this.phase === MissionPhase.Mission1Done) {
      this.chartedCells = visited.snapshot();
      this.phase = MissionPhase.Transition;
    } else if (this.phase === MissionPhase.Mission2Intro) {
      this.requestsRestart = true;
    }
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
        const angle = random(0, Math.PI * 2);
        this.signalDirection = { x: Math.cos(angle), y: Math.sin(angle) };
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
    }
  }
}
