export type DocumentCategory = 'LAB_REPORT' | 'PRESCRIPTION' | 'SCAN' | 'INSURANCE' | 'OTHER';
export type DocumentStatus   = 'UPLOADED' | 'PROCESSING' | 'PROCESSED' | 'FAILED';

export interface DocumentResponse {
  id:           string;
  filename:     string;
  category:     DocumentCategory;
  status:       DocumentStatus;
  mimeType:     string;
  sizeBytes:    number;
  uploadedAt:   string;
  processedAt?: string;   // null until OCR pipeline completes
}

export interface DocumentStatusResponse {
  status:           DocumentStatus;
  processedAt:      string | null;
  metricsExtracted: number;
  processingError:  string | null;
}

export interface DownloadUrlResponse {
  url:          string;
  expiryMinutes: number;
}

export interface PageResponse<T> {
  content:       T[];
  page:          number;
  size:          number;
  totalElements: number;
  totalPages:    number;
  last:          boolean;
}

export const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  'LAB_REPORT', 'PRESCRIPTION', 'SCAN', 'INSURANCE', 'OTHER'
];

export const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  LAB_REPORT:   'Lab Report',
  PRESCRIPTION: 'Prescription',
  SCAN:         'Scan / Imaging',
  INSURANCE:    'Insurance',
  OTHER:        'Other',
};

export function formatFileSize(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
