import type * as Model from '../model';
import type { Vec2 } from '../types';
import type { Drawing } from './Drawing';
import type { StarLight } from './StarLight';
import { StationHull } from './StationHull';
import { StationInterior } from './StationInterior';
import { StationFixtures } from './StationFixtures';
import { StationRoof } from './StationRoof';

export class Station {
  private readonly hull = new StationHull();
  private readonly interior = new StationInterior();
  private readonly fixtures = new StationFixtures();
  private readonly roof = new StationRoof();

  draw(drawing: Drawing, station: Model.Station, starLight: StarLight, zoom: number, shipPosition: Vec2): void {
    if (!station.isPlaced) return;
    this.interior.draw(drawing, station, starLight, zoom);
    this.fixtures.draw(drawing, station, starLight, zoom);
    this.roof.draw(drawing, station, shipPosition);
    this.hull.draw(drawing, station, starLight, zoom);
  }
}
