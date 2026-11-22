import {
  CategoryScale,
  Chart,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartDataset,
} from 'chart.js';
import { formatFps, formatMs, multiplierLabel } from './format';
import type { ResultRow } from './model';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip);

export interface Series {
  key: 'idealFPS' | 'displayedFPS' | 'realFPS';
  label: string;
  cssVar: string;
  dash: number[];
  width: number;
  pointStyle: 'circle' | 'rect' | 'triangle';
}

export const SERIES: Series[] = [
  { key: 'idealFPS', label: 'Ideal FPS', cssVar: '--series-ideal', dash: [6, 4], width: 1.5, pointStyle: 'circle' },
  { key: 'displayedFPS', label: 'Displayed FPS', cssVar: '--series-displayed', dash: [], width: 2.5, pointStyle: 'circle' },
  { key: 'realFPS', label: 'Real FPS', cssVar: '--series-real', dash: [], width: 2, pointStyle: 'rect' },
];

function css(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export class FpsChart {
  private chart: Chart<'line', (number | null)[], string>;
  private rows: (ResultRow | null)[] = [];

  constructor(canvas: HTMLCanvasElement) {
    const datasets: ChartDataset<'line', (number | null)[]>[] = SERIES.map((s) => ({
      label: s.label,
      data: [],
      borderDash: s.dash,
      borderWidth: s.width,
      pointStyle: s.pointStyle,
      pointRadius: 3.5,
      pointHoverRadius: 5,
      tension: 0,
      // Multipliers without an overhead value are gaps, not interpolated.
      spanGaps: false,
    }));

    this.chart = new Chart<'line', (number | null)[], string>(canvas, {
      type: 'line',
      data: { labels: [], datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        layout: { padding: { top: 4, right: 8 } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 12 } } },
          y: {
            beginAtZero: true,
            grace: '6%',
            title: { display: true, text: 'FPS', font: { size: 12 } },
            ticks: { font: { size: 12 }, maxTicksLimit: 8 },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            usePointStyle: true,
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${formatFps(ctx.parsed.y ?? NaN)}`,
              footer: (items) => {
                const row = this.rows[items[0]?.dataIndex ?? -1];
                if (!row) return 'No overhead value';
                return [`FG overhead: ${formatMs(row.fgOverheadMs)}`, `Real frame time: ${formatMs(row.actualFrameTimeMs)}`];
              },
            },
          },
        },
      },
    });
    this.applyTheme();
  }

  /** `rows[i]` is null when multiplier i + 1 has no overhead value; only Ideal FPS is plotted there. */
  update(rows: (ResultRow | null)[], baseFPS: number): void {
    this.rows = rows;
    this.chart.data.labels = rows.map((_, i) => multiplierLabel(i + 1));
    SERIES.forEach((s, i) => {
      this.chart.data.datasets[i]!.data = rows.map((r, idx) => {
        if (!r) return s.key === 'idealFPS' ? baseFPS * (idx + 1) : null;
        // Model output is always finite; guard anyway so the chart never receives NaN.
        return Number.isFinite(r[s.key]) ? r[s.key] : null;
      });
    });
    this.chart.update();
  }

  setVisible(index: number, visible: boolean): void {
    this.chart.setDatasetVisibility(index, visible);
    this.chart.update();
  }

  isVisible(index: number): boolean {
    return this.chart.isDatasetVisible(index);
  }

  /** Re-read colours from CSS custom properties (call after theme change). */
  applyTheme(): void {
    const text = css('--text-muted');
    const grid = css('--grid');
    const o = this.chart.options;
    for (const axis of [o.scales!.x!, o.scales!.y!]) {
      axis.ticks!.color = text;
      axis.border = { ...(axis.border ?? {}), color: grid };
      if (axis.grid) axis.grid.color = grid;
    }
    (o.scales!.y as { title: { color: string } }).title.color = text;
    const tt = o.plugins!.tooltip!;
    tt.backgroundColor = css('--tooltip-bg');
    tt.titleColor = css('--tooltip-fg');
    tt.bodyColor = css('--tooltip-fg');
    tt.footerColor = css('--tooltip-muted');
    tt.borderColor = grid;
    tt.borderWidth = 1;
    SERIES.forEach((s, i) => {
      const ds = this.chart.data.datasets[i]!;
      const c = css(s.cssVar);
      ds.borderColor = c;
      ds.backgroundColor = c;
      ds.pointBackgroundColor = c;
      ds.pointBorderColor = c;
    });
    this.chart.update();
  }
}
