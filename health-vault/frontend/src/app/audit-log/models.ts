export type AuditAction =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'LOGOUT'
  | 'REGISTER'
  | 'DOCUMENT_UPLOADED'
  | 'DOCUMENT_VIEWED'
  | 'DOCUMENT_DOWNLOADED'
  | 'DOCUMENT_DELETED'
  | 'METRIC_CREATED'
  | 'METRIC_UPDATED'
  | 'METRIC_DELETED';

export type AuditResourceType = 'DOCUMENT' | 'HEALTH_METRIC' | 'USER';

export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  resourceType: AuditResourceType | null;
  resourceId: string | null;
  ipAddress: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;  // ISO-8601
}

export interface PagedAuditLog {
  content: AuditLogEntry[];
  totalElements: number;
  totalPages: number;
  number: number;       // current page (0-indexed)
  size: number;
}

export interface AuditLogFilter {
  action?: AuditAction;
  from?: string;    // ISO-8601 date
  to?: string;      // ISO-8601 date
  page?: number;
  size?: number;
}

export const ACTION_LABELS: Record<AuditAction, string> = {
  LOGIN_SUCCESS:       'Signed in',
  LOGIN_FAILURE:       'Failed sign-in attempt',
  LOGOUT:              'Signed out',
  REGISTER:            'Account created',
  DOCUMENT_UPLOADED:   'Document uploaded',
  DOCUMENT_VIEWED:     'Document viewed',
  DOCUMENT_DOWNLOADED: 'Document downloaded',
  DOCUMENT_DELETED:    'Document deleted',
  METRIC_CREATED:      'Health metric added',
  METRIC_UPDATED:      'Health metric updated',
  METRIC_DELETED:      'Health metric deleted',
};

export const ACTION_CATEGORIES: Record<AuditAction, 'auth' | 'document' | 'metric'> = {
  LOGIN_SUCCESS:       'auth',
  LOGIN_FAILURE:       'auth',
  LOGOUT:              'auth',
  REGISTER:            'auth',
  DOCUMENT_UPLOADED:   'document',
  DOCUMENT_VIEWED:     'document',
  DOCUMENT_DOWNLOADED: 'document',
  DOCUMENT_DELETED:    'document',
  METRIC_CREATED:      'metric',
  METRIC_UPDATED:      'metric',
  METRIC_DELETED:      'metric',
};
