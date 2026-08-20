import type { Vec2 } from '../types';

export interface BoundarySegment {
  a: Vec2;
  b: Vec2;
}

export class StationCarver {
  readonly gridN: number;
  readonly cellSize: number;
  readonly radius: number;
  readonly bitmap: Uint8Array;
  private readonly carveable: Uint8Array;
  private readonly half: number;

  constructor(radius: number, cellSize: number) {
    this.radius = radius;
    this.cellSize = cellSize;
    this.gridN = Math.ceil((radius * 2) / cellSize);
    this.half = this.gridN / 2;
    this.bitmap = new Uint8Array(this.gridN * this.gridN);
    this.carveable = new Uint8Array(this.gridN * this.gridN);
    this.markCarveable();
  }

  private idx(c: number, r: number): number { return r * this.gridN + c; }
  inBounds(c: number, r: number): boolean { return c >= 0 && c < this.gridN && r >= 0 && r < this.gridN; }

  private markCarveable(): void {
    for (let r = 0; r < this.gridN; r++) {
      for (let c = 0; c < this.gridN; c++) {
        const p = this.cellCenterLocal(c, r);
        if (p.x * p.x + p.y * p.y <= this.radius * this.radius) this.carveable[this.idx(c, r)] = 1;
      }
    }
  }

  cellCenterLocal(c: number, r: number): Vec2 {
    return { x: (c - this.half + 0.5) * this.cellSize, y: (r - this.half + 0.5) * this.cellSize };
  }

  worldToLocal(point: Vec2, center: Vec2, entranceAngle: number): Vec2 {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const cos = Math.cos(-entranceAngle);
    const sin = Math.sin(-entranceAngle);
    return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
  }

  localToWorld(local: Vec2, center: Vec2, entranceAngle: number): Vec2 {
    const cos = Math.cos(entranceAngle);
    const sin = Math.sin(entranceAngle);
    return { x: center.x + local.x * cos - local.y * sin, y: center.y + local.x * sin + local.y * cos };
  }

  localToCell(local: Vec2): { c: number; r: number } {
    return {
      c: Math.floor(local.x / this.cellSize + this.half),
      r: Math.floor(local.y / this.cellSize + this.half),
    };
  }

  isCarveable(c: number, r: number): boolean {
    return this.inBounds(c, r) && this.carveable[this.idx(c, r)] === 1;
  }

  isSpace(c: number, r: number): boolean {
    return this.inBounds(c, r) && this.bitmap[this.idx(c, r)] === 1;
  }

  fitsRect(centerLocal: Vec2, halfW: number, halfH: number): boolean {
    const cMin = Math.floor((centerLocal.x - halfW) / this.cellSize + this.half);
    const cMax = Math.ceil((centerLocal.x + halfW) / this.cellSize + this.half);
    const rMin = Math.floor((centerLocal.y - halfH) / this.cellSize + this.half);
    const rMax = Math.ceil((centerLocal.y + halfH) / this.cellSize + this.half);
    for (let r = rMin; r <= rMax; r++) {
      for (let c = cMin; c <= cMax; c++) {
        if (!this.inBounds(c, r)) continue;
        if (this.bitmap[this.idx(c, r)] === 1) return false;
      }
    }
    return true;
  }

  carveRectRoom(centerLocal: Vec2, halfW: number, halfH: number, jitter = 0): void {
    const cMin = Math.floor((centerLocal.x - halfW) / this.cellSize + this.half);
    const cMax = Math.ceil((centerLocal.x + halfW) / this.cellSize + this.half);
    const rMin = Math.floor((centerLocal.y - halfH) / this.cellSize + this.half);
    const rMax = Math.ceil((centerLocal.y + halfH) / this.cellSize + this.half);
    for (let r = rMin; r <= rMax; r++) {
      for (let c = cMin; c <= cMax; c++) {
        if (!this.isCarveable(c, r)) continue;
        const cellCenter = this.cellCenterLocal(c, r);
        const dx = Math.abs(cellCenter.x - centerLocal.x);
        const dy = Math.abs(cellCenter.y - centerLocal.y);
        const ew = halfW + (jitter > 0 ? (this.hash(c, r) - 0.5) * 2 * jitter : 0);
        const eh = halfH + (jitter > 0 ? (this.hash(r, c) - 0.5) * 2 * jitter : 0);
        if (dx <= ew && dy <= eh) this.bitmap[this.idx(c, r)] = 1;
      }
    }
  }

