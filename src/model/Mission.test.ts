import { describe, expect, it } from 'vitest';
import { Asteroid } from './Asteroid';
import { AsteroidBelt } from './AsteroidBelt';
import { Drone } from './Drone';
import { DroneField } from './DroneField';
import { MassiveAsteroid } from './MassiveAsteroid';
import { MassiveAsteroidField } from './MassiveAsteroidField';
import { Mission, MissionPhase, SpawnMode } from './Mission';
import { Ship } from './Ship';
import { VisitedMap } from './VisitedMap';
import { length } from '../math';

const emptyDroneField = () => new DroneField();
const emptyBelt = () => new AsteroidBelt({ x: 0, y: 0 }, []);
const emptyField = () => new MassiveAsteroidField({ x: 0, y: 0 }, 18, []);
const SCREEN_RADIUS = 1000;

const reachMission2Intro = (): { mission: Mission; visited: VisitedMap; ship: Ship; field: MassiveAsteroidField } => {
  const mission = new Mission();
  const visited = new VisitedMap();
  const field = emptyField();
  mission.advance(visited);
  mission.update(0, new Ship(), emptyDroneField(), emptyBelt(), field, visited, SCREEN_RADIUS);
  visited.visit({ x: 0, y: 0 });
  mission.advance(visited);
  const ship = new Ship();
  ship.position = { x: 5000, y: 5000 };
  mission.update(0, ship, emptyDroneField(), emptyBelt(), field, visited, SCREEN_RADIUS);
  return { mission, visited, ship, field };
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

  it('REQ-53 ends mission 1 when hull and ammo are full, fuel exceeds 80, and no drones hunt', () => {
    const mission = new Mission();
    const visited = new VisitedMap();
    mission.advance(visited);
    const ship = new Ship();
    const drones = emptyDroneField();

    mission.update(0, ship, drones, emptyBelt(), emptyField(), visited, SCREEN_RADIUS);

    expect(mission.phase).toBe(MissionPhase.Mission1Done);
    expect(mission.isPaused).toBe(true);
  });

  it('REQ-53 does not end mission 1 while a drone is hunting', () => {
    const mission = new Mission();
    const visited = new VisitedMap();
    mission.advance(visited);
    const ship = new Ship();
    const drones = new DroneField([new Drone(null, 0, [1, 1, 1], 2)]);

    mission.update(0, ship, drones, emptyBelt(), emptyField(), visited, SCREEN_RADIUS);

    expect(mission.phase).toBe(MissionPhase.Mission1Active);
  });

  it('REQ-53 does not end mission 1 while the hull is damaged', () => {
    const mission = new Mission();
    const visited = new VisitedMap();
    mission.advance(visited);
    const ship = new Ship();
    ship.takeDamage(10);
    const drones = emptyDroneField();

    mission.update(0, ship, drones, emptyBelt(), emptyField(), visited, SCREEN_RADIUS);

    expect(mission.phase).toBe(MissionPhase.Mission1Active);
  });

  it('REQ-56 randomizes a signal direction when mission 1 ends', () => {
    const mission = new Mission();
    const visited = new VisitedMap();
    mission.advance(visited);
    expect(mission.signalDirection).toBeNull();

    mission.update(0, new Ship(), emptyDroneField(), emptyBelt(), emptyField(), visited, SCREEN_RADIUS);

    expect(mission.phase).toBe(MissionPhase.Mission1Done);
    expect(mission.signalDirection).not.toBeNull();
    expect(length(mission.signalDirection!)).toBeCloseTo(1, 6);
  });

  it('REQ-54 suppresses spawning during the transition and starts mission 2 in uncharted space', () => {
    const mission = new Mission();
    const visited = new VisitedMap();
    mission.advance(visited);
    mission.update(0, new Ship(), emptyDroneField(), emptyBelt(), emptyField(), visited, SCREEN_RADIUS);
    expect(mission.phase).toBe(MissionPhase.Mission1Done);

    visited.visit({ x: 0, y: 0 });
    visited.visit({ x: 500, y: 0 });

    mission.advance(visited);
    expect(mission.phase).toBe(MissionPhase.Transition);
    expect(mission.spawnMode).toBe(SpawnMode.Suppressed);
    expect(mission.isPaused).toBe(false);

    const ship = new Ship();
    ship.position = { x: 300, y: 0 };
    mission.update(0, ship, emptyDroneField(), emptyBelt(), emptyField(), visited, SCREEN_RADIUS);
    expect(mission.phase).toBe(MissionPhase.Transition);

    ship.position = { x: 5000, y: 5000 };
    mission.update(0, ship, emptyDroneField(), emptyBelt(), emptyField(), visited, SCREEN_RADIUS);
    expect(mission.phase).toBe(MissionPhase.Mission2Intro);
    expect(mission.isPaused).toBe(true);
  });

  it('REQ-54 does not start mission 2 while the ship stays within charted space', () => {
    const mission = new Mission();
    const visited = new VisitedMap();
    mission.advance(visited);
    mission.update(0, new Ship(), emptyDroneField(), emptyBelt(), emptyField(), visited, SCREEN_RADIUS);
    visited.visit({ x: 0, y: 0 });
    mission.advance(visited);

    const ship = new Ship();
    ship.position = { x: 900, y: 900 };
    for (let step = 0; step < 5; step++) mission.update(0, ship, emptyDroneField(), emptyBelt(), emptyField(), visited, SCREEN_RADIUS);

    expect(mission.phase).toBe(MissionPhase.Transition);
  });

  it('REQ-54 does not start mission 2 while a regular asteroid is within a screen radius', () => {
    const mission = new Mission();
    const visited = new VisitedMap();
    mission.advance(visited);
    mission.update(0, new Ship(), emptyDroneField(), emptyBelt(), emptyField(), visited, SCREEN_RADIUS);
    visited.visit({ x: 0, y: 0 });
    mission.advance(visited);
    expect(mission.phase).toBe(MissionPhase.Transition);

    const ship = new Ship();
    ship.position = { x: 5000, y: 5000 };
    const asteroid = new Asteroid(1, { x: 5000, y: 5000 }, { x: 0, y: 0 }, 20, 0, 0, [1, 1, 1], 0.5);
    const belt = new AsteroidBelt({ x: 0, y: 0 }, [asteroid]);

    mission.update(0, ship, emptyDroneField(), belt, emptyField(), visited, SCREEN_RADIUS);

    expect(mission.phase).toBe(MissionPhase.Transition);

    mission.update(0, ship, emptyDroneField(), emptyBelt(), emptyField(), visited, SCREEN_RADIUS);
    expect(mission.phase).toBe(MissionPhase.Mission2Intro);
  });

  it('REQ-54 does not start mission 2 while a massive asteroid is within a screen radius', () => {
    const mission = new Mission();
    const visited = new VisitedMap();
    mission.advance(visited);
    mission.update(0, new Ship(), emptyDroneField(), emptyBelt(), emptyField(), visited, SCREEN_RADIUS);
    visited.visit({ x: 0, y: 0 });
    mission.advance(visited);

    const ship = new Ship();
    ship.position = { x: 5000, y: 5000 };
    const massive = new MassiveAsteroid(1, { x: 5200, y: 5000 }, 100, 0, [1, 1, 1, 1], [], 0.5);
    const field = new MassiveAsteroidField({ x: 0, y: 0 }, 18, [massive]);

    mission.update(0, ship, emptyDroneField(), emptyBelt(), field, visited, SCREEN_RADIUS);

    expect(mission.phase).toBe(MissionPhase.Transition);
  });

  it('REQ-55 begins the traversal mission on the mission 2 continue click instead of restarting', () => {
    const { mission, visited } = reachMission2Intro();

    expect(mission.phase).toBe(MissionPhase.Mission2Intro);
    expect(mission.requestsRestart).toBe(false);

    mission.advance(visited);

    expect(mission.phase).toBe(MissionPhase.Mission2Active);
    expect(mission.isPaused).toBe(false);
    expect(mission.requestsRestart).toBe(false);
  });

  it('REQ-60 runs the traversal in the mission-2 travel spawn mode', () => {
    const { mission, visited, ship, field } = reachMission2Intro();
    mission.advance(visited);

    expect(mission.spawnMode).toBe(SpawnMode.Mission2Travel);
    expect(mission.isTraversal).toBe(true);

    mission.update(0, ship, emptyDroneField(), emptyBelt(), field, visited, SCREEN_RADIUS);
    expect(mission.spawnMode).toBe(SpawnMode.Mission2Travel);
  });

  it('REQ-61 reports a remaining distance that shrinks as the ship approaches the destination', () => {
    const { mission, visited, ship, field } = reachMission2Intro();
    mission.advance(visited);
    mission.update(0, ship, emptyDroneField(), emptyBelt(), field, visited, SCREEN_RADIUS);

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
    mission.update(0, ship, emptyDroneField(), emptyBelt(), field, visited, SCREEN_RADIUS);

    expect(mission.distanceRemaining).toBeLessThan(initial);
  });

  it('REQ-64 places a huge destination asteroid and ends the mission when the ship arrives', () => {
    const { mission, visited, ship, field } = reachMission2Intro();
    mission.advance(visited);
    mission.update(0, ship, emptyDroneField(), emptyBelt(), field, visited, SCREEN_RADIUS);

    expect(field.destination).not.toBeNull();
    expect(field.destination!.radius).toBeGreaterThan(ship.radius * 30);

    ship.position = { ...mission.destinationPosition! };
    ship.upgradeWeapon();
    ship.upgradeWeapon();
    mission.update(0, ship, emptyDroneField(), emptyBelt(), field, visited, SCREEN_RADIUS);

    expect(mission.phase).toBe(MissionPhase.Mission2Done);
    expect(mission.isPaused).toBe(true);
  });

  it('REQ-64 does not end until the ship reaches the destination body', () => {
    const { mission, visited, ship, field } = reachMission2Intro();
    mission.advance(visited);
    mission.update(0, ship, emptyDroneField(), emptyBelt(), field, visited, SCREEN_RADIUS);
    ship.upgradeWeapon();
    ship.upgradeWeapon();
    const destination = { ...mission.destinationPosition! };

    ship.position = { x: destination.x + 5400, y: destination.y };
    mission.update(0, ship, emptyDroneField(), emptyBelt(), field, visited, SCREEN_RADIUS);
    expect(mission.phase).toBe(MissionPhase.Mission2Active);

    ship.position = { ...destination };
    mission.update(0, ship, emptyDroneField(), emptyBelt(), field, visited, SCREEN_RADIUS);
    expect(mission.phase).toBe(MissionPhase.Mission2Done);
  });

  it('REQ-64 does not end on arrival until both wing guns are recovered', () => {
    const { mission, visited, ship, field } = reachMission2Intro();
    mission.advance(visited);
    mission.update(0, ship, emptyDroneField(), emptyBelt(), field, visited, SCREEN_RADIUS);
    ship.position = { ...mission.destinationPosition! };

    mission.update(0, ship, emptyDroneField(), emptyBelt(), field, visited, SCREEN_RADIUS);
    expect(mission.phase).toBe(MissionPhase.Mission2Active);

    ship.upgradeWeapon();
    mission.update(0, ship, emptyDroneField(), emptyBelt(), field, visited, SCREEN_RADIUS);
    expect(mission.phase).toBe(MissionPhase.Mission2Active);

    ship.upgradeWeapon();
    mission.update(0, ship, emptyDroneField(), emptyBelt(), field, visited, SCREEN_RADIUS);
    expect(mission.phase).toBe(MissionPhase.Mission2Done);
  });

  it('REQ-65 requests a restart on the mission 2 done continue click', () => {
    const { mission, visited, ship, field } = reachMission2Intro();
    mission.advance(visited);
    mission.update(0, ship, emptyDroneField(), emptyBelt(), field, visited, SCREEN_RADIUS);
    ship.upgradeWeapon();
    ship.upgradeWeapon();
    ship.position = { ...mission.destinationPosition! };
    mission.update(0, ship, emptyDroneField(), emptyBelt(), field, visited, SCREEN_RADIUS);
    expect(mission.phase).toBe(MissionPhase.Mission2Done);
    expect(mission.requestsRestart).toBe(false);

    mission.advance(visited);

    expect(mission.requestsRestart).toBe(true);
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
});
