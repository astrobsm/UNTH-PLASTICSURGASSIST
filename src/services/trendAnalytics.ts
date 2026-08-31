/**
 * Vital Signs Trend Analytics & Abnormal Value Alert Service
 *
 * Provides:
 * - Time-series trend analysis (vitals, labs, fluid balance)
 * - Abnormal value detection with configurable thresholds
 * - Early Warning Score (NEWS2-inspired) calculation
 * - Trend direction detection (improving/worsening/stable)
 * - Alert generation for critical and warning values
 * - Fluid balance cumulative tracking
 */

import {
  validateVitals,
  
  VITAL_RANGES_EXPORT,
  
  
} from './medicalValidation';

// ────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────

export interface VitalTrendPoint {
  date: string;
  time?: string;
  temperature?: number;
  pulse?: number;
  bp_systolic?: number;
  bp_diastolic?: number;
  respiratory_rate?: number;
  spo2?: number;
  weight?: number;
  pain_score?: number;
  urine_output?: number;
  blood_sugar?: number;
}

export interface TrendAnalysis {
  parameter: string;
  direction: 'improving' | 'worsening' | 'stable' | 'fluctuating' | 'insufficient_data';
  changeRate: number;  // units per hour
  changePct: number;
  latest: number;
  min: number;
  max: number;
  mean: number;
  dataPoints: number;
  normalRange: { low: number; high: number; unit: string };
}

export interface EarlyWarningScore {
  totalScore: number;
  category: 'low' | 'medium' | 'high' | 'critical';
  components: Record<string, { value: number; score: number }>;
  recommendation: string;
  assessedAt: string;
}

export interface ClinicalAlert {
  id: string;
  patientId: string;
  parameter: string;
  severity: 'info' | 'warning' | 'critical' | 'emergency';
  message: string;
  value: number;
  normalRange: string;
  timestamp: string;
  acknowledged: boolean;
}

export interface FluidBalanceSummary {
  totalIntake: number;
  totalOutput: number;
  netBalance: number;
  hourlyRate: { intake: number; output: number };
  urineOutputPerKg?: number;
  status: 'balanced' | 'positive' | 'negative' | 'critically_positive' | 'critically_negative';
  alerts: string[];
}

// ────────────────────────────────────────────────────────────
// TREND ANALYSIS
// ────────────────────────────────────────────────────────────

/** Analyze trend for a single vital parameter across time-series data */
export function analyzeTrend(
  dataPoints: VitalTrendPoint[],
  parameter: keyof VitalTrendPoint
): TrendAnalysis {
  const range = VITAL_RANGES_EXPORT[parameter as string];
  const values = dataPoints
    .filter(p => p[parameter] != null)
    .map(p => ({
      value: p[parameter] as number,
      date: p.date,
    }));

  if (values.length < 2) {
    return {
      parameter: parameter as string,
      direction: 'insufficient_data',
      changeRate: 0,
      changePct: 0,
      latest: values[0]?.value ?? 0,
      min: values[0]?.value ?? 0,
      max: values[0]?.value ?? 0,
      mean: values[0]?.value ?? 0,
      dataPoints: values.length,
      normalRange: range ? { low: range.normal_low, high: range.normal_high, unit: range.unit } : { low: 0, high: 0, unit: '' },
    };
  }

  const nums = values.map(v => v.value);
  const latest = nums[nums.length - 1];
  const first = nums[0];
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;

  // Time span in hours
  const firstDate = new Date(values[0].date);
  const lastDate = new Date(values[values.length - 1].date);
  const hours = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60));

  const changeRate = (latest - first) / hours;
  const changePct = first !== 0 ? ((latest - first) / first) * 100 : 0;

  // Determine direction using linear regression slope
  const n = nums.length;
  const xMean = (n - 1) / 2;
  const yMean = mean;
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (nums[i] - yMean);
    denominator += (i - xMean) ** 2;
  }
  const slope = denominator !== 0 ? numerator / denominator : 0;

  // Check for fluctuation (high coefficient of variation)
  const stdDev = Math.sqrt(nums.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n);
  const cv = mean !== 0 ? stdDev / Math.abs(mean) : 0;

  let direction: TrendAnalysis['direction'];
  if (cv > 0.15 && Math.abs(slope) / Math.abs(mean || 1) < 0.02) {
    direction = 'fluctuating';
  } else if (Math.abs(slope) / Math.abs(mean || 1) < 0.005) {
    direction = 'stable';
  } else {
    // "Improving" depends on whether the parameter should go up or down
    const isHighBad = range ? latest > range.normal_high : false;
    const isLowBad = range ? latest < range.normal_low : false;

    if (isHighBad) {
      direction = slope < 0 ? 'improving' : 'worsening';
    } else if (isLowBad) {
      direction = slope > 0 ? 'improving' : 'worsening';
    } else {
      direction = 'stable';
    }
  }

  return {
    parameter: parameter as string,
    direction,
    changeRate: parseFloat(changeRate.toFixed(3)),
    changePct: parseFloat(changePct.toFixed(1)),
    latest,
    min,
    max,
    mean: parseFloat(mean.toFixed(1)),
    dataPoints: values.length,
    normalRange: range ? { low: range.normal_low, high: range.normal_high, unit: range.unit } : { low: 0, high: 0, unit: '' },
  };
}

