import type * as Model from '../model';
import type { Vec2 } from '../types';
import type { Drawing } from './Drawing';
import type { StarLight } from './StarLight';
import { StationHull } from './StationHull';
import { StationInterior } from './StationInterior';
import { StationFixtures } from './StationFixtures';
import { StationLamp } from './StationLamp';
import { StationRoof } from './StationRoof';

export class Station {
  private readonly hull = new StationHull();
  private readonly interior = new StationInterior();
  private readonly fixtures = new StationFixtures();
  private readonly lamp = new StationLamp();
  private readonly roof = new StationRoof();

  reset(): void {
    this.lamp.reset();
    this.roof.reset();
  }

  draw(drawing: Drawing, station: Model.Station, starLight: StarLight, zoom: number, shipPosition: Vec2, cameraPosition: Vec2, lampRadius: number, bare = false): void {
    if (!station.isPlaced) return;
    this.interior.draw(drawing, station, starLight, zoom);
    if (!bare) {
      this.lamp.draw(drawing, station, shipPosition, cameraPosition, zoom, lampRadius, this.roof);
    }
    this.fixtures.draw(drawing, station, starLight, zoom);
    this.hull.draw(drawing, station, starLight, zoom);
  }
}
