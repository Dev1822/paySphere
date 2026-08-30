export type AuditLogSeverity = 'INFO' | 'WARNING' | 'CRITICAL' | 'ERROR';

export type AuditLogCategory = 
  | 'AUTHENTICATION'
  | 'USER_MANAGEMENT'
  | 'PAYMENT_PROCESSING'
  | 'SECURITY_SETTINGS'
  | 'SYSTEM_CONFIG'
  | 'API_ACCESS';

export interface AuditLogActor {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: string;
}

export interface AuditLogResource {
  id: string;
  type: string;
  name: string;
}

export interface AuditLogMetadata {
  ipAddress: string;
  userAgent: string;
  location?: {
    city?: string;
    country?: string;
    timezone?: string;
  };
  additionalData?: Record<string, any>;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  category: AuditLogCategory;
  severity: AuditLogSeverity;
  status: 'SUCCESS' | 'FAILURE' | 'PENDING';
  actor: AuditLogActor;
  resource: AuditLogResource;
  metadata: AuditLogMetadata;
  description: string;
}

export interface AuditLogFilterOptions {
  searchTerm?: string;
  categories?: AuditLogCategory[];
  severities?: AuditLogSeverity[];
  dateRange?: {
    start: string;
    end: string;
  };
  status?: ('SUCCESS' | 'FAILURE' | 'PENDING')[];
}
