import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { WoundProgressEntry, WoundProgressReport } from '../services/aiWoundMeasurement';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

interface WoundProgressChartProps {
  measurements: WoundProgressEntry[];
  report?: WoundProgressReport | null;
}

const WoundProgressChart: React.FC<WoundProgressChartProps> = ({ measurements, report }) => {
  const sorted = useMemo(
    () => [...measurements].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [measurements]
  );

  const chartData = useMemo(() => {
    const labels = sorted.map(m => {
      const d = new Date(m.date);
      return `${d.getDate()}/${d.getMonth() + 1}`;
    });
    return {
      labels,
      datasets: [
        {
          label: 'Area (cm²)',
          data: sorted.map(m => m.area),
          borderColor: '#DC2626',
          backgroundColor: 'rgba(220, 38, 38, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 5,
          pointBackgroundColor: '#DC2626',
        },
        {
          label: 'Length (cm)',
          data: sorted.map(m => m.length),
          borderColor: '#0E9F6E',
          backgroundColor: 'rgba(14, 159, 110, 0.05)',
          fill: false,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: '#0E9F6E',
          borderDash: [5, 3],
        },
        {
          label: 'Width (cm)',
          data: sorted.map(m => m.width),
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59, 130, 246, 0.05)',
          fill: false,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: '#3B82F6',
          borderDash: [5, 3],
        },
      ],
    };
  }, [sorted]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const, labels: { usePointStyle: true, padding: 12 } },
      title: { display: true, text: 'Wound Healing Progress', font: { size: 14, weight: 'bold' as const }, color: '#1F2937' },
      tooltip: {
        callbacks: {
          label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) =>
            `${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(2) ?? 'N/A'}`,
        },
      },
    },
    scales: {
      x: { title: { display: true, text: 'Date' }, grid: { display: false } },
      y: { title: { display: true, text: 'Size (cm / cm²)' }, beginAtZero: true },
    },
  }), []);

  if (sorted.length < 2) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-500 text-sm">
        At least 2 assessments needed for progress chart.
      </div>
    );
  }

  const trendColor = report?.trend === 'improving' ? 'text-green-600 bg-green-50' : report?.trend === 'worsening' ? 'text-red-600 bg-red-50' : 'text-yellow-600 bg-yellow-50';
  const trendIcon = report?.trend === 'improving' ? '↓' : report?.trend === 'worsening' ? '↑' : '→';

  return (
    <div className="space-y-3">
      {/* Chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-3" style={{ height: 280 }}>
        <Line data={chartData} options={options} />
      </div>

      {/* Summary cards */}
      {report && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className={`rounded-lg px-3 py-2 ${trendColor}`}>
            <div className="text-xs font-medium">Trend</div>
            <div className="text-lg font-bold">{trendIcon} {report.trend}</div>
          </div>
          <div className="rounded-lg px-3 py-2 bg-gray-50">
            <div className="text-xs font-medium text-gray-500">Area Change</div>
            <div className="text-lg font-bold text-gray-800">{report.percentageChange > 0 ? '-' : '+'}{Math.abs(report.percentageChange)}%</div>
          </div>
          <div className="rounded-lg px-3 py-2 bg-gray-50">
            <div className="text-xs font-medium text-gray-500">Healing Rate</div>
            <div className="text-lg font-bold text-gray-800">{report.averageHealingRate.toFixed(2)} cm²/d</div>
          </div>
          {report.estimatedHealingTime && (
            <div className="rounded-lg px-3 py-2 bg-blue-50">
              <div className="text-xs font-medium text-blue-600">Est. Healing</div>
              <div className="text-lg font-bold text-blue-800">~{report.estimatedHealingTime}d</div>
            </div>
          )}
        </div>
      )}

      {/* Recommendations */}
      {report && report.recommendations.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <h4 className="text-sm font-semibold text-gray-700 mb-1">Recommendations</h4>
          <ul className="text-xs text-gray-600 space-y-0.5">
            {report.recommendations.map((r, i) => (
              <li key={i}>• {r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default WoundProgressChart;
