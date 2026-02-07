/**
 * Transfusion Vitals Chart Component
 * Displays a visual chart of vital signs during blood transfusion monitoring
 */

import React from 'react';
import { TransfusionVitals } from '../services/bloodTransfusionService';
import { format } from 'date-fns';

interface VitalsChartData {
  label: string;
  time: Date;
  vitals: TransfusionVitals;
}

interface TransfusionVitalsChartProps {
  preVitals?: TransfusionVitals;
  duringVitals?: TransfusionVitals[];
  postVitals?: TransfusionVitals;
}

// Color palette for different vital signs
const VITAL_COLORS = {
  temperature: '#DC2626', // Red
  pulse: '#F59E0B', // Orange/Amber
  bp_systolic: '#10B981', // Green
  bp_diastolic: '#34D399', // Light Green
  respiratory_rate: '#3B82F6', // Blue
  spo2: '#8B5CF6' // Purple
};

// Normal ranges for vital signs
const NORMAL_RANGES = {
  temperature: { min: 36.0, max: 37.5, unit: '°C' },
  pulse: { min: 60, max: 100, unit: 'bpm' },
  bp_systolic: { min: 100, max: 140, unit: 'mmHg' },
  bp_diastolic: { min: 60, max: 90, unit: 'mmHg' },
  respiratory_rate: { min: 12, max: 20, unit: '/min' },
  spo2: { min: 95, max: 100, unit: '%' }
};

