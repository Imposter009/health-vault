export type MedicationStatus = 'ACTIVE' | 'COMPLETED' | 'DISCONTINUED';

export interface MedicationResponse {
  id:                 string;
  userId:             string;
  name:               string;
  dosage:             string;
  frequency:          string;
  prescribingDoctor?: string | null;
  startDate:          string;   // ISO date (yyyy-MM-dd)
  endDate?:           string | null;
  status:             MedicationStatus;
  notes?:             string | null;
  createdAt:          string;
  updatedAt:          string;
}

export interface MedicationRequest {
  name:               string;
  dosage:             string;
  frequency:          string;
  prescribingDoctor?: string;
  startDate:          string;
  endDate?:           string;
  notes?:             string;
}

export interface MedicationUpdateRequest extends MedicationRequest {
  status: MedicationStatus;
}

export interface PageResponse<T> {
  content:       T[];
  page:          number;
  size:          number;
  totalElements: number;
  totalPages:    number;
  last:          boolean;
}

export const MEDICATION_STATUSES: MedicationStatus[] = ['ACTIVE', 'COMPLETED', 'DISCONTINUED'];

export const STATUS_LABELS: Record<MedicationStatus, string> = {
  ACTIVE:       'Active',
  COMPLETED:    'Completed',
  DISCONTINUED: 'Discontinued',
};

export const STATUS_BADGE_CLASS: Record<MedicationStatus, string> = {
  ACTIVE:       'status-badge--normal',
  COMPLETED:    'status-badge--info',
  DISCONTINUED: 'status-badge--critical',
};

/** True when the medication has an end date within the next 7 days and is still active. */
export function isExpiringSoon(m: MedicationResponse): boolean {
  if (m.status !== 'ACTIVE' || !m.endDate) return false;
  const days = (new Date(m.endDate).getTime() - Date.now()) / 86_400_000;
  return days >= 0 && days <= 7;
}
