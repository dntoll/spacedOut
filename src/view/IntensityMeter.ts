import { clamp } from '../math';
import type { MusicCategory, MusicThresholds } from './MusicSystem';
import type { Drawing, Size } from './Drawing';

const CATEGORY_COLOR: Record<MusicCategory, string> = {
  calm: '#62e6ff',
  medium: '#ffc35c',
  action: '#ff5c6c',
};

export class IntensityMeter {
  draw(
    drawing: Drawing,
    intensity: number,
    thresholds: MusicThresholds,
    active: MusicCategory | null,
    viewport: Size,
  ): void {
    const compact = viewport.width <= 520;
    const barWidth = compact ? 180 : 240;
    const barHeight = 8;
    const x = Math.round((viewport.width - barWidth) / 2);
    const y = compact ? 52 : 80;

    const i = clamp(intensity, 0, 1);
    const med = clamp(thresholds.medium, 0, 1);
    const act = clamp(Math.max(thresholds.action, med), med, 1);

    drawing.rectangle({ x: x - 1, y: y - 1 }, { width: barWidth + 2, height: barHeight + 2 }, 'rgba(95,229,255,.22)');
    drawing.rectangle({ x, y }, { width: barWidth, height: barHeight }, 'rgba(2,8,17,.82)');

    drawing.withClipRectangle({ x, y }, { width: barWidth, height: barHeight }, () => {
      const medX = x + med * barWidth;
      const actX = x + act * barWidth;
      drawing.rectangle({ x, y }, { width: med * barWidth, height: barHeight }, 'rgba(98,230,255,.12)');
      drawing.rectangle({ x: medX, y }, { width: (act - med) * barWidth, height: barHeight }, 'rgba(255,195,92,.12)');
      drawing.rectangle({ x: actX, y }, { width: (1 - act) * barWidth, height: barHeight }, 'rgba(255,92,108,.14)');
    });

    const fillColor = active ? CATEGORY_COLOR[active] : 'rgba(220,245,250,.6)';
    drawing.rectangle({ x, y }, { width: i * barWidth, height: barHeight }, fillColor);

    const tickTop = y - 3;
    const tickBottom = y + barHeight + 3;
    drawing.line({ x: x + med * barWidth, y: tickTop }, { x: x + med * barWidth, y: tickBottom }, 'rgba(255,195,92,.9)', 1.5);
    drawing.line({ x: x + act * barWidth, y: tickTop }, { x: x + act * barWidth, y: tickBottom }, 'rgba(255,92,108,.9)', 1.5);

    const needleX = x + i * barWidth;
    drawing.line({ x: needleX, y: y - 2 }, { x: needleX, y: y + barHeight + 2 }, '#ebfbff', 2);
  }
}
