import { add, dot, length, normalize, scale, sub } from '../math';
import type { CollisionObserver } from './CollisionObserver';
import { CollisionResolver } from './CollisionResolver';
import { Damage } from './Damage';
import type { DamageObserver } from './DamageObserver';
import { DamageCalculator } from './DamageCalculator';
import type { Ship } from './Ship';
import { SweptCircleCollision, type ShipObstacle, type SweepHit, isCapsuleObstacle } from './SweptCircleCollision';

export class ShipCollisionSystem {
  private readonly collisionObservers = new Set<CollisionObserver>();
  private readonly damageObservers = new Set<DamageObserver>();

  resolve(ship: Ship, obstacles: ShipObstacle[], dt: number): void {
    let start = { ...ship.previousPosition };
    let end = { ...ship.position };

    for (let iteration = 0; iteration < 6; iteration++) {
      const hits = obstacles
        .map((obstacle) => isCapsuleObstacle(obstacle)
          ? SweptCircleCollision.findCapsule(start, end, ship.radius, obstacle)
          : SweptCircleCollision.find(start, end, ship.radius, obstacle))
        .filter((hit): hit is SweepHit => hit !== undefined);
      if (hits.length === 0) {
        ship.position = end;
        return;
      }

      const earliestTime = Math.min(...hits.map((hit) => hit.time));
      const simultaneous = hits.filter((hit) => Math.abs(hit.time - earliestTime) < 0.0001);
      const movement = sub(end, start);
      const contactCenter = add(start, scale(movement, earliestTime));
      const combinedNormal = normalize(
        simultaneous.reduce((sum, hit) => add(sum, hit.normal), { x: 0, y: 0 }),
      );
      const separationNormal = length(combinedNormal) > 0 ? combinedNormal : simultaneous[0].normal;
      ship.position = add(contactCenter, scale(separationNormal, 0.05));

      const uniqueObstacles = new Set<ShipObstacle>();
      const incomingVelocity = { ...ship.velocity };
      let combinedVelocityChange = { x: 0, y: 0 };
      for (const hit of simultaneous) {
        if (uniqueObstacles.has(hit.obstacle)) continue;
        uniqueObstacles.add(hit.obstacle);
        ship.velocity = { ...incomingVelocity };
        const collision = CollisionResolver.resolveSweptContact(ship, hit.obstacle, hit.normal);
        combinedVelocityChange = add(combinedVelocityChange, sub(ship.velocity, incomingVelocity));
        const damage = DamageCalculator.damageFor(collision.impactSpeed, hit.obstacle.massive);
        if (damage > 0 && !ship.isInvulnerable) {
          ship.takeDamage(damage);
          const origin = ship.isAlive ? collision.position : ship.position;
          for (const observer of this.damageObservers) observer.onDamage(new Damage({ ...origin }, damage, !ship.isAlive));
        }
        for (const observer of this.collisionObservers) observer.onCollision(collision);
      }
      ship.velocity = add(incomingVelocity, combinedVelocityChange);

      const remainingTime = dt * (1 - earliestTime);
      let remainingMovement = scale(ship.velocity, remainingTime);
      for (const hit of simultaneous) {
        const inward = dot(remainingMovement, hit.normal);
        if (inward < 0) remainingMovement = sub(remainingMovement, scale(hit.normal, inward));
      }
      start = { ...ship.position };
      end = add(start, remainingMovement);
    }

    ship.position = start;
  }

  addCollisionObserver(observer: CollisionObserver): void { this.collisionObservers.add(observer); }
  removeCollisionObserver(observer: CollisionObserver): void { this.collisionObservers.delete(observer); }
  addDamageObserver(observer: DamageObserver): void { this.damageObservers.add(observer); }
  removeDamageObserver(observer: DamageObserver): void { this.damageObservers.delete(observer); }
}