/** Analyze all vital parameter trends for a patient */
export function analyzeAllVitalTrends(dataPoints: VitalTrendPoint[]): TrendAnalysis[] {
  const parameters: (keyof VitalTrendPoint)[] = [
    'temperature', 'pulse', 'bp_systolic', 'bp_diastolic',
    'respiratory_rate', 'spo2', 'weight', 'pain_score',
  ];

  return parameters
    .map(p => analyzeTrend(dataPoints, p))
    .filter(t => t.dataPoints >= 1);
}

// ────────────────────────────────────────────────────────────
// EARLY WARNING SCORE (NEWS2-inspired for Nigerian context)
// ────────────────────────────────────────────────────────────

/** Calculate National Early Warning Score from latest vitals */
export function calculateEWS(vitals: VitalTrendPoint): EarlyWarningScore {
  const components: Record<string, { value: number; score: number }> = {};
  let total = 0;

  // Respiratory Rate
  if (vitals.respiratory_rate != null) {
    const rr = vitals.respiratory_rate;
    let score = 0;
    if (rr <= 8) score = 3;
    else if (rr <= 11) score = 1;
    else if (rr <= 20) score = 0;
    else if (rr <= 24) score = 2;
    else score = 3;
    components.respiratory_rate = { value: rr, score };
    total += score;
  }

  // SpO2
  if (vitals.spo2 != null) {
    const spo2 = vitals.spo2;
    let score = 0;
    if (spo2 <= 91) score = 3;
    else if (spo2 <= 93) score = 2;
    else if (spo2 <= 95) score = 1;
    else score = 0;
    components.spo2 = { value: spo2, score };
    total += score;
  }

  // Temperature
  if (vitals.temperature != null) {
    const temp = vitals.temperature;
    let score = 0;
    if (temp <= 35.0) score = 3;
    else if (temp <= 36.0) score = 1;
    else if (temp <= 38.0) score = 0;
    else if (temp <= 39.0) score = 1;
    else score = 2;
    components.temperature = { value: temp, score };
    total += score;
  }

  // Systolic BP
  if (vitals.bp_systolic != null) {
    const sbp = vitals.bp_systolic;
    let score = 0;
    if (sbp <= 90) score = 3;
    else if (sbp <= 100) score = 2;
    else if (sbp <= 110) score = 1;
    else if (sbp <= 219) score = 0;
    else score = 3;
    components.bp_systolic = { value: sbp, score };
    total += score;
  }

  // Heart Rate / Pulse
  if (vitals.pulse != null) {
    const hr = vitals.pulse;
    let score = 0;
    if (hr <= 40) score = 3;
    else if (hr <= 50) score = 1;
    else if (hr <= 90) score = 0;
    else if (hr <= 110) score = 1;
    else if (hr <= 130) score = 2;
    else score = 3;
    components.pulse = { value: hr, score };
    total += score;
  }

  let category: EarlyWarningScore['category'];
  let recommendation: string;

  if (total >= 7) {
    category = 'critical';
    recommendation = 'URGENT: Immediate senior review required. Consider ICU/HDU. Continuous monitoring.';
  } else if (total >= 5) {
    category = 'high';
    recommendation = 'Urgent response: Senior clinician review within 30 minutes. Increase monitoring frequency to at least hourly.';
  } else if (total >= 3) {
    category = 'medium';
    recommendation = 'Increase monitoring to at least 4-hourly. Inform registrar. Consider escalation.';
  } else {
    category = 'low';
    recommendation = 'Continue routine monitoring (minimum 12-hourly). Routine clinical care.';
  }

  return {
    totalScore: total,
    category,
    components,
    recommendation,
    assessedAt: new Date().toISOString(),
  };
}

