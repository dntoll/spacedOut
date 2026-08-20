import { length, sub } from '../math';
import type { Vec2 } from '../types';
import type { Camera } from './Camera';
import type { Drawing, LinearPaint } from './Drawing';
import type { OutlinedShadowCasters, ShadowCaster, StarLight } from './StarLight';

const UMBRA_ALPHA = 0.92;
const PENUMBRA_ALPHA = 0.4;
const PENUMBRA_WIDTH_FRACTION = 0.05;
const PENUMBRA_MIN_RADIUS = 40;
const PENUMBRA_MAX_SCREEN_WIDTH = 12;
const SCREEN_RADIUS_CULL = 8;
const CULL_MARGIN = 200;

export class ShadowVolume {
  render(drawing: Drawing, casters: OutlinedShadowCasters, starLight: StarLight, camera: Camera): void {
    const { width, height } = drawing.size;
    const zoom = camera.zoom;
    const visibleRange = Math.hypot(width, height) / zoom * 0.7;
    const viewCenter = camera.worldPosition;
    drawing.beginShadowLayer();
    camera.drawWorld(drawing, () => {
      casters.forEachOutlinedCaster((occluder) => {
        if (occluder.radius * zoom < SCREEN_RADIUS_CULL) return;
        const lightDir = starLight.directionAt(occluder.position);
        const len = starLight.shadowLengthFor(occluder.radius);
        if (len <= 0) return;
        if (length(sub(occluder.position, viewCenter)) > visibleRange + occluder.radius + len + CULL_MARGIN) return;
        if (occluder.outline) this.drawPolygonShadow(drawing, occluder, lightDir, len, zoom);
        else this.drawCone(drawing, occluder, lightDir, len, zoom);
      });
    });
    drawing.endShadowLayer();
  }

  private drawPolygonShadow(drawing: Drawing, occluder: ShadowCaster, lightDir: Vec2, len: number, zoom: number): void {
    const outline = occluder.outline!;
    const dx = lightDir.x;
    const dy = lightDir.y;
    const radius = occluder.radius;
    const penWidth = this.penumbraWidth(radius, zoom);
    const perp = { x: -dy, y: dx };
    const drawPenumbra = radius >= PENUMBRA_MIN_RADIUS;
    const n = outline.length;
    const umbraPaths: Vec2[][] = [];
    const penumbraPaths: Vec2[][] = [];
    for (let i = 0; i < n; i++) {
      const v0 = outline[i];
      const v1 = outline[(i + 1) % n];
      const ex = v1.x - v0.x;
      const ey = v1.y - v0.y;
      const edgeLen = Math.hypot(ex, ey);
      if (edgeLen < 0.001) continue;
      const nx = ey / edgeLen;
      const ny = -ex / edgeLen;
      if (nx * dx + ny * dy <= 0) continue;
      const f0: Vec2 = { x: v0.x + dx * len, y: v0.y + dy * len };
      const f1: Vec2 = { x: v1.x + dx * len, y: v1.y + dy * len };
      umbraPaths.push([v0, v1, f1, f0]);
      if (!drawPenumbra) continue;
      const side0 = (v0.x - occluder.position.x) * perp.x + (v0.y - occluder.position.y) * perp.y < 0 ? -1 : 1;
      const side1 = (v1.x - occluder.position.x) * perp.x + (v1.y - occluder.position.y) * perp.y < 0 ? -1 : 1;
      const p0: Vec2 = { x: v0.x + perp.x * penWidth * side0, y: v0.y + perp.y * penWidth * side0 };
      const p1: Vec2 = { x: v1.x + perp.x * penWidth * side1, y: v1.y + perp.y * penWidth * side1 };
      const pf0: Vec2 = { x: p0.x + dx * len, y: p0.y + dy * len };
      const pf1: Vec2 = { x: p1.x + dx * len, y: p1.y + dy * len };
      penumbraPaths.push([p0, p1, pf1, pf0]);
    }
    const center = occluder.position;
    const far: Vec2 = { x: center.x + dx * len, y: center.y + dy * len };
    drawing.fillPolygons(umbraPaths, this.shadowPaint(center, far, UMBRA_ALPHA));
    if (drawPenumbra) drawing.fillPolygons(penumbraPaths, this.shadowPaint(center, far, PENUMBRA_ALPHA));
  }

  private shadowPaint(near: Vec2, far: Vec2, alpha: number): LinearPaint {
    return {
      from: { x: near.x, y: near.y },
      to: { x: far.x, y: far.y },
      stops: [
        { offset: 0, color: `rgba(0,0,0,${alpha})` },
        { offset: 0.45, color: `rgba(0,0,0,${alpha * 0.7})` },
        { offset: 0.75, color: `rgba(0,0,0,${alpha * 0.18})` },
        { offset: 1, color: 'rgba(0,0,0,0)' },
      ],
    };
  }

  private drawCone(drawing: Drawing, occluder: ShadowCaster, lightDir: Vec2, len: number, zoom: number): void {
    const r = occluder.radius;
    const perp = { x: -lightDir.y, y: lightDir.x };
    const near = occluder.position;
    const far: Vec2 = { x: near.x + lightDir.x * len, y: near.y + lightDir.y * len };
    const penWidth = this.penumbraWidth(r, zoom);
    const penHalf = { x: perp.x * (penWidth + r), y: perp.y * (penWidth + r) };
    drawing.polygon(
      [{ x: near.x + penHalf.x, y: near.y + penHalf.y }, { x: far.x + penHalf.x, y: far.y + penHalf.y }, { x: far.x - penHalf.x, y: far.y - penHalf.y }, { x: near.x - penHalf.x, y: near.y - penHalf.y }],
      this.shadowPaint(near, far, PENUMBRA_ALPHA),
    );
    const umbHalf = { x: perp.x * r, y: perp.y * r };
    drawing.polygon(
      [{ x: near.x + umbHalf.x, y: near.y + umbHalf.y }, { x: far.x + umbHalf.x, y: far.y + umbHalf.y }, { x: far.x - umbHalf.x, y: far.y - umbHalf.y }, { x: near.x - umbHalf.x, y: near.y - umbHalf.y }],
      this.shadowPaint(near, far, UMBRA_ALPHA),
    );
  }

  private penumbraWidth(radius: number, zoom: number): number {
    return Math.min(radius * PENUMBRA_WIDTH_FRACTION, PENUMBRA_MAX_SCREEN_WIDTH / zoom);
  }
}