  carveRectCorridor(aLocal: Vec2, bLocal: Vec2, halfWidth: number): void {
    const dx = bLocal.x - aLocal.x;
    const dy = bLocal.y - aLocal.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.001) return;
    const ux = dx / len;
    const uy = dy / len;
    const px = -uy;
    const py = ux;
    const span = Math.ceil((len / 2 + halfWidth) / this.cellSize) + 1;
    const mid = { x: (aLocal.x + bLocal.x) / 2, y: (aLocal.y + bLocal.y) / 2 };
    const center = this.localToCell(mid);
    for (let dr = -span; dr <= span; dr++) {
      for (let dc = -span; dc <= span; dc++) {
        const c = center.c + dc;
        const r = center.r + dr;
        if (!this.isCarveable(c, r)) continue;
        const cellCenter = this.cellCenterLocal(c, r);
        const rx = cellCenter.x - aLocal.x;
        const ry = cellCenter.y - aLocal.y;
        const proj = rx * ux + ry * uy;
        const perp = rx * px + ry * py;
        if (proj >= 0 && proj <= len && Math.abs(perp) <= halfWidth) {
          this.bitmap[this.idx(c, r)] = 1;
        }
      }
    }
  }

  carveGateSegment(aLocal: Vec2, bLocal: Vec2): { c: number; r: number }[] {
    const cells: { c: number; r: number }[] = [];
    const dx = bLocal.x - aLocal.x;
    const dy = bLocal.y - aLocal.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.001) return cells;
    const steps = Math.ceil(len / this.cellSize) + 1;
    const seen = new Set<number>();
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const p = { x: aLocal.x + dx * t, y: aLocal.y + dy * t };
      const cell = this.localToCell(p);
      if (!this.inBounds(cell.c, cell.r)) continue;
      const key = this.idx(cell.c, cell.r);
      if (seen.has(key)) continue;
      seen.add(key);
      cells.push(cell);
    }
    return cells;
  }

  traceBoundary(): BoundarySegment[] {
    const segments: BoundarySegment[] = [];
    const n = this.gridN;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (this.bitmap[this.idx(c, r)] !== 1) continue;
        const tl = this.cornerLocal(c, r);
        const tr = this.cornerLocal(c + 1, r);
        const bl = this.cornerLocal(c, r + 1);
        const br = this.cornerLocal(c + 1, r + 1);
        const leftSolid = c > 0 && this.bitmap[this.idx(c - 1, r)] !== 1;
        const rightSolid = c < n - 1 && this.bitmap[this.idx(c + 1, r)] !== 1;
        const topSolid = r > 0 && this.bitmap[this.idx(c, r - 1)] !== 1;
        const bottomSolid = r < n - 1 && this.bitmap[this.idx(c, r + 1)] !== 1;
        if (leftSolid) segments.push({ a: bl, b: tl });
        if (rightSolid) segments.push({ a: tr, b: br });
        if (topSolid) segments.push({ a: tl, b: tr });
        if (bottomSolid) segments.push({ a: br, b: bl });
      }
    }
    return segments;
  }

  private cornerLocal(c: number, r: number): Vec2 {
    return { x: (c - this.half) * this.cellSize, y: (r - this.half) * this.cellSize };
  }

  private hash(c: number, r: number): number {
    const x = Math.sin(c * 127.1 + r * 311.7) * 43758.5453;
    return x - Math.floor(x);
  }
}
