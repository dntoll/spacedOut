import { describe, expect, it } from 'vitest';
import { Drone } from './Drone';
import { DroneField } from './DroneField';
import { Mission, MissionPhase } from './Mission';
import { Ship } from './Ship';
import { VisitedMap } from './VisitedMap';

const emptyDroneField = () => new DroneField();

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

    mission.update(0, ship, drones, visited);

    expect(mission.phase).toBe(MissionPhase.Mission1Done);
    expect(mission.isPaused).toBe(true);
  });

  it('REQ-53 does not end mission 1 while a drone is hunting', () => {
    const mission = new Mission();
    const visited = new VisitedMap();
    mission.advance(visited);
    const ship = new Ship();
    const drones = new DroneField([new Drone(null, 0, [1, 1, 1], 2)]);

    mission.update(0, ship, drones, visited);

    expect(mission.phase).toBe(MissionPhase.Mission1Active);
  });

  it('REQ-53 does not end mission 1 while the hull is damaged', () => {
    const mission = new Mission();
    const visited = new VisitedMap();
    mission.advance(visited);
    const ship = new Ship();
    ship.takeDamage(10);
    const drones = emptyDroneField();

    mission.update(0, ship, drones, visited);

    expect(mission.phase).toBe(MissionPhase.Mission1Active);
  });

  it('REQ-54 suppresses spawning during the transition and starts mission 2 in uncharted space', () => {
    const mission = new Mission();
    const visited = new VisitedMap();
    mission.advance(visited);
    mission.update(0, new Ship(), emptyDroneField(), visited);
    expect(mission.phase).toBe(MissionPhase.Mission1Done);

    visited.visit({ x: 0, y: 0 });
    visited.visit({ x: 500, y: 0 });

    mission.advance(visited);
    expect(mission.phase).toBe(MissionPhase.Transition);
    expect(mission.suppressSpawning).toBe(true);
    expect(mission.isPaused).toBe(false);

    const ship = new Ship();
    ship.position = { x: 300, y: 0 };
    mission.update(0, ship, emptyDroneField(), visited);
    expect(mission.phase).toBe(MissionPhase.Transition);

    ship.position = { x: 5000, y: 5000 };
    mission.update(0, ship, emptyDroneField(), visited);
    expect(mission.phase).toBe(MissionPhase.Mission2Intro);
    expect(mission.isPaused).toBe(true);
  });

  it('REQ-54 does not start mission 2 while the ship stays within charted space', () => {
    const mission = new Mission();
    const visited = new VisitedMap();
    mission.advance(visited);
    mission.update(0, new Ship(), emptyDroneField(), visited);
    visited.visit({ x: 0, y: 0 });
    mission.advance(visited);

    const ship = new Ship();
    ship.position = { x: 900, y: 900 };
    for (let step = 0; step < 5; step++) mission.update(0, ship, emptyDroneField(), visited);

    expect(mission.phase).toBe(MissionPhase.Transition);
  });

  it('REQ-55 requests a restart on the mission 2 continue click', () => {
    const mission = new Mission();
    const visited = new VisitedMap();
    mission.advance(visited);
    mission.update(0, new Ship(), emptyDroneField(), visited);
    mission.advance(visited);
    const ship = new Ship();
    ship.position = { x: 5000, y: 5000 };
    mission.update(0, ship, emptyDroneField(), visited);
    expect(mission.phase).toBe(MissionPhase.Mission2Intro);
    expect(mission.requestsRestart).toBe(false);

    mission.advance(visited);

    expect(mission.requestsRestart).toBe(true);
  });
});
