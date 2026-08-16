import type * as Model from '../model';
import type { Drawing, RadialPaint } from './Drawing';

export class Ship {
  draw(drawing: Drawing, ship: Model.Ship): void {
    drawing.withTransform(ship.position, ship.angle, () => {
      if (ship.isThrusting) this.drawEngineGlow(drawing, ship.thrustAmount);

      drawing.withShadow('#7ee9ff', 15, () => {
        drawing.polygon(
          [{ x: 22, y: 0 }, { x: -14, y: 13 }, { x: -8, y: 0 }, { x: -14, y: -13 }],
          '#d9f7ff',
          '#72dff5',
          1.4,
        );
      });
      drawing.polygon([{ x: 10, y: 0 }, { x: -6, y: 5 }, { x: -4, y: -5 }], '#182c45');
    });
  }

  private drawEngineGlow(drawing: Drawing, power: number): void {
    const glow: RadialPaint = {
      from: { x: -15, y: 0 }, fromRadius: 0,
      to: { x: -15, y: 0 }, toRadius: 35,
      stops: [
        { offset: 0, color: `rgba(100,230,255,${0.25 + power * 0.5})` },
        { offset: 1, color: 'rgba(20,90,255,0)' },
      ],
    };
    drawing.circle({ x: -15, y: 0 }, 35, glow);
  }
}
