/**
 * @fileoverview Fringe Benefits Controller (TypeScript Migration)
 * @description Calculates, records, and reports on employer fringe benefits
 * and their statutory FBT (Fringe Benefit Tax) liabilities.
 * Issue: #1405
 */

import { Request, Response } from 'express';

const FringeBenefitRecord = require('../models/fringeBenefitRecord.model');
const { calculateFbtMetrics } = require('../services/fbtCalculator.service');
const { tenantFilter } = require('../utils/tenantScope');
const logger = require('../utils/logger');

export interface AuthenticatedRequest extends Request {
  userId?: string;
  tenantId?: string;
}

export type GrossUpFactorType = 'type_1_gst_credited' | 'type_2_gst_free';

export type BenefitCategory =
  | 'company_car'
  | 'housing'
  | 'club_membership'
  | 'concessional_loan'
  | 'meal_vouchers'
  | 'wellness_stipend';

export interface CalculatePreviewRequestBody {
  rawBenefitValue: number;
  employeeContribution?: number;
  grossUpFactorType?: GrossUpFactorType;
  fbtRatePercent?: number;
}

export interface RecordBenefitRequestBody {
  employeeId: string;
  benefitCategory: BenefitCategory;
  quarter: string;
  rawBenefitValue: number;
  employeeContribution?: number;
  grossUpFactorType?: GrossUpFactorType;
}

export interface GetRecordsQueryParams {
  quarter?: string;
  benefitCategory?: BenefitCategory;
  employeeId?: string;
}

export interface QuarterlySummaryQueryParams {
  quarter?: string;
}

export interface FbtMetrics {
  rawBenefitValue: number;
  employeeContribution: number;
  netTaxableBenefitValue: number;
  grossUpFactorType: GrossUpFactorType;
  grossUpMultiplier: number;
  grossedUpTaxableValue: number;
  fbtRatePercent: number;
  employerFbtLiability: number;
}

export interface CategorySummary {
  count: number;
  totalLiability: number;
}

export interface QuarterlySummary {
  quarter: string;
  totalRecords: number;
  totalRawBenefitValue: number;
  totalEmployeeContributions: number;
  totalNetTaxableValue: number;
  totalGrossedUpValue: number;
  totalEmployerFbtLiability: number;
  byCategory: Record<string, CategorySummary>;
}

/**
 * POST /api/fringe-benefits/preview
 */
export const calculatePreview = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<Response> => {
  try {
    const { rawBenefitValue, employeeContribution, grossUpFactorType, fbtRatePercent } =
      req.body as CalculatePreviewRequestBody;

    if (rawBenefitValue === undefined) {
      return res.status(400).json({ message: 'rawBenefitValue is required.' });
    }

    const metrics: FbtMetrics = calculateFbtMetrics({
      rawBenefitValue: Number(rawBenefitValue),
      employeeContribution: Number(employeeContribution) || 0,
      grossUpFactorType: grossUpFactorType || 'type_1_gst_credited',
      fbtRatePercent: fbtRatePercent !== undefined ? Number(fbtRatePercent) : 47,
    });

    return res.json({ metrics });
  } catch (err) {
    const error = err as Error;
    logger.error('calculatePreview FBT error', { error: error.message });
    return res.status(400).json({ message: error.message });
  }
};

/**
 * POST /api/fringe-benefits/records
 */
