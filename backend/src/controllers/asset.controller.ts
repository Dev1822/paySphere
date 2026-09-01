/**
 * @fileoverview Asset Management Controller (typed boundary)
 * @description Typed adapter for `asset.controller.js`. Defines exact
 * request/response interfaces, query parameters, and middleware types for
 * every asset route so the Express API boundary is type-safe, while the
 * existing implementation and behavior are left unchanged during the
 * incremental migration (#1401).
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

export interface AssetIdParams {
  id: string;
}

export type DepreciationMethod = 'SLM' | 'WDV';
export type AssetStatus =
  'Available' | 'Assigned' | 'Maintenance' | 'Retired' | 'Lost';

export interface AssetCategoryDocument {
  _id: unknown;
  name: string;
  depreciationMethod: DepreciationMethod;
  usefulLifeYears: number;
  salvageValuePercentage: number;
}

export interface AssetDocument {
  _id: unknown;
  categoryId: unknown;
  name: string;
  serialNumber: string;
  purchaseDate: Date;
  purchasePrice: number;
  currentBookValue: number;
  status: AssetStatus;
  assignedTo: unknown;
  conditionNotes?: string;
  accumulatedImpairment: number;
  lastDepreciationPeriod: string | null;
  disposedAt: Date | null;
}

export interface AssetAssignmentDocument {
  _id: unknown;
  assetId: unknown;
  employeeId: unknown;
  checkoutDate: Date;
  expectedReturnDate: Date | null;
  checkinDate: Date | null;
  checkoutCondition: string;
  checkinCondition: string | null;
  damageReported: boolean;
  recoveryAmount: number;
  isActive: boolean;
}

export interface ErrorResponseBody {
  message: string;
  errors?: string[];
}

// --- Categories & CRUD -------------------------------------------------

export interface CreateCategoryBody {
  name: string;
  depreciationMethod?: DepreciationMethod;
  usefulLifeYears: number;
  salvageValuePercentage?: number;
}
export interface CreateCategoryResponseBody {
  message: string;
  category: AssetCategoryDocument;
}

export interface CreateAssetBody {
  categoryId: string;
  name: string;
  serialNumber: string;
  purchaseDate: string;
  purchasePrice: number;
}
export interface CreateAssetResponseBody {
  message: string;
  asset: AssetDocument;
}

export interface GetAssetsResponseBody {
  assets: AssetDocument[];
}

// --- Assignment & check-in ----------------------------------------------

export interface AssignAssetBody {
  employeeId: string;
  checkoutCondition?: string;
  expectedReturnDate?: string;
}
export interface ReturnAssetBody {
  checkinCondition?: string;
  damageReported?: boolean;
  recoveryAmount?: number;
}
export interface AssignmentResponseBody {
  message: string;
  asset: AssetDocument;
  assignment: AssetAssignmentDocument;
}

// --- Depreciation ---------------------------------------------------------

export interface RunDepreciationBody {
  period?: string;
}
export interface RunDepreciationResponseBody {
  message: string;
  period: string;
  updatedCount: number;
  skippedCount: number;
  totalDepreciation: number;
}

export interface DepreciationScheduleEntry {
  year: number;
  openingBookValue: number;
  depreciationExpense: number;
  closingBookValue: number;
  [key: string]: unknown;
}
export interface GetDepreciationScheduleResponseBody {
  success: true;
  asset: {
    id: unknown;
    name: string;
    serialNumber: string;
    purchasePrice: number;
    currentBookValue: number;
    method: DepreciationMethod;
  };
  schedule: DepreciationScheduleEntry[];
}

// --- Disposal ---------------------------------------------------------

export interface DisposeAssetBody {
  saleProceeds?: number;
  disposalCost?: number;
  reason?: string;
}
export interface DisposalBreakdown {
  currentBookValue: number;
  saleProceeds: number;
  disposalCost: number;
  netProceeds: number;
  gainOrLoss: number;
  isGain: boolean;
}
export interface DisposeAssetResponseBody {
  message: string;
  asset: AssetDocument;
  disposalBreakdown: DisposalBreakdown;
}

// --- Register, ageing & overdue reporting ---------------------------------

export interface FixedAssetRegisterQuery {
  startDate?: string;
  endDate?: string;
}
export interface FixedAssetRegisterCategoryRow {
  categoryId: string | null;
  categoryName: string;
  depreciationMethod: DepreciationMethod;
  assetCount: number;
  grossBlock: number;
  additions: number;
  disposals: number;
  accumulatedDepreciation: number;
  accumulatedImpairment: number;
  netBlock: number;
  disposedCount: number;
}
export interface FixedAssetRegisterResponseBody {
  period: { startDate: string | null; endDate: string | null };
  categories: FixedAssetRegisterCategoryRow[];
  totals: Omit<
    FixedAssetRegisterCategoryRow,
    'categoryId' | 'categoryName' | 'depreciationMethod'
  >;
  derivedNetBlock: number;
  isBalanced: boolean;
  ageing: {
    asOf: string;
    assetCount: number;
    totalNetBlock: number;
    bands: Array<{ band: string; count: number; netBlockPercent: number }>;
  };
}

export interface OverdueReturnsQuery {
  asOf?: string;
}
export interface OverdueReturnEntry {
  assignmentId: string | null;
  daysOverdue: number;
  ageingBand: string;
  asset: unknown;
  employee: unknown;
}
export interface OverdueReturnsResponseBody {
  asOf: string;
  activeCount: number;
  openEndedCount: number;
  overdueCount: number;
  byBand: Array<{ band: string; count: number }>;
  overdue: OverdueReturnEntry[];
}

// --- Impairment -------------------------------------------------------

export interface ImpairAssetBody {
  recoverableAmount: number;
  reason?: string;
}
export interface ImpairmentResult {
  ok: boolean;
  errors: string[];
  impairmentLoss?: number;
  impairmentReversal?: number;
  revisedCarryingValue?: number;
  accumulatedImpairment?: number;
  isImpaired?: boolean;
}
export interface ImpairAssetResponseBody {
  message: string;
  asset: AssetDocument;
  impairment: ImpairmentResult;
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

interface AssetController {
  createCategory: Handler<CreateCategoryBody, CreateCategoryResponseBody>;
  createAsset: Handler<CreateAssetBody, CreateAssetResponseBody>;
  getAssets: Handler<unknown, GetAssetsResponseBody>;
  assignAsset: Handler<AssignAssetBody, AssignmentResponseBody, AssetIdParams>;
  returnAsset: Handler<ReturnAssetBody, AssignmentResponseBody, AssetIdParams>;
  runMonthlyDepreciation: Handler<
    RunDepreciationBody,
    RunDepreciationResponseBody
  >;
  getDepreciationSchedule: Handler<
    unknown,
    GetDepreciationScheduleResponseBody,
    AssetIdParams
  >;
  disposeAsset: Handler<
    DisposeAssetBody,
    DisposeAssetResponseBody,
    AssetIdParams
  >;
  getFixedAssetRegister: Handler<
    unknown,
    FixedAssetRegisterResponseBody,
    Record<string, string>,
    FixedAssetRegisterQuery
  >;
  getOverdueReturns: Handler<
    unknown,
    OverdueReturnsResponseBody,
    Record<string, string>,
    OverdueReturnsQuery
  >;
  impairAsset: Handler<ImpairAssetBody, ImpairAssetResponseBody, AssetIdParams>;
}

/**
 * The repository currently contains the implementation as
 * `asset.controller.js`. This boundary gives the Express API exact
 * request/response, query-parameter and middleware types while keeping the
 * existing implementation behavior unchanged during the incremental
 * migration.
 */
const legacyController = require('./asset.controller.js') as AssetController;

export const createCategory = legacyController.createCategory;
export const createAsset = legacyController.createAsset;
export const getAssets = legacyController.getAssets;
export const assignAsset = legacyController.assignAsset;
export const returnAsset = legacyController.returnAsset;
export const runMonthlyDepreciation = legacyController.runMonthlyDepreciation;
export const getDepreciationSchedule = legacyController.getDepreciationSchedule;
export const disposeAsset = legacyController.disposeAsset;
export const getFixedAssetRegister = legacyController.getFixedAssetRegister;
export const getOverdueReturns = legacyController.getOverdueReturns;
export const impairAsset = legacyController.impairAsset;

export default {
  createCategory,
  createAsset,
  getAssets,
  assignAsset,
  returnAsset,
  runMonthlyDepreciation,
  getDepreciationSchedule,
  disposeAsset,
  getFixedAssetRegister,
  getOverdueReturns,
  impairAsset,
};