export default function TransfusionVitalsChart({
  preVitals,
  duringVitals = [],
  postVitals
}: TransfusionVitalsChartProps) {
  // Collect all vitals data points
  const dataPoints: VitalsChartData[] = [];
  
  if (preVitals) {
    dataPoints.push({
      label: 'Pre',
      time: preVitals.recorded_at ? new Date(preVitals.recorded_at) : new Date(),
      vitals: preVitals
    });
  }
  
  duringVitals.forEach((v, i) => {
    dataPoints.push({
      label: `During ${i + 1}`,
      time: v.recorded_at ? new Date(v.recorded_at) : new Date(),
      vitals: v
    });
  });
  
  if (postVitals) {
    dataPoints.push({
      label: 'Post',
      time: postVitals.recorded_at ? new Date(postVitals.recorded_at) : new Date(),
      vitals: postVitals
    });
  }

  if (dataPoints.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-500">No vitals recorded yet. Record pre-transfusion vitals to see the chart.</p>
      </div>
    );
  }

  // Chart dimensions
  const chartWidth = 600;
  const chartHeight = 250;
  const padding = { top: 20, right: 30, bottom: 60, left: 50 };
  const graphWidth = chartWidth - padding.left - padding.right;
  const graphHeight = chartHeight - padding.top - padding.bottom;

  // Calculate scales
  const xStep = graphWidth / Math.max(dataPoints.length - 1, 1);

  // Helper to normalize a value within a given range to 0-1
  const normalize = (value: number, min: number, max: number): number => {
    return (value - min) / (max - min);
  };

  // Get Y position for a vital sign value
  const getY = (value: number, vitalType: keyof typeof NORMAL_RANGES): number => {
    const range = NORMAL_RANGES[vitalType];
    // Add some buffer to the range for display
    const displayMin = range.min - (range.max - range.min) * 0.2;
    const displayMax = range.max + (range.max - range.min) * 0.2;
    const normalized = normalize(value, displayMin, displayMax);
    return chartHeight - padding.bottom - (normalized * graphHeight);
  };

  // Generate path for a vital sign
  const generatePath = (vitalKey: keyof TransfusionVitals): string => {
    if (vitalKey === 'recorded_by' || vitalKey === 'recorded_at') return '';
    
    const points = dataPoints.map((dp, i) => {
      const x = padding.left + (i * xStep);
      const value = dp.vitals[vitalKey] as number;
      const y = getY(value, vitalKey as keyof typeof NORMAL_RANGES);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
    
    return points;
  };

  // Check if a value is in normal range
  const isNormal = (value: number, vitalType: keyof typeof NORMAL_RANGES): boolean => {
    const range = NORMAL_RANGES[vitalType];
    return value >= range.min && value <= range.max;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h4 className="font-semibold text-gray-900 mb-4">Vitals Trend Chart</h4>
      
      {/* Chart */}
      <div className="overflow-x-auto">
        <svg width={chartWidth} height={chartHeight} className="mx-auto">
          {/* Background grid */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect 
            x={padding.left} 
            y={padding.top} 
            width={graphWidth} 
            height={graphHeight} 
            fill="url(#grid)" 
          />
          
          {/* Normal range bands (shown for key vitals) */}
          <rect
            x={padding.left}
            y={getY(NORMAL_RANGES.pulse.max, 'pulse')}
            width={graphWidth}
            height={getY(NORMAL_RANGES.pulse.min, 'pulse') - getY(NORMAL_RANGES.pulse.max, 'pulse')}
            fill="#FEF3C7"
            opacity={0.3}
          />
          
          {/* Lines for each vital sign */}
          {/* Temperature */}
          <path
            d={generatePath('temperature')}
            fill="none"
            stroke={VITAL_COLORS.temperature}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Pulse */}
          <path
            d={generatePath('pulse')}
            fill="none"
            stroke={VITAL_COLORS.pulse}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* BP Systolic */}
          <path
            d={generatePath('bp_systolic')}
            fill="none"
            stroke={VITAL_COLORS.bp_systolic}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* BP Diastolic */}
          <path
            d={generatePath('bp_diastolic')}
            fill="none"
            stroke={VITAL_COLORS.bp_diastolic}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="5,3"
          />
          
          {/* SpO2 */}
          <path
            d={generatePath('spo2')}
            fill="none"
            stroke={VITAL_COLORS.spo2}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Data points */}
          {dataPoints.map((dp, i) => {
            const x = padding.left + (i * xStep);
            return (
              <g key={i}>
                {/* Temperature point */}
                <circle
                  cx={x}
                  cy={getY(dp.vitals.temperature, 'temperature')}
                  r={4}
                  fill={isNormal(dp.vitals.temperature, 'temperature') ? VITAL_COLORS.temperature : '#DC2626'}
                  stroke="white"
                  strokeWidth={2}
                />
                {/* Pulse point */}
                <circle
                  cx={x}
                  cy={getY(dp.vitals.pulse, 'pulse')}
                  r={4}
                  fill={isNormal(dp.vitals.pulse, 'pulse') ? VITAL_COLORS.pulse : '#DC2626'}
                  stroke="white"
                  strokeWidth={2}
                />
                {/* BP Systolic point */}
                <circle
                  cx={x}
                  cy={getY(dp.vitals.bp_systolic, 'bp_systolic')}
                  r={4}
                  fill={isNormal(dp.vitals.bp_systolic, 'bp_systolic') ? VITAL_COLORS.bp_systolic : '#DC2626'}
                  stroke="white"
                  strokeWidth={2}
                />
                {/* SpO2 point */}
                <circle
                  cx={x}
                  cy={getY(dp.vitals.spo2, 'spo2')}
                  r={4}
                  fill={isNormal(dp.vitals.spo2, 'spo2') ? VITAL_COLORS.spo2 : '#DC2626'}
                  stroke="white"
                  strokeWidth={2}
                />
                
                {/* X-axis label */}
                <text
                  x={x}
                  y={chartHeight - padding.bottom + 15}
                  textAnchor="middle"
                  className="text-xs fill-gray-600"
                  fontSize={10}
                >
                  {dp.label}
                </text>
                <text
                  x={x}
                  y={chartHeight - padding.bottom + 28}
                  textAnchor="middle"
                  className="text-xs fill-gray-400"
                  fontSize={8}
                >
                  {dp.vitals.recorded_at ? format(new Date(dp.vitals.recorded_at), 'HH:mm') : '-'}
                </text>
              </g>
            );
          })}
          
          {/* Y-axis */}
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={chartHeight - padding.bottom}
            stroke="#374151"
            strokeWidth={1}
          />
          
          {/* X-axis */}
          <line
            x1={padding.left}
            y1={chartHeight - padding.bottom}
            x2={chartWidth - padding.right}
            y2={chartHeight - padding.bottom}
            stroke="#374151"
            strokeWidth={1}
          />
        </svg>
      </div>
      
      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4 justify-center text-sm">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: VITAL_COLORS.temperature }}></span>
          <span>Temp (°C)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: VITAL_COLORS.pulse }}></span>
          <span>Pulse (bpm)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: VITAL_COLORS.bp_systolic }}></span>
          <span>BP Sys</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: VITAL_COLORS.bp_diastolic }}></span>
          <span>BP Dia</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: VITAL_COLORS.spo2 }}></span>
          <span>SpO₂ (%)</span>
        </div>
      </div>
      
      {/* Vitals Table */}
      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-200 px-3 py-2 text-left font-medium">Timing</th>
              <th className="border border-gray-200 px-3 py-2 text-center font-medium">Temp °C</th>
              <th className="border border-gray-200 px-3 py-2 text-center font-medium">Pulse</th>
              <th className="border border-gray-200 px-3 py-2 text-center font-medium">BP</th>
              <th className="border border-gray-200 px-3 py-2 text-center font-medium">RR</th>
              <th className="border border-gray-200 px-3 py-2 text-center font-medium">SpO₂</th>
              <th className="border border-gray-200 px-3 py-2 text-center font-medium">Time</th>
            </tr>
          </thead>
          <tbody>
            {dataPoints.map((dp, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="border border-gray-200 px-3 py-2 font-medium">{dp.label}</td>
                <td className={`border border-gray-200 px-3 py-2 text-center ${
                  !isNormal(dp.vitals.temperature, 'temperature') ? 'text-red-600 font-bold' : ''
                }`}>
                  {dp.vitals.temperature}
                </td>
                <td className={`border border-gray-200 px-3 py-2 text-center ${
                  !isNormal(dp.vitals.pulse, 'pulse') ? 'text-red-600 font-bold' : ''
                }`}>
                  {dp.vitals.pulse}
                </td>
                <td className={`border border-gray-200 px-3 py-2 text-center ${
                  !isNormal(dp.vitals.bp_systolic, 'bp_systolic') || !isNormal(dp.vitals.bp_diastolic, 'bp_diastolic') 
                    ? 'text-red-600 font-bold' : ''
                }`}>
                  {dp.vitals.bp_systolic}/{dp.vitals.bp_diastolic}
                </td>
                <td className={`border border-gray-200 px-3 py-2 text-center ${
                  !isNormal(dp.vitals.respiratory_rate, 'respiratory_rate') ? 'text-red-600 font-bold' : ''
                }`}>
                  {dp.vitals.respiratory_rate}
                </td>
                <td className={`border border-gray-200 px-3 py-2 text-center ${
                  !isNormal(dp.vitals.spo2, 'spo2') ? 'text-red-600 font-bold' : ''
                }`}>
                  {dp.vitals.spo2}%
                </td>
                <td className="border border-gray-200 px-3 py-2 text-center text-gray-500">
                  {dp.vitals.recorded_at ? format(new Date(dp.vitals.recorded_at), 'HH:mm') : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Normal Ranges Reference */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <h5 className="font-medium text-gray-700 mb-2">Normal Ranges</h5>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-gray-600">
          <span>Temperature: 36.0 - 37.5°C</span>
          <span>Pulse: 60 - 100 bpm</span>
          <span>BP: 100-140 / 60-90 mmHg</span>
          <span>Resp Rate: 12 - 20/min</span>
          <span>SpO₂: 95 - 100%</span>
        </div>
        <p className="text-xs text-red-600 mt-2">* Values outside normal range are highlighted in red</p>
      </div>
    </div>
  );
}
