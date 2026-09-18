// Tree-shaken ECharts build: only the pieces the dashboard uses.
import * as echarts from 'echarts/core';
import { BarChart, LineChart, MapChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapPiecewiseComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  BarChart,
  LineChart,
  MapChart,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapPiecewiseComponent,
  CanvasRenderer,
]);

export { echarts };

/** Creates a chart that follows the size of its container. */
export function createChart(el: HTMLElement): echarts.ECharts {
  const chart = echarts.init(el, undefined, { renderer: 'canvas' });
  new ResizeObserver(() => chart.resize()).observe(el);
  return chart;
}
