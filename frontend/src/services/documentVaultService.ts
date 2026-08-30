// ──────────────────────────────────────────────────────────────────────────────
// Document Vault & E-Signature — Mock Service Layer
// ──────────────────────────────────────────────────────────────────────────────

import type {
  DocumentCategory,
  EmployeeDocument,
  ESignatureRequest,
  DocumentVaultDashboard,
  DocumentStatus,
  RequestStatus,
  SignerStatus,
} from '../types/documentVault';

const rng = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const PEOPLE = [
  { _id: 'u1', name: 'Priya Sharma', email: 'priya@paysphere.com', fullName: 'Priya Sharma', department: 'Engineering' },
  { _id: 'u2', name: 'Marcus Johnson', email: 'marcus@paysphere.com', fullName: 'Marcus Johnson', department: 'Sales' },
  { _id: 'u3', name: 'Aisha Patel', email: 'aisha@paysphere.com', fullName: 'Aisha Patel', department: 'Design' },
  { _id: 'u4', name: 'Chen Wei', email: 'chen@paysphere.com', fullName: 'Chen Wei', department: 'Operations' },
  { _id: 'u5', name: 'Sarah Kim', email: 'sarah@paysphere.com', fullName: 'Sarah Kim', department: 'HR' },
];

const CATEGORY_CONFIG = [
  { name: 'Identity Documents', description: 'Aadhaar, PAN, Passport, and government ID documents', icon: 'id-card', color: '#3b82f6', accessLevel: 'HR_ONLY' as const, retentionDays: 2555 },
  { name: 'Employment Contracts', description: 'Offer letters, employment agreements, and amendments', icon: 'briefcase', color: '#8b5cf6', accessLevel: 'MANAGER_AND_ABOVE' as const, retentionDays: 3650 },
  { name: 'Tax Documents', description: 'Form 16, tax proofs, and investment declarations', icon: 'calculator', color: '#f59e0b', accessLevel: 'HR_ONLY' as const, retentionDays: 2555 },
  { name: 'Medical Records', description: 'Health checkups, insurance claims, and medical certificates', icon: 'heart', color: '#ef4444', accessLevel: 'ADMIN_ONLY' as const, retentionDays: 1825 },
  { name: 'Performance Reviews', description: 'Appraisal forms, feedback, and PIP documents', icon: 'star', color: '#10b981', accessLevel: 'MANAGER_AND_ABOVE' as const, retentionDays: 1095 },
  { name: 'Separation Documents', description: 'Resignation letters, experience letters, and settlements', icon: 'log-out', color: '#6366f1', accessLevel: 'HR_ONLY' as const, retentionDays: 2555 },
];

const DOC_TITLES = [
  'Aadhaar Card - Front & Back',
  'PAN Card Copy',
  'Passport - Bio Page',
  'Employment Offer Letter - 2026',
  'Form 16 - FY 2025-26',
  'Medical Certificate - Annual Checkup',
  'Performance Review - Q2 2026',
  'Relief Letter - Previous Employer',
  'Address Proof - Utility Bill',
  'Degree Certificate - B.Tech',
  'Experience Letter - TechCorp',
  'NDA Agreement - Signed',
  'Investment Declaration - H1 FY27',
  'Insurance Policy - Group Health',
  'Resignation Acceptance Letter',
];

