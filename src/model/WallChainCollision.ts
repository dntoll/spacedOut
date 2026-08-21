import { add, dot, normalize, scale, sub } from '../math';
import type { Vec2 } from '../types';
import { Collision } from './Collision';
import { PhysicsBody } from './PhysicsBody';
import type { WallChain } from './SweptCircleCollision';

const RESTITUTION = 0.72;

const toLocal = (point: Vec2, chain: WallChain): Vec2 => {
  const cos = Math.cos(-chain.angle);
  const sin = Math.sin(-chain.angle);
  const d = sub(point, chain.position);
  return { x: d.x * cos - d.y * sin, y: d.x * sin + d.y * cos };
};

const toWorld = (local: Vec2, chain: WallChain): Vec2 => {
  const cos = Math.cos(chain.angle);
  const sin = Math.sin(chain.angle);
  return { x: chain.position.x + local.x * cos - local.y * sin, y: chain.position.y + local.x * sin + local.y * cos };
};

const nearestOnChain = (local: Vec2, chain: WallChain): { point: Vec2; distSq: number } => {
  const n = chain.localVertices.length;
  const edgeCount = chain.closed ? n : n - 1;
  let bestSq = Infinity;
  let bestPoint: Vec2 = local;
  for (let i = 0; i < edgeCount; i++) {
    const a = chain.localVertices[i];
    const b = chain.localVertices[(i + 1) % n];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const denom = ex * ex + ey * ey;
    const t = denom < 1e-9 ? 0 : Math.max(0, Math.min(1, ((local.x - a.x) * ex + (local.y - a.y) * ey) / denom));
    const px = a.x + ex * t;
    const py = a.y + ey * t;
    const dx = local.x - px;
    const dy = local.y - py;
    const dsq = dx * dx + dy * dy;
    if (dsq < bestSq) {
      bestSq = dsq;
      bestPoint = { x: px, y: py };
    }
  }
  return { point: bestPoint, distSq: bestSq };
};

// True if `point` lies within `expand` of any wall edge (laser/shot hit test).
export const wallChainHit = (point: Vec2, expand: number, chain: WallChain): boolean => {
  const local = toLocal(point, chain);
  const { distSq } = nearestOnChain(local, chain);
  const reach = expand + chain.wallRadius;
  return distSq <= reach * reach;
};

// Push a body out of a wall along the nearest edge normal and bounce it (used for
// regular asteroids and supply containers resting against station walls). Mirrors
// CollisionResolver.resolve but against a polyline edge rather than a circle.
export const resolveWallChainBody = (body: PhysicsBody, chain: WallChain): Collision | undefined => {
  const local = toLocal(body.position, chain);
  const { point, distSq } = nearestOnChain(local, chain);
  const dist = Math.sqrt(distSq);
  const reach = body.radius + chain.wallRadius;
  const overlap = reach - dist;
  if (overlap <= 0) return undefined;

  let normalLocal: Vec2;
  if (dist > 1e-6) {
    normalLocal = normalize(sub(local, point));
  } else {
    // Body center exactly on the wall; push along the vector from the wall toward
    // the station center as a fallback inward direction.
    normalLocal = normalize(sub(chain.position, body.position));
    if (!Number.isFinite(normalLocal.x)) normalLocal = { x: 1, y: 0 };
  }
  const cos = Math.cos(chain.angle);
  const sin = Math.sin(chain.angle);
  const worldNormal: Vec2 = { x: normalLocal.x * cos - normalLocal.y * sin, y: normalLocal.x * sin + normalLocal.y * cos };

  body.position = add(body.position, scale(worldNormal, overlap));
  const closing = dot(body.velocity, worldNormal);
  if (closing < 0) {
    const impulse = scale(worldNormal, -(1 + RESTITUTION) * closing);
    body.velocity = add(body.velocity, impulse);
  }
  return new Collision(add(body.position, scale(worldNormal, body.radius)), worldNormal, Math.max(0, -closing));
};

export const wallChainWorldVertices = (chain: WallChain): Vec2[] => chain.localVertices.map((v) => toWorld(v, chain));
