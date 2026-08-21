import { describe, expect, it, vi } from 'vitest';
import { Asteroid } from './Asteroid';
import { AsteroidBelt } from './AsteroidBelt';
import { Drone } from './Drone';
import { DroneField } from './DroneField';
import { MassiveAsteroid } from './MassiveAsteroid';
import { MassiveAsteroidField } from './MassiveAsteroidField';
import { Mission, MissionGoalKind, MissionPhase, SpawnMode } from './Mission';
import { Ship } from './Ship';
import { Station } from './Station';
import { Star } from './Star';
import { IceRing } from './IceRing';
import { Freighter } from './Freighter';
import { VisitedMap } from './VisitedMap';
import { DiscoveredMap } from './DiscoveredMap';
import { length, sub } from '../math';

const emptyDroneField = () => new DroneField();
const emptyBelt = () => new AsteroidBelt({ x: 0, y: 0 }, []);
const emptyField = () => new MassiveAsteroidField({ x: 0, y: 0 }, 18, []);
const emptyStation = () => new Station();
const SCREEN_RADIUS = 1000;

const reachMission2Intro = (): { mission: Mission; visited: VisitedMap; ship: Ship; field: MassiveAsteroidField; station: Station } => {
  const mission = new Mission();
  const visited = new VisitedMap();
  const field = emptyField();
  const station = emptyStation();
  mission.advance(visited);
  mission.update(0, new Ship(), emptyDroneField(), emptyBelt(), field, station, visited, SCREEN_RADIUS);
  visited.visit({ x: 0, y: 0 });
  mission.advance(visited);
  const ship = new Ship();
  ship.position = { x: 5000, y: 5000 };
  mission.update(0, ship, emptyDroneField(), emptyBelt(), field, station, visited, SCREEN_RADIUS);
  return { mission, visited, ship, field, station };
};

