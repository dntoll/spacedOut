import { describe, expect, it, vi } from 'vitest';
import { Drone } from '../model/Drone';
import { DroneField } from '../model/DroneField';
import { Mission, MissionPhase } from '../model';
import { Pirate } from '../model/Pirate';
import { PirateField } from '../model/PirateField';
import type * as Model from '../model';
import type { Vec2 } from '../types';
import { Camera } from './Camera';
import type { Drawing } from './Drawing';
import { SignalIndicator } from './SignalIndicator';

const stubDrawing = (size = { width: 800, height: 600 }): { drawing: Drawing; dashedLine: ReturnType<typeof vi.fn>; arc: ReturnType<typeof vi.fn> } => {
  const dashedLine = vi.fn();
  const arc = vi.fn();
  const drawing = { size, dashedLine, arc } as unknown as Drawing;
  return { drawing, dashedLine, arc };
};

const stubModel = (overrides: Partial<Model.Game> = {}): Model.Game =>
  ({
    mission: new Mission(),
    droneField: new DroneField(),
    pirateField: new PirateField(),
    elapsed: 0.5,
    ...overrides,
  }) as unknown as Model.Game;

describe('SignalIndicator', () => {
  it('REQ-56 draws nothing before mission 1 ends', () => {
    const { drawing, dashedLine, arc } = stubDrawing();
    const model = stubModel();
    const camera = new Camera();

    new SignalIndicator().draw(drawing, model, camera);

    expect(dashedLine).not.toHaveBeenCalled();
    expect(arc).not.toHaveBeenCalled();
  });

  it('REQ-56 draws the dotted red line and a red growing-arc wave when the signal is set', () => {
    const { drawing, dashedLine, arc } = stubDrawing({ width: 800, height: 600 });
    const mission = new Mission();
    mission.phase = MissionPhase.Mission1Done;
    mission.signalDirection = { x: 1, y: 0 };
    const model = stubModel({ mission });
    const camera = new Camera();

    new SignalIndicator().draw(drawing, model, camera);

    expect(dashedLine).toHaveBeenCalledTimes(1);
    const [edge, inner, color, width] = dashedLine.mock.calls[0];
    expect(color).toBe('#ff3b3b');
    expect(width).toBe(3);
    expect(edge.x).toBe(800);
    expect(edge.y).toBe(300);
    expect(inner.x).toBe(800 - 140);
    expect(inner.y).toBe(300);

    expect(arc).toHaveBeenCalled();
    for (const call of arc.mock.calls) {
      const [, , , , arcColor] = call;
      expect(arcColor).toMatch(/^rgba\(255,59,59,/);
    }
  });

  it('REQ-56 places the edge on the correct side for an upward signal', () => {
    const { drawing, dashedLine } = stubDrawing({ width: 800, height: 600 });
    const mission = new Mission();
    mission.phase = MissionPhase.Mission1Done;
    mission.signalDirection = { x: 0, y: -1 };
    const model = stubModel({ mission });
    const camera = new Camera();

    new SignalIndicator().draw(drawing, model, camera);

    const [edge] = dashedLine.mock.calls[0];
    expect(edge.x).toBe(400);
    expect(edge.y).toBe(0);
  });

  it('REQ-64 aims the signal arrow at the destination once it is placed', () => {
    const { drawing, dashedLine } = stubDrawing({ width: 800, height: 600 });
    const mission = {
      destinationPosition: { x: 100000, y: 0 },
      signalDirection: { x: 0, y: -1 },
    } as unknown as Model.Mission;
    const model = stubModel({ mission });
    const camera = new Camera();
    camera.update({ x: 0, y: 0 }, { x: 0, y: 0 }, 1);

    new SignalIndicator().draw(drawing, model, camera);

    const [edge] = dashedLine.mock.calls[0];
    expect(edge.x).toBe(800);
    expect(edge.y).toBe(300);
  });

  it('REQ-57 draws a blue wave toward an off-screen hunting drone', () => {
    const { drawing, arc } = stubDrawing({ width: 800, height: 600 });
    const drone = new Drone(null, 0, [1, 1, 1], 2);
    drone.position = { x: 100000, y: 0 };
    const model = stubModel({ droneField: new DroneField([drone]) });
    const camera = new Camera();

    new SignalIndicator().draw(drawing, model, camera);

    expect(arc).toHaveBeenCalled();
    const greenCalls = arc.mock.calls.filter((call) => typeof call[4] === 'string' && call[4].startsWith('rgba(93,184,255,'));
    expect(greenCalls.length).toBeGreaterThan(0);
  });

  it('REQ-57 does not draw a blue wave for an on-screen hunting drone', () => {
    const { drawing, arc } = stubDrawing({ width: 800, height: 600 });
    const drone = new Drone(null, 0, [1, 1, 1], 2);
    drone.position = { x: 0, y: 0 };
    const model = stubModel({ droneField: new DroneField([drone]) });
    const camera = new Camera();
    camera.update({ x: 0, y: 0 }, { x: 0, y: 0 }, 1);

    new SignalIndicator().draw(drawing, model, camera);

    const greenCalls = arc.mock.calls.filter((call) => typeof call[4] === 'string' && call[4].startsWith('rgba(93,184,255,'));
    expect(greenCalls).toHaveLength(0);
  });

  it('REQ-57 draws no blue waves when no drones are hunting', () => {
    const { drawing, arc } = stubDrawing({ width: 800, height: 600 });
    const attached = new Drone({ position: { x: 0, y: 0 }, radius: 30 } as never, 0, [1, 1, 1], 2);
    attached.position = { x: 100000, y: 0 };
    const model = stubModel({ droneField: new DroneField([attached]) });
    const camera = new Camera();

    new SignalIndicator().draw(drawing, model, camera);

    const greenCalls = arc.mock.calls.filter((call) => typeof call[4] === 'string' && call[4].startsWith('rgba(93,184,255,'));
    expect(greenCalls).toHaveLength(0);
  });

  it('REQ-63 draws an orange wave toward an off-screen hunting pirate', () => {
    const { drawing, arc } = stubDrawing({ width: 800, height: 600 });
    const pirate = new Pirate({ x: 100000, y: 0 }, [1, 1, 1], 3);
    pirate.awaken();
    const model = stubModel({ pirateField: new PirateField([pirate]) });
    const camera = new Camera();

    new SignalIndicator().draw(drawing, model, camera);

    const pirateCalls = arc.mock.calls.filter((call) => typeof call[4] === 'string' && call[4].startsWith('rgba(255,106,74,'));
    expect(pirateCalls.length).toBeGreaterThan(0);
  });

  it('REQ-63 does not draw a pirate wave for an on-screen pirate', () => {
    const { drawing, arc } = stubDrawing({ width: 800, height: 600 });
    const pirate = new Pirate({ x: 0, y: 0 }, [1, 1, 1], 3);
    pirate.awaken();
    const model = stubModel({ pirateField: new PirateField([pirate]) });
    const camera = new Camera();
    camera.update({ x: 0, y: 0 }, { x: 0, y: 0 }, 1);

    new SignalIndicator().draw(drawing, model, camera);

    const pirateCalls = arc.mock.calls.filter((call) => typeof call[4] === 'string' && call[4].startsWith('rgba(255,106,74,'));
    expect(pirateCalls).toHaveLength(0);
  });
});