// ────────────────────────────────────────────────────────────
// ALERT GENERATION
// ────────────────────────────────────────────────────────────

/** Generate alerts from an array of vital sign readings */
export function generateAlerts(
  patientId: string,
  readings: VitalTrendPoint[]
): ClinicalAlert[] {
  const alerts: ClinicalAlert[] = [];

  for (const reading of readings) {
    const validated = validateVitals(reading);

    for (const alert of validated.alerts) {
      alerts.push({
        id: `${patientId}-${alert.parameter}-${reading.date}`,
        patientId,
        parameter: alert.parameter,
        severity: alert.severity === 'critical' ? 'critical' : 'warning',
        message: alert.message,
        value: alert.value,
        normalRange: alert.range,
        timestamp: reading.date,
        acknowledged: false,
      });
    }

    // EWS-based alerts
    const ews = calculateEWS(reading);
    if (ews.category === 'critical') {
      alerts.push({
        id: `${patientId}-ews-critical-${reading.date}`,
        patientId,
        parameter: 'Early Warning Score',
        severity: 'emergency',
        message: `NEWS score ${ews.totalScore}: ${ews.recommendation}`,
        value: ews.totalScore,
        normalRange: '0–4 (low risk)',
        timestamp: reading.date,
        acknowledged: false,
      });
    } else if (ews.category === 'high') {
      alerts.push({
        id: `${patientId}-ews-high-${reading.date}`,
        patientId,
        parameter: 'Early Warning Score',
        severity: 'critical',
        message: `NEWS score ${ews.totalScore}: ${ews.recommendation}`,
        value: ews.totalScore,
        normalRange: '0–4 (low risk)',
        timestamp: reading.date,
        acknowledged: false,
      });
    }
  }

  // Trend-based alerts (only if enough data)
  if (readings.length >= 3) {
    const trends = analyzeAllVitalTrends(readings);
    for (const trend of trends) {
      if (trend.direction === 'worsening') {
        alerts.push({
          id: `${patientId}-trend-${trend.parameter}-${Date.now()}`,
          patientId,
          parameter: trend.parameter,
          severity: 'warning',
          message: `${trend.parameter.replace(/_/g, ' ')} trending ${trend.direction}: ${trend.changePct > 0 ? '+' : ''}${trend.changePct}% over ${trend.dataPoints} readings`,
          value: trend.latest,
          normalRange: `${trend.normalRange.low}–${trend.normalRange.high} ${trend.normalRange.unit}`,
          timestamp: new Date().toISOString(),
          acknowledged: false,
        });
      }
    }
  }

  return alerts;
}

// ────────────────────────────────────────────────────────────
// FLUID BALANCE TRACKING
// ────────────────────────────────────────────────────────────

export interface FluidEntry {
  type: 'input' | 'output';
  volume_ml: number;
  fluid_type: string;
  route?: string;
  recorded_at: string;
}