const FILE_TYPES = [
  { name: 'document.pdf', mime: 'application/pdf', size: 250000 },
  { name: 'scan.jpg', mime: 'image/jpeg', size: 1200000 },
  { name: 'form.pdf', mime: 'application/pdf', size: 180000 },
  { name: 'certificate.pdf', mime: 'application/pdf', size: 320000 },
  { name: 'contract.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 95000 },
];

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

export function generateDocumentCategories(): DocumentCategory[] {
  return CATEGORY_CONFIG.map((cat, i) => ({
    _id: `dcat-${i}`,
    tenantId: 'tenant-1',
    name: cat.name,
    description: cat.description,
    icon: cat.icon,
    color: cat.color,
    accessLevel: cat.accessLevel,
    retentionDays: cat.retentionDays,
    isActive: true,
    createdBy: 'admin-1',
    createdAt: daysAgo(120),
  }));
}

export function generateEmployeeDocuments(count = 25): EmployeeDocument[] {
  const categories = generateDocumentCategories();
  const statuses: DocumentStatus[] = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'ARCHIVED', 'EXPIRED', 'PENDING_REVIEW'];

  return Array.from({ length: count }, (_, i) => {
    const cat = pick(categories);
    const person = pick(PEOPLE);
    const fileType = pick(FILE_TYPES);
    const dayOffset = rng(5, 180);
    const status = pick(statuses);
    const hasExpiry = Math.random() > 0.6;

    return {
      _id: `doc-${i}`,
      tenantId: 'tenant-1',
      employeeId: person,
      categoryId: cat,
      title: pick(DOC_TITLES),
      description: `Uploaded document for ${person.fullName}`,
      fileName: fileType.name,
      fileUrl: `/docs/${person._id}/${fileType.name}`,
      fileSize: fileType.size + rng(-50000, 50000),
      mimeType: fileType.mime,
      fileHash: `sha256:${Array.from({ length: 16 }, () => pick('0123456789abcdef'.split(''))).join('')}`,
      version: rng(1, 3),
      uploadedBy: pick(PEOPLE.slice(0, 2)),
      isConfidential: Math.random() > 0.7,
      tags: pick([[], ['important'], ['confidential'], ['tax'], ['annual']]),
      expiryDate: hasExpiry ? new Date(Date.now() + rng(-30, 365) * 86400000).toISOString() : null,
      status,
      accessLog: Array.from({ length: rng(1, 5) }, () => ({
        accessedBy: pick(PEOPLE)._id,
        accessedAt: daysAgo(rng(1, 30)),
        action: pick(['VIEWED', 'DOWNLOADED', 'VIEWED', 'VIEWED'] as const),
      })),
      createdAt: daysAgo(dayOffset),
    };
  });
}

export function generateSignatureRequests(count = 12): ESignatureRequest[] {
  const statuses: RequestStatus[] = ['SENT', 'IN_PROGRESS', 'COMPLETED', 'DECLINED', 'EXPIRED', 'CANCELLED'];
  const signerStatuses: SignerStatus[] = ['PENDING', 'SIGNED', 'DECLINED'];

  return Array.from({ length: count }, (_, i) => {
    const doc = pick(generateEmployeeDocuments(5));
    const requester = pick(PEOPLE);
    const status = pick(statuses);
    const signerCount = rng(1, 3);
    const dayOffset = rng(3, 45);
    const isCompleted = status === 'COMPLETED';

    return {
      _id: `esign-${i}`,
      tenantId: 'tenant-1',
      documentId: { _id: doc._id, title: doc.title, fileName: doc.fileName },
      requestedBy: requester,
      title: `E-Sign: ${doc.title}`,
      message: `Please review and sign the ${doc.title} document.`,
      signers: Array.from({ length: signerCount }, (_, si) => {
        const signer = pick(PEOPLE.filter((p) => p._id !== requester._id));
        const signerStatus = isCompleted ? 'SIGNED' as const : pick(signerStatuses);
        return {
          userId: signer._id,
          name: signer.name,
          email: signer.email,
          order: si + 1,
          status: signerStatus,
          signedAt: signerStatus === 'SIGNED' ? daysAgo(dayOffset - 1) : null,
          declinedAt: signerStatus === 'DECLINED' ? daysAgo(dayOffset) : null,
          declineReason: signerStatus === 'DECLINED' ? 'Incorrect information' : '',
          ipAddress: `192.168.${rng(1, 255)}.${rng(1, 255)}`,
          signatureData: signerStatus === 'SIGNED' ? 'data:image/png;base64,mockSignature...' : null,
        };
      }),
      status,
      accessCode: Math.random() > 0.7 ? 'SIGN123' : null,
      expiresAt: new Date(Date.now() + rng(-5, 20) * 86400000).toISOString(),
      completedAt: isCompleted ? daysAgo(dayOffset - 1) : null,
      auditTrail: [
        { event: 'CREATED', actorId: requester._id, actorName: requester.name, timestamp: daysAgo(dayOffset), details: 'Request created' },
        { event: 'SENT', actorId: requester._id, actorName: requester.name, timestamp: daysAgo(dayOffset), details: 'Sent to signers' },
        ...(isCompleted ? [{ event: 'COMPLETED', actorId: null, actorName: 'System', timestamp: daysAgo(dayOffset - 1), details: 'All signatures collected', ipAddress: '' }] : []),
      ],
      createdAt: daysAgo(dayOffset),
    };
  });
}

export function generateDocumentVaultDashboard(): DocumentVaultDashboard {
  const docs = generateEmployeeDocuments(8);
  const sigs = generateSignatureRequests(5);

  return {
    totalDocuments: rng(100, 300),
    activeDocuments: rng(60, 200),
    pendingSignatures: rng(5, 15),
    completedSignatures: rng(20, 60),
    expiredDocuments: rng(2, 8),
    recentDocuments: docs,
    recentSignatures: sigs,
  };
}
