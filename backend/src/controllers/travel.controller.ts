/**
 * @fileoverview Travel Controller (typed boundary)
 * @description Typed adapter for `travel.controller.js`. Defines exact
 * request/response interfaces, query parameters, and middleware types for
 * both the grade-based travel workflow (#1077) and the corporate travel &
 * per-diem workflow (#1209), while the existing implementation and
 * behavior are left unchanged during the incremental migration (#1403).
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

export interface TravelIdParams {
  id: string;
}

export interface ErrorResponseBody {
  message: string;
  violations?: unknown[];
  hint?: string;
}

// --- Domain documents (mirrors travel.model.js) ----------------------------

export interface TravelPolicyDocument {
  _id: unknown;
  grade: string;
  perDiemRates: Record<string, number>;
  lodgingCaps: Record<string, number>;
  cityClasses: Record<string, string[]>;
  defaultCityClass: string;
  permittedClasses: Record<string, string>;
  partDayRule: string;
  advanceCeilingPercent: number;
  currency: string;
  isActive: boolean;
}

export interface TravelLeg {
  fromCity: string;
  toCity: string;
  isInternational?: boolean;
  departureAt: string;
  returnAt: string;
  mode?: string;
  travelClass?: string;
  lodgingPerNight?: number;
}

export interface TravelRequestDocument {
  _id: unknown;
  employeeId: unknown;
  grade: string;
  purpose: string;
  legs: TravelLeg[];
  estimatedCost: number;
  advanceRequested: number;
  advanceReleased: number;
  status: string;
  policyViolations: unknown[];
}

export interface TravelSettlementDocument {
  _id: unknown;
  requestId: unknown;
  employeeId: unknown;
  actualsTotal: number;
  perDiemEntitlement: number;
  advanceAdjusted: number;
  settlementType: string;
  reimbursementAmount: number;
  recoveryAmount: number;
}

export interface PerDiemPolicyDocument {
  _id: unknown;
  cityTier: string;
  dailyAllowance: number;
  hotelLimit: number;
  isActive: boolean;
}

export interface CorporateTravelRequestDocument {
  _id: unknown;
  employeeId: unknown;
  destination: string;
  cityTier: string;
  purpose: string;
  startDate: Date;
  endDate: Date;
  durationDays: number;
  estimatedPerDiem: number;
  estimatedTravelCost: number;
  totalAdvanceRequested: number;
  status: string;
}

export interface CorporateTravelSettlementDocument {
  _id: unknown;
  requestId: unknown;
  advancePaid: number;
  actualExpenses: number;
  balance: number;
  status: string;
}

// --- Original travel: policies & requests (#1077) --------------------------

export interface UpsertPolicyBody extends Partial<
  Omit<TravelPolicyDocument, '_id'>
> {
  grade: string;
}
export interface UpsertPolicyResponseBody {
  message: string;
  policy: TravelPolicyDocument;
}
export interface GetPoliciesResponseBody {
  policies: TravelPolicyDocument[];
}

export interface CreateTravelRequestBody {
  employeeId?: string;
  purpose: string;
  legs: TravelLeg[];
  estimatedCost: number;
  advanceRequested?: number;
}
export interface CreateTravelRequestResponseBody {
  message: string;
  request: TravelRequestDocument;
  estimatedPerDiem: unknown;
  policyFound: boolean;
}

export interface GetTravelRequestsQuery {
  status?: string;
  employeeId?: string;
}
export interface GetTravelRequestsResponseBody {
  requests: TravelRequestDocument[];
}

// --- Approval, rejection, advance & settlement ------------------------------

export interface ApproveRequestBody {
  acknowledgeViolations?: boolean;
}
export interface ApproveRequestResponseBody {
  message: string;
  request: TravelRequestDocument;
  violations: unknown[];
  perDiem: unknown;
}

export interface RejectRequestBody {
  reason: string;
}
export interface RejectRequestResponseBody {
  message: string;
  request: TravelRequestDocument;
}

export interface ReleaseAdvanceBody {
  amount: number;
}
export interface ReleaseAdvanceResponseBody {
  message: string;
  request: TravelRequestDocument;
  ceiling: number;
}

export interface SettleRequestBody {
  actuals: Record<string, number>;
  payrollMonth?: number;
  payrollYear?: number;
}
export interface SettleRequestResponseBody {
  message: string;
  settlement: TravelSettlementDocument;
  perDiem: unknown;
  outcome: unknown;
}

export interface MultiCurrencySettleBody {
  expenses?: unknown[];
  forexRates?: Record<string, number>;
  receipts?: unknown[];
}
export interface MultiCurrencySettleResponseBody {
  message: string;
  settlement: TravelSettlementDocument;
  rebalanceSummary: unknown;
}

// --- Receivables & reporting -------------------------------------------

export interface OutstandingAdvancesQuery {
  asOf?: string;
}
export type OutstandingAdvancesResponseBody = unknown;

export interface GetMyTripsResponseBody {
  employee: { id: unknown; fullName: string };
  trips: TravelRequestDocument[];
  settlements: TravelSettlementDocument[];
  outstandingAdvance: number;
}

export interface TravelVarianceReportResponseBody {
  success: true;
  summary: {
    totalTripsSettled: number;
    totalAdvances: number;
    totalActuals: number;
    totalReimbursements: number;
    totalSurplusRecoveries: number;
    netCompanyVariance: number;
  };
  settlements: unknown[];
}

// --- Corporate travel & per diem (#1209) ------------------------------------

export interface GetCorporatePoliciesResponseBody {
  policies: PerDiemPolicyDocument[];
}

export interface RequestTravelBody {
  destination: string;
  cityTier: string;
  purpose: string;
  startDate: string;
  endDate: string;
  estimatedTravelCost?: number;
}
export interface RequestTravelResponseBody {
  message: string;
  request: CorporateTravelRequestDocument;
  perDiemBreakdown: unknown;
}

export interface ApproveAdvanceResponseBody {
  message: string;
  request: CorporateTravelRequestDocument;
}

export interface SubmitSettlementBody {
  requestId: string;
  expenseReceipts: Array<{
    category?: string;
    amount: number;
    description?: string;
    receiptUrl?: string;
  }>;
}
export interface SubmitSettlementResponseBody {
  message: string;
  settlement: CorporateTravelSettlementDocument;
}

export interface GetMyTravelResponseBody {
  requests: CorporateTravelRequestDocument[];
}

// --- Middleware / handler shape --------------------------------------------

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

interface TravelController {
  upsertPolicy: Handler<UpsertPolicyBody, UpsertPolicyResponseBody>;
  getPolicies: Handler<unknown, GetPoliciesResponseBody>;
  createRequest: Handler<
    CreateTravelRequestBody,
    CreateTravelRequestResponseBody
  >;
  getRequests: Handler<
    unknown,
    GetTravelRequestsResponseBody,
    Record<string, string>,
    GetTravelRequestsQuery
  >;
  approveRequest: Handler<
    ApproveRequestBody,
    ApproveRequestResponseBody,
    TravelIdParams
  >;
  rejectRequest: Handler<
    RejectRequestBody,
    RejectRequestResponseBody,
    TravelIdParams
  >;
  releaseAdvance: Handler<
    ReleaseAdvanceBody,
    ReleaseAdvanceResponseBody,
    TravelIdParams
  >;
  settleRequest: Handler<
    SettleRequestBody,
    SettleRequestResponseBody,
    TravelIdParams
  >;
  getOutstandingAdvances: Handler<
    unknown,
    OutstandingAdvancesResponseBody,
    Record<string, string>,
    OutstandingAdvancesQuery
  >;
  getMyTrips: Handler<unknown, GetMyTripsResponseBody>;
  getTravelVarianceReport: Handler<unknown, TravelVarianceReportResponseBody>;
  settleMultiCurrencyTrip: Handler<
    MultiCurrencySettleBody,
    MultiCurrencySettleResponseBody,
    TravelIdParams
  >;
  getCorporatePolicies: Handler<unknown, GetCorporatePoliciesResponseBody>;
  requestTravel: Handler<RequestTravelBody, RequestTravelResponseBody>;
  approveAdvance: Handler<unknown, ApproveAdvanceResponseBody, TravelIdParams>;
  submitSettlement: Handler<SubmitSettlementBody, SubmitSettlementResponseBody>;
  getMyTravel: Handler<unknown, GetMyTravelResponseBody>;
}

/**
 * The repository currently contains the implementation as
 * `travel.controller.js`. This boundary gives the Express API exact
 * request/response, query-parameter and middleware types while keeping the
 * existing implementation behavior unchanged during the incremental
 * migration.
 */