/** Calculate fluid balance summary from entries */
export function calculateFluidBalance(
  entries: FluidEntry[],
  weightKg?: number
): FluidBalanceSummary {
  const alerts: string[] = [];

  const intakes = entries.filter(e => e.type === 'input');
  const outputs = entries.filter(e => e.type === 'output');

  const totalIntake = intakes.reduce((sum, e) => sum + e.volume_ml, 0);
  const totalOutput = outputs.reduce((sum, e) => sum + e.volume_ml, 0);
  const netBalance = totalIntake - totalOutput;

  // Calculate hourly rates
  let hours = 24; // default
  if (entries.length >= 2) {
    const dates = entries.map(e => new Date(e.recorded_at).getTime()).filter(t => !isNaN(t));
    if (dates.length >= 2) {
      const span = Math.max(...dates) - Math.min(...dates);
      hours = Math.max(1, span / (1000 * 60 * 60));
    }
  }

  const hourlyIntake = totalIntake / hours;
  const hourlyOutput = totalOutput / hours;

  // Urine output per kg per hour
  const urineEntries = outputs.filter(e =>
    /urine|uop|u\/o/i.test(e.fluid_type)
  );
  const totalUrine = urineEntries.reduce((sum, e) => sum + e.volume_ml, 0);
  const urineOutputPerKg = weightKg ? totalUrine / hours / weightKg : undefined;

  // Fluid status assessment
  let status: FluidBalanceSummary['status'];
  if (Math.abs(netBalance) < 500) {
    status = 'balanced';
  } else if (netBalance > 2000) {
    status = 'critically_positive';
    alerts.push(`Critically positive fluid balance: +${netBalance}ml. Risk of fluid overload.`);
  } else if (netBalance > 500) {
    status = 'positive';
    alerts.push(`Positive fluid balance: +${netBalance}ml.`);
  } else if (netBalance < -1500) {
    status = 'critically_negative';
    alerts.push(`Critically negative fluid balance: ${netBalance}ml. Risk of dehydration/hypovolemia.`);
  } else {
    status = 'negative';
    alerts.push(`Negative fluid balance: ${netBalance}ml.`);
  }

  // Urine output alerts
  if (urineOutputPerKg != null) {
    if (urineOutputPerKg < 0.5) {
      alerts.push(`Oliguria: Urine output ${urineOutputPerKg.toFixed(2)} ml/kg/hr (< 0.5). Monitor renal function.`);
    }
  }

  // Low total output alert
  if (hours >= 6 && totalOutput < 100) {
    alerts.push(`Very low urine output over ${Math.round(hours)} hours. Consider catheter check and fluid challenge.`);
  }

  return {
    totalIntake,
    totalOutput,
    netBalance,
    hourlyRate: {
      intake: parseFloat(hourlyIntake.toFixed(1)),
      output: parseFloat(hourlyOutput.toFixed(1)),
    },
    urineOutputPerKg: urineOutputPerKg ? parseFloat(urineOutputPerKg.toFixed(2)) : undefined,
    status,
    alerts,
  };
}

// ────────────────────────────────────────────────────────────
// CHART DATA FORMATTER (for visualization)
// ────────────────────────────────────────────────────────────

export interface ChartDataSet {
  label: string;
  data: Array<{ x: string; y: number }>;
  normalRange?: { low: number; high: number };
  unit: string;
  color: string;
}

const PARAMETER_COLORS: Record<string, string> = {
  temperature: '#EF4444',     // red
  pulse: '#F59E0B',           // amber
  bp_systolic: '#3B82F6',     // blue
  bp_diastolic: '#60A5FA',    // light blue
  respiratory_rate: '#10B981',// green
  spo2: '#8B5CF6',            // purple
  weight: '#6B7280',          // gray
  pain_score: '#DC2626',      // dark red
};

/** Format vital sign data for chart rendering */
export function formatVitalsForChart(readings: VitalTrendPoint[]): ChartDataSet[] {
  const datasets: ChartDataSet[] = [];
  const parameters = ['temperature', 'pulse', 'bp_systolic', 'bp_diastolic', 'respiratory_rate', 'spo2'] as const;

  for (const param of parameters) {
    const data = readings
      .filter(r => r[param] != null)
      .map(r => ({ x: r.date, y: r[param] as number }));

    if (data.length === 0) continue;

    const range = VITAL_RANGES_EXPORT[param];
    datasets.push({
      label: param.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      data,
      normalRange: range ? { low: range.normal_low, high: range.normal_high } : undefined,
      unit: range?.unit || '',
      color: PARAMETER_COLORS[param] || '#6B7280',
    });
  }

  return datasets;
}
