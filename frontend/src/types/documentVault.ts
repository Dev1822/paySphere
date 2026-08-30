// ──────────────────────────────────────────────────────────────────────────────
// Document Vault & E-Signature — TypeScript Interfaces
// ──────────────────────────────────────────────────────────────────────────────

export type AccessLevel = 'EMPLOYEE_ONLY' | 'HR_ONLY' | 'ADMIN_ONLY' | 'MANAGER_AND_ABOVE';
export type DocumentStatus = 'ACTIVE' | 'ARCHIVED' | 'EXPIRED' | 'PENDING_REVIEW';
export type SignerStatus = 'PENDING' | 'SIGNED' | 'DECLINED' | 'EXPIRED';
export type RequestStatus = 'DRAFT' | 'SENT' | 'IN_PROGRESS' | 'COMPLETED' | 'DECLINED' | 'EXPIRED' | 'CANCELLED';

export interface DocumentCategory {
  _id: string;
  tenantId: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  accessLevel: AccessLevel;
  retentionDays: number;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
}

export interface EmployeeDocument {
  _id: string;
  tenantId: string;
  employeeId: { _id: string; fullName: string; department?: string } | string;
  categoryId: DocumentCategory;
  title: string;
  description: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  fileHash: string | null;
  version: number;
  uploadedBy: { _id: string; name: string; email: string };
  isConfidential: boolean;
  tags: string[];
  expiryDate: string | null;
  status: DocumentStatus;
  accessLog: Array<{
    accessedBy: string;
    accessedAt: string;
    action: 'VIEWED' | 'DOWNLOADED' | 'UPDATED' | 'DELETED';
  }>;
  createdAt: string;
}

export interface Signer {
  userId: string;
  name: string;
  email: string;
  order: number;
  status: SignerStatus;
  signedAt: string | null;
  declinedAt: string | null;
  declineReason: string;
  ipAddress: string;
  signatureData: string | null;
}

export interface AuditEntry {
  event: string;
  actorId: string | null;
  actorName: string;
  timestamp: string;
  details: string;
  ipAddress: string;
}

export interface ESignatureRequest {
  _id: string;
  tenantId: string;
  documentId: { _id: string; title: string; fileName: string } | string;
  requestedBy: { _id: string; name: string; email: string } | string;
  title: string;
  message: string;
  signers: Signer[];
  status: RequestStatus;
  accessCode: string | null;
  expiresAt: string;
  completedAt: string | null;
  auditTrail: AuditEntry[];
  createdAt: string;
}

export interface DocumentVaultDashboard {
  totalDocuments: number;
  activeDocuments: number;
  pendingSignatures: number;
  completedSignatures: number;
  expiredDocuments: number;
  recentDocuments: EmployeeDocument[];
  recentSignatures: ESignatureRequest[];
}