const legacyController = require('./travel.controller.js') as TravelController;

export const upsertPolicy = legacyController.upsertPolicy;
export const getPolicies = legacyController.getPolicies;
export const createRequest = legacyController.createRequest;
export const getRequests = legacyController.getRequests;
export const approveRequest = legacyController.approveRequest;
export const rejectRequest = legacyController.rejectRequest;
export const releaseAdvance = legacyController.releaseAdvance;
export const settleRequest = legacyController.settleRequest;
export const getOutstandingAdvances = legacyController.getOutstandingAdvances;
export const getMyTrips = legacyController.getMyTrips;
export const getTravelVarianceReport = legacyController.getTravelVarianceReport;
export const settleMultiCurrencyTrip = legacyController.settleMultiCurrencyTrip;
export const getCorporatePolicies = legacyController.getCorporatePolicies;
export const requestTravel = legacyController.requestTravel;
export const approveAdvance = legacyController.approveAdvance;
export const submitSettlement = legacyController.submitSettlement;
export const getMyTravel = legacyController.getMyTravel;

export default {
  upsertPolicy,
  getPolicies,
  createRequest,
  getRequests,
  approveRequest,
  rejectRequest,
  releaseAdvance,
  settleRequest,
  getOutstandingAdvances,
  getMyTrips,
  getTravelVarianceReport,
  settleMultiCurrencyTrip,
  getCorporatePolicies,
  requestTravel,
  approveAdvance,
  submitSettlement,
  getMyTravel,
};