describe('Mission', () => {
  it('REQ-52 starts paused on the intro and advances to active on the continue click', () => {
    const mission = new Mission();
    const visited = new VisitedMap();
    expect(mission.phase).toBe(MissionPhase.Mission1Intro);
    expect(mission.isPaused).toBe(true);

    mission.advance(visited);

    expect(mission.phase).toBe(MissionPhase.Mission1Active);
    expect(mission.isPaused).toBe(false);
  });

  it('REQ-53 ends mission 1 when fuel exceeds 90, hull is full, ammo exceeds 90, and no drones hunt', () => {
    const mission = new Mission();
    const visited = new VisitedMap();
    mission.advance(visited);
    const ship = new Ship();
    const drones = emptyDroneField();

    mission.update(0, ship, drones, emptyBelt(), emptyField(), emptyStation(), visited, SCREEN_RADIUS);

    expect(mission.phase).toBe(MissionPhase.Mission1Done);
    expect(mission.isPaused).toBe(true);
  });

  it('REQ-53 does not end mission 1 while fuel is 90 or below', () => {
    const mission = new Mission();
    const visited = new VisitedMap();
    mission.advance(visited);
    const ship = new Ship({ fuel: 90, hp: 100, ammo: 100 });

    mission.update(0, ship, emptyDroneField(), emptyBelt(), emptyField(), emptyStation(), visited, SCREEN_RADIUS);

    expect(mission.phase).toBe(MissionPhase.Mission1Active);
  });

  it('REQ-53 does not end mission 1 while ammo is 90 or below', () => {
    const mission = new Mission();
    const visited = new VisitedMap();
    mission.advance(visited);
    const ship = new Ship({ fuel: 100, hp: 100, ammo: 90 });

    mission.update(0, ship, emptyDroneField(), emptyBelt(), emptyField(), emptyStation(), visited, SCREEN_RADIUS);

    expect(mission.phase).toBe(MissionPhase.Mission1Active);
  });

  it('REQ-53 does not end mission 1 while a drone is hunting', () => {
    const mission = new Mission();
    const visited = new VisitedMap();
    mission.advance(visited);
    const ship = new Ship();
    const drones = new DroneField([new Drone(null, 0, [1, 1, 1], 2)]);

    mission.update(0, ship, drones, emptyBelt(), emptyField(), emptyStation(), visited, SCREEN_RADIUS);

    expect(mission.phase).toBe(MissionPhase.Mission1Active);
  });

  it('REQ-53 does not end mission 1 while the hull is damaged', () => {
    const mission = new Mission();
    const visited = new VisitedMap();
    mission.advance(visited);
    const ship = new Ship();
    ship.takeDamage(10);
    const drones = emptyDroneField();

    mission.update(0, ship, drones, emptyBelt(), emptyField(), emptyStation(), visited, SCREEN_RADIUS);

    expect(mission.phase).toBe(MissionPhase.Mission1Active);
  });

  it('REQ-56 randomizes a signal direction when mission 1 ends', () => {
    const mission = new Mission();
    const visited = new VisitedMap();
    mission.advance(visited);
    expect(mission.signalDirection).toBeNull();

    mission.update(0, new Ship(), emptyDroneField(), emptyBelt(), emptyField(), emptyStation(), visited, SCREEN_RADIUS);

    expect(mission.phase).toBe(MissionPhase.Mission1Done);
    expect(mission.signalDirection).not.toBeNull();
    expect(length(mission.signalDirection!)).toBeCloseTo(1, 6);
  });

  it('REQ-54 suppresses spawning during the transition and starts mission 2 in uncharted space', () => {
    const mission = new Mission();
    const visited = new VisitedMap();
    mission.advance(visited);
    mission.update(0, new Ship(), emptyDroneField(), emptyBelt(), emptyField(), emptyStation(), visited, SCREEN_RADIUS);
    expect(mission.phase).toBe(MissionPhase.Mission1Done);

    visited.visit({ x: 0, y: 0 });
    visited.visit({ x: 500, y: 0 });

    mission.advance(visited);
    expect(mission.phase).toBe(MissionPhase.Transition);
    expect(mission.spawnMode).toBe(SpawnMode.Suppressed);
    expect(mission.isPaused).toBe(false);

    const ship = new Ship();
    ship.position = { x: 300, y: 0 };
    mission.update(0, ship, emptyDroneField(), emptyBelt(), emptyField(), emptyStation(), visited, SCREEN_RADIUS);
    expect(mission.phase).toBe(MissionPhase.Transition);

    ship.position = { x: 5000, y: 5000 };
    mission.update(0, ship, emptyDroneField(), emptyBelt(), emptyField(), emptyStation(), visited, SCREEN_RADIUS);
    expect(mission.phase).toBe(MissionPhase.Mission2Intro);
    expect(mission.isPaused).toBe(true);
  });

  it('REQ-54 does not start mission 2 while the ship stays within charted space', () => {
    const mission = new Mission();
    const visited = new VisitedMap();
    mission.advance(visited);
    mission.update(0, new Ship(), emptyDroneField(), emptyBelt(), emptyField(), emptyStation(), visited, SCREEN_RADIUS);
    visited.visit({ x: 0, y: 0 });
    mission.advance(visited);

    const ship = new Ship();
    ship.position = { x: 900, y: 900 };
    for (let step = 0; step < 5; step++) mission.update(0, ship, emptyDroneField(), emptyBelt(), emptyField(), emptyStation(), visited, SCREEN_RADIUS);

    expect(mission.phase).toBe(MissionPhase.Transition);
  });

  it('REQ-54 does not start mission 2 while a regular asteroid is within a screen radius', () => {
    const mission = new Mission();
    const visited = new VisitedMap();
    mission.advance(visited);
    mission.update(0, new Ship(), emptyDroneField(), emptyBelt(), emptyField(), emptyStation(), visited, SCREEN_RADIUS);
    visited.visit({ x: 0, y: 0 });
    mission.advance(visited);
    expect(mission.phase).toBe(MissionPhase.Transition);

    const ship = new Ship();
    ship.position = { x: 5000, y: 5000 };
    const asteroid = new Asteroid(1, { x: 5000, y: 5000 }, { x: 0, y: 0 }, 20, 0, 0, [1, 1, 1], 0.5);
    const belt = new AsteroidBelt({ x: 0, y: 0 }, [asteroid]);

    mission.update(0, ship, emptyDroneField(), belt, emptyField(), emptyStation(), visited, SCREEN_RADIUS);

    expect(mission.phase).toBe(MissionPhase.Transition);

    mission.update(0, ship, emptyDroneField(), emptyBelt(), emptyField(), emptyStation(), visited, SCREEN_RADIUS);
    expect(mission.phase).toBe(MissionPhase.Mission2Intro);
  });

  it('REQ-54 does not start mission 2 while a massive asteroid is within a screen radius', () => {
    const mission = new Mission();
    const visited = new VisitedMap();
    mission.advance(visited);
    mission.update(0, new Ship(), emptyDroneField(), emptyBelt(), emptyField(), emptyStation(), visited, SCREEN_RADIUS);
    visited.visit({ x: 0, y: 0 });
    mission.advance(visited);

    const ship = new Ship();
    ship.position = { x: 5000, y: 5000 };
    const massive = new MassiveAsteroid(1, { x: 5200, y: 5000 }, 100, 0, [1, 1, 1, 1], [], 0.5);
    const field = new MassiveAsteroidField({ x: 0, y: 0 }, 18, [massive]);

    mission.update(0, ship, emptyDroneField(), emptyBelt(), field, emptyStation(), visited, SCREEN_RADIUS);

    expect(mission.phase).toBe(MissionPhase.Transition);
  });

  it('REQ-55 begins the traversal mission on the mission 2 continue click instead of restarting', () => {
    const { mission, visited } = reachMission2Intro();

    expect(mission.phase).toBe(MissionPhase.Mission2Intro);

    mission.advance(visited);

    expect(mission.phase).toBe(MissionPhase.Mission2Active);
    expect(mission.isPaused).toBe(false);
  });

  it('REQ-60 runs the traversal in the mission-2 travel spawn mode', () => {
    const { mission, visited, ship, field, station } = reachMission2Intro();
    mission.advance(visited);

    expect(mission.spawnMode).toBe(SpawnMode.Mission2Travel);
    expect(mission.isTraversal).toBe(true);

    mission.update(0, ship, emptyDroneField(), emptyBelt(), field, station, visited, SCREEN_RADIUS);
    expect(mission.spawnMode).toBe(SpawnMode.Mission2Travel);
  });

  it('REQ-61 reports a remaining distance that shrinks as the ship approaches the destination', () => {
    const { mission, visited, ship, field, station } = reachMission2Intro();
    mission.advance(visited);
    mission.update(0, ship, emptyDroneField(), emptyBelt(), field, station, visited, SCREEN_RADIUS);

    expect(mission.destinationPosition).not.toBeNull();
    const initial = mission.distanceRemaining;
    expect(initial).toBeGreaterThan(0);

    const destination = mission.destinationPosition!;
    const dir = { x: destination.x - ship.position.x, y: destination.y - ship.position.y };
    const step = 1000;
    const dist = length(dir);
    ship.position = {
      x: ship.position.x + (dir.x / dist) * step,
      y: ship.position.y + (dir.y / dist) * step,
    };
    mission.update(0, ship, emptyDroneField(), emptyBelt(), field, station, visited, SCREEN_RADIUS);

    expect(mission.distanceRemaining).toBeLessThan(initial);
  });

  it('REQ-75 allows encounter spawning only between 10% and 90% of mission 2 travel', () => {
    const { mission, visited, ship, field, station } = reachMission2Intro();
    mission.advance(visited);
    const start = { ...ship.position };
    mission.update(0, ship, emptyDroneField(), emptyBelt(), field, station, visited, SCREEN_RADIUS);
    const destination = mission.destinationPosition!;
    const placeAt = (fraction: number): void => {
      ship.position = {
        x: start.x + (destination.x - start.x) * fraction,
        y: start.y + (destination.y - start.y) * fraction,
      };
      mission.update(0, ship, emptyDroneField(), emptyBelt(), field, station, visited, SCREEN_RADIUS);
    };

    placeAt(0.05);
    expect(mission.encounterSpawningAllowed).toBe(false);
    placeAt(0.5);
    expect(mission.encounterSpawningAllowed).toBe(true);
    placeAt(0.95);
    expect(mission.encounterSpawningAllowed).toBe(false);
  });

  it('REQ-64 places a huge abandoned maze station and ends the mission when the ship reaches the entrance', () => {
    const { mission, visited, ship, field, station } = reachMission2Intro();
    mission.advance(visited);
    mission.update(0, ship, emptyDroneField(), emptyBelt(), field, station, visited, SCREEN_RADIUS);

    expect(station.isPlaced).toBe(true);
    expect(station.outerRadius).toBeGreaterThan(ship.radius * 30);
    expect(station.entrancePosition).not.toBeNull();

    ship.position = { ...mission.destinationPosition! };
    ship.upgradeWeapon();
    ship.upgradeWeapon();
    mission.update(0, ship, emptyDroneField(), emptyBelt(), field, station, visited, SCREEN_RADIUS);

    expect(mission.phase).toBe(MissionPhase.Mission2Done);
    expect(mission.isPaused).toBe(true);
  });

  it('REQ-64 does not end until the ship reaches the entrance', () => {
    const { mission, visited, ship, field, station } = reachMission2Intro();
    mission.advance(visited);
    mission.update(0, ship, emptyDroneField(), emptyBelt(), field, station, visited, SCREEN_RADIUS);
    ship.upgradeWeapon();
    ship.upgradeWeapon();
    const destination = { ...mission.destinationPosition! };

    ship.position = { x: destination.x + 5400, y: destination.y };
    mission.update(0, ship, emptyDroneField(), emptyBelt(), field, station, visited, SCREEN_RADIUS);
    expect(mission.phase).toBe(MissionPhase.Mission2Active);

    ship.position = { ...destination };
    mission.update(0, ship, emptyDroneField(), emptyBelt(), field, station, visited, SCREEN_RADIUS);
    expect(mission.phase).toBe(MissionPhase.Mission2Done);
  });

  it('REQ-64 does not end on arrival until both wing guns are recovered', () => {
    const { mission, visited, ship, field, station } = reachMission2Intro();
    mission.advance(visited);
    mission.update(0, ship, emptyDroneField(), emptyBelt(), field, station, visited, SCREEN_RADIUS);
    ship.position = { ...mission.destinationPosition! };

    mission.update(0, ship, emptyDroneField(), emptyBelt(), field, station, visited, SCREEN_RADIUS);
    expect(mission.phase).toBe(MissionPhase.Mission2Active);

    ship.upgradeWeapon();
    mission.update(0, ship, emptyDroneField(), emptyBelt(), field, station, visited, SCREEN_RADIUS);
    expect(mission.phase).toBe(MissionPhase.Mission2Active);

    ship.upgradeWeapon();
    mission.update(0, ship, emptyDroneField(), emptyBelt(), field, station, visited, SCREEN_RADIUS);
    expect(mission.phase).toBe(MissionPhase.Mission2Done);
  });

  it('REQ-65 proceeds from mission 2 completion to the mission 3 briefing without restarting', () => {
    const { mission, visited, ship, field, station } = reachMission2Intro();
    mission.advance(visited);
    mission.update(0, ship, emptyDroneField(), emptyBelt(), field, station, visited, SCREEN_RADIUS);
    ship.upgradeWeapon();
    ship.upgradeWeapon();
    ship.position = { ...mission.destinationPosition! };
    mission.update(0, ship, emptyDroneField(), emptyBelt(), field, station, visited, SCREEN_RADIUS);
    expect(mission.phase).toBe(MissionPhase.Mission2Done);

    mission.advance(visited);

    expect(mission.phase).toBe(MissionPhase.Mission3Intro);
    expect(mission.isPaused).toBe(true);
  });

  it('REQ-66 jumps straight to the mission 2 briefing with a randomized signal direction', () => {
    const mission = new Mission();
    expect(mission.signalDirection).toBeNull();

    mission.jumpToMission2Briefing();

    expect(mission.phase).toBe(MissionPhase.Mission2Intro);
    expect(mission.isPaused).toBe(true);
    expect(mission.signalDirection).not.toBeNull();
    expect(length(mission.signalDirection!)).toBeCloseTo(1, 6);
  });

  it('REQ-66 jumps straight to the mission 3 briefing beside the destination station', () => {
    const mission = new Mission();
    const ship = new Ship();
    const station = emptyStation();

    mission.jumpToMission3Briefing(ship, station);

    expect(mission.phase).toBe(MissionPhase.Mission3Intro);
    expect(mission.isPaused).toBe(true);
    expect(station.isPlaced).toBe(true);
    expect(mission.destinationPosition).toEqual(station.entrancePosition);
    expect(length(sub(station.center!, ship.position))).toBeLessThan(station.outerRadius * 2);
  });

  it('REQ-76 hides the directional signal throughout mission 3', () => {
    const mission = new Mission();
    const visited = new VisitedMap();
    const station = emptyStation();
    const ship = new Ship();
    mission.jumpToMission3Briefing(ship, station);
    expect(mission.showDirectionalSignal).toBe(false);
    mission.advance(visited);
    expect(mission.showDirectionalSignal).toBe(false);
    ship.installShield();
    mission.update(0, ship, emptyDroneField(), emptyBelt(), emptyField(), station, visited, SCREEN_RADIUS);
    expect(mission.phase).toBe(MissionPhase.Mission3Done);
    expect(mission.showDirectionalSignal).toBe(false);
  });

  it('REQ-76 shows the directional signal outside mission 3', () => {
    const mission = new Mission();
    expect(mission.showDirectionalSignal).toBe(true);
    mission.phase = MissionPhase.Mission2Active;
    expect(mission.showDirectionalSignal).toBe(true);
    mission.phase = MissionPhase.Mission4Active;
    expect(mission.showDirectionalSignal).toBe(true);
  });

  it('REQ-76 starts mission 3 inside the station with gate and shield-upgrade goals', () => {
    const mission = new Mission();
    const visited = new VisitedMap();
    const station = emptyStation();
    mission.jumpToMission3Briefing(new Ship(), station);

    mission.advance(visited);

    expect(mission.phase).toBe(MissionPhase.Mission3Active);
    expect(mission.isPaused).toBe(false);
    expect(mission.spawnMode).toBe(SpawnMode.Suppressed);
    expect(mission.currentGoals.map((g) => g.kind)).toEqual([
      MissionGoalKind.OpenGate1,
      MissionGoalKind.OpenGate2,
      MissionGoalKind.OpenGate3,
      MissionGoalKind.RecoverShieldUpgrade,
    ]);
    expect(mission.currentGoals.every((g) => !g.complete)).toBe(true);
  });

  it('REQ-91 completes mission 3 once the shield-upgrade collectible is collected', () => {
    const mission = new Mission();
    const visited = new VisitedMap();
    const station = emptyStation();
    const ship = new Ship();
    mission.jumpToMission3Briefing(ship, station);
    mission.advance(visited);
    expect(ship.hasShield).toBe(false);

    mission.update(0, ship, emptyDroneField(), emptyBelt(), emptyField(), station, visited, SCREEN_RADIUS);
    expect(mission.phase).toBe(MissionPhase.Mission3Active);

    ship.installShield();
    mission.update(0, ship, emptyDroneField(), emptyBelt(), emptyField(), station, visited, SCREEN_RADIUS);

    expect(ship.hasShield).toBe(true);
    expect(mission.phase).toBe(MissionPhase.Mission3Done);
  });

  it('REQ-91 reaching the central chamber alone no longer completes mission 3', () => {
    const mission = new Mission();
    const visited = new VisitedMap();
    const station = emptyStation();
    const ship = new Ship();
    mission.jumpToMission3Briefing(ship, station);
    mission.advance(visited);

    ship.position = { ...station.centralCenter! };
    mission.update(0, ship, emptyDroneField(), emptyBelt(), emptyField(), station, visited, SCREEN_RADIUS);

    expect(station.isCentralReached(ship)).toBe(true);
    expect(ship.hasShield).toBe(false);
    expect(mission.phase).toBe(MissionPhase.Mission3Active);
  });

  it('REQ-76 proceeds from mission 3 completion to the mission 4 briefing', () => {
    const mission = new Mission();
    const visited = new VisitedMap();
    const station = emptyStation();
    const ship = new Ship();
    mission.jumpToMission3Briefing(ship, station);
    mission.advance(visited);
    ship.installShield();
    mission.update(0, ship, emptyDroneField(), emptyBelt(), emptyField(), station, visited, SCREEN_RADIUS);

    mission.advance(visited);

    expect(mission.phase).toBe(MissionPhase.Mission4Intro);
    expect(mission.isPaused).toBe(true);
  });

  it('REQ-66 jumps straight to the mission 4 briefing with an unexplored signal', () => {
    const mission = new Mission();
    const ship = new Ship();
    const discovered = new DiscoveredMap();

    mission.jumpToMission4Briefing(ship, discovered);

    expect(mission.phase).toBe(MissionPhase.Mission4Intro);
    expect(mission.isPaused).toBe(true);
    expect(mission.signalDirection).not.toBeNull();
    expect(length(mission.signalDirection!)).toBeCloseTo(1, 6);
  });

  it('REQ-92 starts mission 4 travel toward Omega III and the moving freighter', () => {
    const mission = new Mission();
    const visited = new VisitedMap();
    const discovered = new DiscoveredMap();
    const star = new Star();
    const iceRing = new IceRing();
    const freighter = new Freighter();
    const ship = new Ship();
    mission.jumpToMission4Briefing(ship, discovered);
    mission.advance(visited);

    expect(mission.phase).toBe(MissionPhase.Mission4Active);
    expect(mission.isTraversal).toBe(true);
    expect(mission.spawnMode).toBe(SpawnMode.Mission2Travel);
    expect(mission.currentGoals.map((g) => g.kind)).toEqual([
      MissionGoalKind.ReachOmegaIII,
      MissionGoalKind.ReachFreighter,
    ]);

    mission.update(0, ship, emptyDroneField(), emptyBelt(), emptyField(), emptyStation(), visited, SCREEN_RADIUS, discovered, star, iceRing, freighter);

    expect(star.isPlaced).toBe(true);
    expect(iceRing.isPlaced).toBe(true);
    expect(freighter.isPlaced).toBe(true);
    expect(mission.destinationPosition).toEqual(freighter.position);
    expect(mission.initialTravelDistance).toBeGreaterThan(15000);
    expect(mission.initialTravelDistance).toBeLessThan(40000);
  });

  it('REQ-93 picks a signal that avoids already discovered space', () => {
    const mission = new Mission();
    const ship = new Ship();
    const discovered = new DiscoveredMap();
    discovered.record({ left: -20000, top: -20000, right: 0, bottom: 20000 });

    mission.jumpToMission4Briefing(ship, discovered);

    expect(mission.signalDirection).not.toBeNull();
    expect(mission.signalDirection!.x).toBeGreaterThan(0);
  });

  it('REQ-74 lists Omega III and freighter goals during mission 4', () => {
    const mission = new Mission();
    const visited = new VisitedMap();
    const discovered = new DiscoveredMap();
    const star = new Star();
    const iceRing = new IceRing();
    const freighter = new Freighter();
    const ship = new Ship();
    mission.jumpToMission4Briefing(ship, discovered);
    mission.advance(visited);
    mission.update(0, ship, emptyDroneField(), emptyBelt(), emptyField(), emptyStation(), visited, SCREEN_RADIUS, discovered, star, iceRing, freighter);

    expect(mission.currentGoals.every((g) => !g.complete)).toBe(true);

    ship.position = { ...star.position };
    mission.update(0, ship, emptyDroneField(), emptyBelt(), emptyField(), emptyStation(), visited, SCREEN_RADIUS, discovered, star, iceRing, freighter);
    expect(mission.currentGoals[0].complete).toBe(true);

    ship.position = { ...freighter.position };
    mission.update(0, ship, emptyDroneField(), emptyBelt(), emptyField(), emptyStation(), visited, SCREEN_RADIUS, discovered, star, iceRing, freighter);
    expect(mission.currentGoals[1].complete).toBe(true);
    expect(mission.phase).toBe(MissionPhase.Mission4Done);
  });

  it('REQ-74 lists the fuel, hull, ammo, and drone goals during mission 1', () => {
    const mission = new Mission();
    const visited = new VisitedMap();
    mission.advance(visited);

    const goals = mission.currentGoals;
    expect(goals.map((g) => g.kind)).toEqual([
      MissionGoalKind.RefillFuel,
      MissionGoalKind.RefillHull,
      MissionGoalKind.RefillAmmo,
      MissionGoalKind.AvoidDrones,
    ]);
    expect(goals.every((g) => !g.complete)).toBe(true);

    const ship = new Ship();
    ship.collectFuel(100);
    ship.repair(100);
    ship.collectAmmo(100);
    mission.update(0, ship, emptyDroneField(), emptyBelt(), emptyField(), emptyStation(), visited, SCREEN_RADIUS);

    const updated = mission.currentGoals;
    expect(updated[0].complete).toBe(true);
    expect(updated[1].complete).toBe(true);
    expect(updated[2].complete).toBe(true);
    expect(updated[3].complete).toBe(true);
  });

  it('REQ-74 marks the drone goal complete only while no drones hunt', () => {
    const mission = new Mission();
    const visited = new VisitedMap();
    mission.advance(visited);
    const ship = new Ship();
    ship.collectFuel(100);
    ship.repair(100);
    ship.collectAmmo(100);
    const huntingDrone = new Drone(null, 0, [1, 1, 1], 2);
    const drones = new DroneField([huntingDrone]);

    mission.update(0, ship, drones, emptyBelt(), emptyField(), emptyStation(), visited, SCREEN_RADIUS);

    expect(mission.currentGoals[0].complete).toBe(true);
    expect(mission.currentGoals[3].complete).toBe(false);
  });

  it('REQ-74 lists the traverse and left/right wing-gun goals during mission 2', () => {
    const { mission, visited, ship, field, station } = reachMission2Intro();
    mission.advance(visited);

    expect(mission.currentGoals.map((g) => g.kind)).toEqual([
      MissionGoalKind.TraverseToSignal,
      MissionGoalKind.RecoverLeftWingGun,
      MissionGoalKind.RecoverRightWingGun,
    ]);
    expect(mission.currentGoals.every((g) => !g.complete)).toBe(true);

    mission.update(0, ship, emptyDroneField(), emptyBelt(), field, station, visited, SCREEN_RADIUS);
    ship.upgradeWeapon();
    ship.upgradeWeapon();
    ship.position = { ...mission.destinationPosition! };
    mission.update(0, ship, emptyDroneField(), emptyBelt(), field, station, visited, SCREEN_RADIUS);

    expect(mission.currentGoals[0].complete).toBe(true);
    expect(mission.currentGoals[1].complete).toBe(true);
    expect(mission.currentGoals[2].complete).toBe(true);
  });

  it('REQ-74 completes the left wing-gun goal after the first upgrade and the right after the second', () => {
    const { mission, visited, ship, field, station } = reachMission2Intro();
    mission.advance(visited);
    mission.update(0, ship, emptyDroneField(), emptyBelt(), field, station, visited, SCREEN_RADIUS);

    expect(mission.currentGoals[1].complete).toBe(false);
    expect(mission.currentGoals[2].complete).toBe(false);

    ship.upgradeWeapon();
    mission.update(0, ship, emptyDroneField(), emptyBelt(), field, station, visited, SCREEN_RADIUS);
    expect(mission.currentGoals[1].complete).toBe(true);
    expect(mission.currentGoals[2].complete).toBe(false);

    ship.upgradeWeapon();
    mission.update(0, ship, emptyDroneField(), emptyBelt(), field, station, visited, SCREEN_RADIUS);
    expect(mission.currentGoals[1].complete).toBe(true);
    expect(mission.currentGoals[2].complete).toBe(true);
  });

  it('REQ-74 returns no goals during the transition between missions', () => {
    const mission = new Mission();
    const visited = new VisitedMap();
    mission.advance(visited);
    mission.update(0, new Ship(), emptyDroneField(), emptyBelt(), emptyField(), emptyStation(), visited, SCREEN_RADIUS);
    visited.visit({ x: 0, y: 0 });
    mission.advance(visited);

    expect(mission.phase).toBe(MissionPhase.Transition);
    expect(mission.currentGoals).toEqual([]);
  });
});
