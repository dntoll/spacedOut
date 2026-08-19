import type * as Model from '../model';
import type { Drawing } from './Drawing';
import type { StarLight } from './StarLight';
import { StationHull } from './StationHull';
import { StationInterior } from './StationInterior';
import { StationFixtures } from './StationFixtures';

export class Station {
  private readonly hull = new StationHull();
  private readonly interior = new StationInterior();
  private readonly fixtures = new StationFixtures();

  draw(drawing: Drawing, station: Model.Station, starLight: StarLight, zoom: number): void {
    if (!station.isPlaced) return;
    this.interior.draw(drawing, station, starLight, zoom);
    this.fixtures.draw(drawing, station, starLight, zoom);
    this.hull.draw(drawing, station, starLight, zoom);
  }
}
