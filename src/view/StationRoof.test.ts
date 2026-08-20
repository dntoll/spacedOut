import { describe, expect, it } from 'vitest';
import { AsteroidBelt } from '../model/AsteroidBelt';
import { DroneField } from '../model/DroneField';
import { LaserField } from '../model/LaserField';
import { PirateField } from '../model/PirateField';
import { Ship } from '../model/Ship';
import { Station } from '../model/Station';
import type { Vec2 } from '../types';
import { StationRoof } from './StationRoof';

const STATION_RADIUS = 3000;

const placeStation = (seed = 42): Station => {
  const station = new Station();
  station.placeAt({ x: 0, y: 0 }, STATION_RADIUS, 0, seed);
  return station;
};

const switchPosition = (station: Station, index: number): Vec2 => {
  let pos: Vec2 | null = null;
  station.forEachSwitch((sw) => { if (sw.index === index) pos = sw.position; });
  return pos!;
};

const entranceRoomPosition = (station: Station): Vec2 => {
  const room = station.rooms.find((r) => r.kind === 'entrance');
  return room!.position;
};

const openGate = (station: Station, index: number): void => {
  const ship = new Ship();
  ship.position = switchPosition(station, index);
  station.update(0, ship, new AsteroidBelt({ x: 0, y: 0 }, []), new DroneField(), new PirateField(), new LaserField());
};

describe('StationRoof', () => {
  it('REQ-86 reveals interior by line of sight, accumulates, and keeps the entrance always visible', () => {
    const station = placeStation();
    const roof = new StationRoof();
    const ship = new Ship();

    const entrance = entranceRoomPosition(station);
    const central = station.centralCenter!;
    const switch1Pos = switchPosition(station, 1);

    // Ship at the entrance: entrance revealed (always visible); the central chamber
    // sits behind three closed gates so no line of sight reaches it and it stays
    // concealed — proving reveal is line-of-sight blocked by gates, not whole-station.
    ship.position = { ...entrance };
    roof.update(station, ship.position);
    expect(roof.isRevealedAt(station, entrance)).toBe(true);
    expect(roof.isRevealedAt(station, central)).toBe(false);

    // Fly the ship into the switch-1 room: line of sight from inside reveals it.
    ship.position = { ...switch1Pos };
    roof.update(station, ship.position);
    expect(roof.isRevealedAt(station, switch1Pos)).toBe(true);

    // Return to the entrance: the switch-1 room stays revealed (accumulation),
    // and the central chamber — never seen — stays concealed.
    ship.position = { ...entrance };
    roof.update(station, ship.position);
    expect(roof.isRevealedAt(station, switch1Pos)).toBe(true);
    expect(roof.isRevealedAt(station, central)).toBe(false);
  });

  it('REQ-86 opening a gate alone does not reveal the region behind it — line of sight is required', () => {
    const station = placeStation();
    const roof = new StationRoof();
    const ship = new Ship();
    const entrance = entranceRoomPosition(station);
    const central = station.centralCenter!;

    openGate(station, 1);
    expect(station.isGateOpen(1)).toBe(true);

    // Opening gate 1 alone does not reveal the central chamber: it still sits
    // behind closed gates 2 and 3, so there is no line of sight to it.
    ship.position = { ...entrance };
    roof.update(station, ship.position);
    expect(roof.isRevealedAt(station, central)).toBe(false);
  });

  it('REQ-86 reset() re-conceals previously revealed areas so a restart hides the interior again', () => {
    const station = placeStation();
    const roof = new StationRoof();
    const ship = new Ship();
    const entrance = entranceRoomPosition(station);
    const area1Pos = station.rooms.find((r) => r.kind === 'area' && r.index === 1)!.position;

    // Fly into section B (behind gate 1): line of sight from inside reveals it.
    ship.position = { ...area1Pos };
    roof.update(station, ship.position);
    expect(roof.isRevealedAt(station, area1Pos)).toBe(true);

    // Reset (restart): section B is concealed again from the entrance because gate 1
    // is closed and blocks line of sight, so the roof does not remember the prior run.
    roof.reset();
    ship.position = { ...entrance };
    roof.update(station, ship.position);
    expect(roof.isRevealedAt(station, area1Pos)).toBe(false);
  });
});