export const recordBenefit = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<Response> => {
  try {
    const {
      employeeId,
      benefitCategory,
      quarter,
      rawBenefitValue,
      employeeContribution,
      grossUpFactorType,
    } = req.body as RecordBenefitRequestBody;

    if (!employeeId || !benefitCategory || !quarter || rawBenefitValue === undefined) {
      return res.status(400).json({
        message: 'employeeId, benefitCategory, quarter, and rawBenefitValue are required.',
      });
    }

    const metrics: FbtMetrics = calculateFbtMetrics({
      rawBenefitValue: Number(rawBenefitValue),
      employeeContribution: Number(employeeContribution) || 0,
      grossUpFactorType: grossUpFactorType || 'type_1_gst_credited',
    });

    const record = await FringeBenefitRecord.create({
      tenantId: req.tenantId,
      employeeId,
      benefitCategory,
      quarter,
      rawBenefitValue: metrics.rawBenefitValue,
      employeeContribution: metrics.employeeContribution,
      netTaxableBenefitValue: metrics.netTaxableBenefitValue,
      grossUpFactorType: metrics.grossUpFactorType,
      grossUpMultiplier: metrics.grossUpMultiplier,
      grossedUpTaxableValue: metrics.grossedUpTaxableValue,
      fbtRatePercent: metrics.fbtRatePercent,
      employerFbtLiability: metrics.employerFbtLiability,
      recordedBy: req.userId,
    });

    return res.status(201).json({ message: 'Fringe benefit recorded successfully.', record });
  } catch (err) {
    const error = err as Error;
    logger.error('recordBenefit error', { error: error.message });
    return res.status(500).json({ message: 'Failed to record fringe benefit.' });
  }
};

/**
 * GET /api/fringe-benefits/records
 */
export const getRecords = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<Response> => {
  try {
    const query = req.query as GetRecordsQueryParams;
    const filter: Record<string, unknown> = { ...tenantFilter(req) };
    if (query.quarter) filter.quarter = query.quarter;
    if (query.benefitCategory) filter.benefitCategory = query.benefitCategory;
    if (query.employeeId) filter.employeeId = query.employeeId;

    const records = await FringeBenefitRecord.find(filter)
      .populate('employeeId', 'fullName email department position')
      .sort('-createdAt')
      .lean();

    return res.json({ count: records.length, records });
  } catch (err) {
    const error = err as Error;
    logger.error('getRecords FBT error', { error: error.message });
    return res.status(500).json({ message: 'Failed to fetch fringe benefit records.' });
  }
};

/**
 * GET /api/fringe-benefits/quarterly-report
 */
export const getQuarterlySummaryReport = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<Response> => {
  try {
    const { quarter } = req.query as QuarterlySummaryQueryParams;
    if (!quarter) {
      return res.status(400).json({ message: 'quarter parameter is required (e.g. 2026-Q1).' });
    }

    const records = await FringeBenefitRecord.find({
      ...tenantFilter(req),
      quarter,
    }).lean();

    const summary: QuarterlySummary = {
      quarter,
      totalRecords: records.length,
      totalRawBenefitValue: 0,
      totalEmployeeContributions: 0,
      totalNetTaxableValue: 0,
      totalGrossedUpValue: 0,
      totalEmployerFbtLiability: 0,
      byCategory: {},
    };

    for (const r of records) {
      summary.totalRawBenefitValue += r.rawBenefitValue;
      summary.totalEmployeeContributions += r.employeeContribution;
      summary.totalNetTaxableValue += r.netTaxableBenefitValue;
      summary.totalGrossedUpValue += r.grossedUpTaxableValue;
      summary.totalEmployerFbtLiability += r.employerFbtLiability;

      if (!summary.byCategory[r.benefitCategory]) {
        summary.byCategory[r.benefitCategory] = { count: 0, totalLiability: 0 };
      }
      summary.byCategory[r.benefitCategory].count += 1;
      summary.byCategory[r.benefitCategory].totalLiability += r.employerFbtLiability;
    }

    summary.totalRawBenefitValue = Math.round(summary.totalRawBenefitValue * 100) / 100;
    summary.totalGrossedUpValue = Math.round(summary.totalGrossedUpValue * 100) / 100;
    summary.totalEmployerFbtLiability = Math.round(summary.totalEmployerFbtLiability * 100) / 100;

    return res.json({ summary });
  } catch (err) {
    const error = err as Error;
    logger.error('getQuarterlySummaryReport error', { error: error.message });
    return res.status(500).json({ message: 'Failed to generate quarterly FBT summary report.' });
  }
};

module.exports = {
  calculatePreview,
  recordBenefit,
  getRecords,
  getQuarterlySummaryReport,
};