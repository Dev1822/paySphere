/**
 * @fileoverview Handover Controller (typed boundary)
 * @description Typed adapter for `handover.controller.js`. Defines exact
 * request/response interfaces, query parameters, and middleware types for
 * every handover route so the Express API boundary is type-safe, while the
 * existing implementation and behavior are left unchanged during the
 * incremental migration (#1326).
 */
import type { NextFunction, Request, Response } from 'express';

/** Populated by `auth.middleware` and `rbac.middleware` before the handler runs. */
export interface TenantRequest<
  Params = Record<string, string>,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = Record<string, string | undefined>,
> extends Request<Params, ResBody, ReqBody, ReqQuery> {
  userId?: string;
  tenantId?: string;
}

// --- Common Types ---

export interface KnowledgeTransferItem {
  _id: unknown;
  title: string;
  description?: string;
  category: 'Code Repository' | 'Client Contact' | 'Process Document' | 'Credentials' | 'Other';
  link?: string;
  attachmentUrl?: string;
  isMandatory?: boolean;
  isCompleted?: boolean;
  completedAt?: Date | null;
}

export interface AssetRecoveryItem {
  _id: unknown;
  assetName: string;
  assetTag?: string;
  condition: 'Pending Return' | 'Returned Good' | 'Returned Damaged' | 'Lost';
  recoveryNotes?: string;
  recoveredAt?: Date | null;
  payrollDeduction?: number;
}

export interface AccessRevocationItem {
  _id: unknown;
  systemName: string;
  accessLevel?: string;
  isRevoked?: boolean;
  revokedAt?: Date | null;
  revokedBy?: unknown;
}

export interface HandoverPlanDocument {
  _id: unknown;
  tenantId: unknown;
  employeeId: unknown;
  exitDate: Date;
  knowledgeTransfers: KnowledgeTransferItem[];
  assetRecoveries: AssetRecoveryItem[];
  accessRevocations: AccessRevocationItem[];
  employeeSignOff?: boolean;
  employeeSignOffDate?: Date | null;
  managerSignOff?: boolean;
  managerSignOffDate?: Date | null;
  managerRemarks?: string;
  itSignOff?: boolean;
  itSignOffDate?: Date | null;
  clearanceScore?: number;
  status: 'In Progress' | 'Pending Manager Review' | 'Pending IT Review' | 'Cleared' | 'Blocked';
  isFnFBlocked?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ErrorResponseBody {
  message: string;
  errors?: string[];
}

// --- Handlers Request / Response Body Types ---

// initiateHandover
export interface InitiateHandoverBody {
  employeeId: string;
  exitDate: string;
}
export interface InitiateHandoverResponse {
  message: string;
  plan: HandoverPlanDocument;
}

// updateKnowledgeTransfer
export interface UpdateKnowledgeTransferBody {
  planId: string;
  ktId: string;
  isCompleted?: boolean;
  link?: string;
  attachmentUrl?: string;
}
export interface UpdateKnowledgeTransferResponse {
  message: string;
  plan: HandoverPlanDocument;
}

// updateAssetRecovery
export interface UpdateAssetRecoveryBody {
  planId: string;
  assetId: string;
  condition: 'Pending Return' | 'Returned Good' | 'Returned Damaged' | 'Lost';
  recoveryNotes?: string;
  payrollDeduction?: number;
}
export interface UpdateAssetRecoveryResponse {
  message: string;
  plan: HandoverPlanDocument;
}

// revokeAccess
export interface RevokeAccessBody {
  planId: string;
  accessId: string;
}
export interface RevokeAccessResponse {
  message: string;
  plan: HandoverPlanDocument;
}

// managerSignOff
export interface ManagerSignOffBody {
  planId: string;
  remarks?: string;
}
export interface ManagerSignOffResponse {
  message: string;
  plan: HandoverPlanDocument;
}

// getMyHandover
export interface GetMyHandoverResponse {
  plan: HandoverPlanDocument | null;
}

// checkFnFEligibility
export interface CheckFnFParams {
  employeeId: string;
}
export interface CheckFnFEligibilityResponse {
  isEligible: boolean;
  reason: string;
  clearanceScore?: number;
}

// getAssetDeductionSummary
export interface GetAssetDeductionsParams {
  planId: string;
}
export interface GetAssetDeductionSummaryResponse {
  planId: unknown;
  employeeId: unknown;
  hasDeductions: boolean;
  totalDeductions: number;
  breakdown: Array<{
    assetName: string;
    condition: string;
    deductionAmount: number;
  }>;
}

// generateClearanceCertificate
export interface GenerateCertificateParams {
  planId: string;
}
export interface ClearanceCertificate {
  certificateNumber: string;
  employeeId: unknown;
  employeeName: string;
  department: string;
  exitDate: Date;
  clearanceScore: number;
  issuedAt: Date;
  verifiedBy: string;
}
export interface GenerateClearanceCertificateResponse {
  message: string;
  certificate: ClearanceCertificate;
}

// --- Controller Handler Type ---

type Handler<
  ReqBody = unknown,
  ResBody = unknown,
  Params = Record<string, string>,
  ReqQuery = Record<string, string | undefined>,
> = (
  req: TenantRequest<Params, ResBody, ReqBody, ReqQuery>,
  res: Response<ResBody | ErrorResponseBody>,
  next: NextFunction,
) => Promise<unknown> | unknown;

export interface HandoverController {
  initiateHandover: Handler<InitiateHandoverBody, InitiateHandoverResponse>;
  updateKnowledgeTransfer: Handler<UpdateKnowledgeTransferBody, UpdateKnowledgeTransferResponse>;
  updateAssetRecovery: Handler<UpdateAssetRecoveryBody, UpdateAssetRecoveryResponse>;
  revokeAccess: Handler<RevokeAccessBody, RevokeAccessResponse>;
  managerSignOff: Handler<ManagerSignOffBody, ManagerSignOffResponse>;
  getMyHandover: Handler<unknown, GetMyHandoverResponse>;
  checkFnFEligibility: Handler<unknown, CheckFnFEligibilityResponse, CheckFnFParams>;
  getAssetDeductionSummary: Handler<unknown, GetAssetDeductionSummaryResponse, GetAssetDeductionsParams>;
  generateClearanceCertificate: Handler<unknown, GenerateClearanceCertificateResponse, GenerateCertificateParams>;
}

const legacyController = require('./handover.controller.js') as HandoverController;

export const initiateHandover = legacyController.initiateHandover;
export const updateKnowledgeTransfer = legacyController.updateKnowledgeTransfer;
export const updateAssetRecovery = legacyController.updateAssetRecovery;
export const revokeAccess = legacyController.revokeAccess;
export const managerSignOff = legacyController.managerSignOff;
export const getMyHandover = legacyController.getMyHandover;
export const checkFnFEligibility = legacyController.checkFnFEligibility;
export const getAssetDeductionSummary = legacyController.getAssetDeductionSummary;
export const generateClearanceCertificate = legacyController.generateClearanceCertificate;

export default {
  initiateHandover,
  updateKnowledgeTransfer,
  updateAssetRecovery,
  revokeAccess,
  managerSignOff,
  getMyHandover,
  checkFnFEligibility,
  getAssetDeductionSummary,
  generateClearanceCertificate,
};
