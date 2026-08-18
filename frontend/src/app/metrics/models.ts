export type MetricType = 'BLOOD_PRESSURE' | 'BLOOD_SUGAR' | 'WEIGHT' | 'WORKOUT' | 'HEART_RATE';
export type MetricSource = 'MANUAL' | 'DEVICE_SYNC' | 'EXTRACTED_FROM_DOCUMENT';
export type DashboardGranularity = 'DAY' | 'WEEK' | 'MONTH';

export interface BloodPressureValue  { systolic: number; diastolic: number; }
export interface BloodSugarValue     { mgPerDl: number; context: 'FASTING' | 'POST_MEAL' | 'RANDOM'; }
export interface WeightValue         { kg: number; }
export interface WorkoutValue        { type: string; durationMinutes: number; intensity: 'LOW' | 'MODERATE' | 'HIGH'; }
export interface HeartRateValue      { bpm: number; }

export type MetricValue = BloodPressureValue | BloodSugarValue | WeightValue | WorkoutValue | HeartRateValue;

export interface MetricResponse {
  id: string;
  userId: string;
  metricType: MetricType;
  value: Record<string, unknown>;
  recordedAt: string;
  source: MetricSource;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MetricRequest {
  metricType: MetricType;
  value: Record<string, unknown>;
  recordedAt: string;
  notes?: string;
}

export interface MetricUpdateRequest {
  value: Record<string, unknown>;
  recordedAt: string;
  notes?: string;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export interface DashboardBucket {
  bucketStart: string;
  avg: number | null;
  min: number | null;
  max: number | null;
  avgSystolic: number | null;
  avgDiastolic: number | null;
  minSystolic: number | null;
  maxSystolic: number | null;
  totalDurationMinutes: number | null;
  count: number;
}

export interface DashboardResponse {
  metricType: MetricType;
  from: string;
  to: string;
  granularity: DashboardGranularity;
  buckets: DashboardBucket[];
}

export function formatValue(type: MetricType, value: Record<string, unknown>): string {
  switch (type) {
    case 'BLOOD_PRESSURE': return `${value['systolic']}/${value['diastolic']} mmHg`;
    case 'BLOOD_SUGAR':    return `${value['mgPerDl']} mg/dL (${value['context']})`;
    case 'WEIGHT':         return `${value['kg']} kg`;
    case 'WORKOUT':        return `${value['type']} · ${value['durationMinutes']} min · ${value['intensity']}`;
    case 'HEART_RATE':     return `${value['bpm']} bpm`;
    default:               return JSON.stringify(value);
  }
}
