/** Trend charts: weight, MUAC and calf, MAMC, grip, prealbumin vs CRP, nitrogen balance, % intake achieved. */
import { CategoryScale, Chart as ChartJS, Legend, LinearScale, LineElement, PointElement, Tooltip } from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { StoredMeasurement } from '../../clinical/nutrition/fromRecord';
import { seriesOf } from '../../clinical/nutrition/fromRecord';
import type { Point } from '../../clinical/nutrition/monitoring';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

const COLORS = ['#059669', '#2563eb', '#d97706', '#dc2626'];
const day = (d: string) => d.slice(0, 10);

function Chart({ title, series, unit, y2 }: { title: string; series: { label: string; points: Point[]; right?: boolean }[]; unit?: string; y2?: string }) {
  const dates = [...new Set(series.flatMap(s => s.points.map(p => day(p.date))))].sort();
  if (!dates.length) return null;
  return (
    <div className="bg-white border rounded-lg p-3">
      <div className="text-sm font-medium mb-1">{title}</div>
      <Line
        data={{
          labels: dates.map(d => new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })),
          datasets: series.map((s, i) => ({
            label: s.label, yAxisID: s.right ? 'y2' : 'y', borderColor: COLORS[i % COLORS.length], backgroundColor: COLORS[i % COLORS.length],
            spanGaps: true, tension: 0.2, data: dates.map(d => s.points.filter(p => day(p.date) === d).pop()?.value ?? null),
          })),
        }}
        options={{
          responsive: true, plugins: { legend: { display: series.length > 1, position: 'bottom' } },
          scales: { y: { title: { display: !!unit, text: unit } }, ...(y2 ? { y2: { position: 'right' as const, grid: { drawOnChartArea: false }, title: { display: true, text: y2 } } } : {}) },
        }}
      />
    </div>
  );
}

export function NutritionTrends({ measurements, intakePct, nBalance }: { measurements: StoredMeasurement[]; intakePct: Point[]; nBalance: Point[] }) {
  const s = (k: string) => seriesOf(measurements, k);
  const mamc = s('muac').map(m => {
    const t = s('tsf').find(x => day(x.date) === day(m.date));
    return t ? { date: m.date, value: Math.round((m.value - Math.PI * (t.value / 10)) * 10) / 10 } : null;
  }).filter((x): x is Point => !!x);
  const charts = [
    <Chart key="w" title="Weight" unit="kg" series={[{ label: 'Weight', points: s('weight') }]} />,
    <Chart key="mc" title="MUAC and calf circumference" unit="cm" series={[{ label: 'MUAC', points: s('muac') }, { label: 'Calf', points: s('calf') }]} />,
    <Chart key="mamc" title="Mid-arm muscle circumference" unit="cm" series={[{ label: 'MAMC', points: mamc }]} />,
    <Chart key="g" title="Grip strength" unit="kg" series={[{ label: 'Grip', points: s('grip') }]} />,
    <Chart key="pc" title="Prealbumin vs CRP" unit="g/L" y2="mg/L" series={[{ label: 'Prealbumin', points: s('prealbumin') }, { label: 'CRP', points: s('crp'), right: true }]} />,
    <Chart key="n" title="Nitrogen balance" unit="g/day" series={[{ label: 'N balance', points: nBalance }]} />,
    <Chart key="i" title="Intake achieved" unit="% of energy target" series={[{ label: '% of target', points: intakePct }]} />,
  ];
  const any = measurements.length || intakePct.length;
  return any ? <div className="grid md:grid-cols-2 gap-3">{charts}</div> : <p className="text-sm text-gray-600">No measurements or intake recorded yet.</p>;
}
