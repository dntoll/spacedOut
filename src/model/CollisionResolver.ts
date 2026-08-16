import { add, clamp, dot, length, normalize, scale, sub } from '../math';
import { Collision } from './Collision';
import { PhysicsBody } from './PhysicsBody';

export class CollisionResolver {
  static resolveSweptContact(ship: PhysicsBody, obstacle: PhysicsBody, normal: import('../types').Vec2): Collision {
    const invShip = Number.isFinite(ship.mass) ? 1 / ship.mass : 0;
    const invObstacle = Number.isFinite(obstacle.mass) ? 1 / obstacle.mass : 0;
    const relative = sub(ship.velocity, obstacle.velocity);
    const closing = dot(relative, normal);

    if (closing < 0) {
      const impulseSize = -(1 + 0.72) * closing / (invShip + invObstacle);
      const impulse = scale(normal, impulseSize);
      ship.velocity = add(ship.velocity, scale(impulse, invShip));
      obstacle.velocity = sub(obstacle.velocity, scale(impulse, invObstacle));

      const tangent = normalize(sub(relative, scale(normal, closing)));
      const scrape = dot(relative, tangent);
      if (invObstacle > 0) {
        obstacle.angularVelocity = clamp(
          obstacle.angularVelocity + scrape / Math.max(25, obstacle.radius) * 0.35,
          -2.5,
          2.5,
        );
      }
    }

    return new Collision(sub(ship.position, scale(normal, ship.radius)), normal, Math.max(0, -closing));
  }

  static resolveAgainstStaticBoundary(body: PhysicsBody, center: import('../types').Vec2, radius: number): Collision | undefined {
    const boundary = new PhysicsBody({ ...center }, { x: 0, y: 0 }, radius, Number.POSITIVE_INFINITY, 0, 0);
    return this.resolve(body, boundary);
  }

  static resolve(a: PhysicsBody, b: PhysicsBody): Collision | undefined {
    const delta = sub(b.position, a.position);
    const distance = length(delta);
    const overlap = a.radius + b.radius - distance;
    if (overlap <= 0) return undefined;

    const normal = distance > 0 ? scale(delta, 1 / distance) : { x: 1, y: 0 };
    const invA = Number.isFinite(a.mass) ? 1 / a.mass : 0;
    const invB = Number.isFinite(b.mass) ? 1 / b.mass : 0;
    const inverseMass = invA + invB;
    if (inverseMass === 0) return undefined;

    const correction = scale(normal, overlap / inverseMass * 0.82);
    a.position = sub(a.position, scale(correction, invA));
    b.position = add(b.position, scale(correction, invB));

    const relative = sub(b.velocity, a.velocity);
    const closing = dot(relative, normal);
    if (closing >= 0) return undefined;

    const impulseSize = -(1 + 0.72) * closing / inverseMass;
    const impulse = scale(normal, impulseSize);
    a.velocity = sub(a.velocity, scale(impulse, invA));
    b.velocity = add(b.velocity, scale(impulse, invB));

    const tangent = normalize(sub(relative, scale(normal, closing)));
    const scrape = dot(relative, tangent);
    if (invB > 0) b.angularVelocity = clamp(b.angularVelocity - scrape / Math.max(25, b.radius) * 0.35, -2.5, 2.5);
    if (invA > 0) a.angularVelocity = clamp(a.angularVelocity + scrape * 0.002, -0.8, 0.8);

    return new Collision(add(a.position, scale(normal, a.radius)), normal, -closing);
  }
}
