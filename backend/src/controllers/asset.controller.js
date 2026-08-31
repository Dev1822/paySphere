/**
 * @fileoverview Asset Management Controller
 * @description Handles CRUD, assignment, check-in, multi-year depreciation schedules, and scrap disposal workflows.
 */
const mongoose = require('mongoose');
const {
  Asset,
  AssetCategory,
  AssetAssignment,
} = require('../models/asset.model');
const Employee = require('../models/employee.model');
const {
  calculateMonthlyDepreciation,
  calculateDepreciationSchedule,
  calculateDisposalGainLoss,
} = require('../utils/depreciationCalculator');
const {
  buildFixedAssetRegister,
  computeImpairment,
  detectOverdueReturns,
  summarizeAssetAgeing,
  resolveDepreciationPeriod,
  shouldDepreciateForPeriod,
} = require('../utils/assetRegister');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');

/**
 * POST /api/assets/categories
 * Create a new asset category with depreciation rules.
 */
exports.createCategory = async (req, res, next) => {
  try {
    const {
      name,
      depreciationMethod,
      usefulLifeYears,
      salvageValuePercentage,
    } = req.body;
    const category = await AssetCategory.create({
      name,
      depreciationMethod,
      usefulLifeYears,
      salvageValuePercentage
    });
    res.status(201).json({ message: 'Category created', category });
  } catch (error) {
    if (error.code === 11000)
      return res.status(409).json({ message: 'Category name already exists' });
    next(error);
  }
};

/**
 * POST /api/assets
 * Procure and register a new asset.
 */
exports.createAsset = async (req, res, next) => {
  try {
    const { categoryId, name, serialNumber, purchaseDate, purchasePrice } =
      req.body;

    const category = await AssetCategory.findOne({
      _id: categoryId
    });
    if (!category)
      return res.status(404).json({ message: 'Asset category not found' });

    const asset = await Asset.create({
      categoryId,
      name,
      serialNumber,
      purchaseDate: new Date(purchaseDate),
      purchasePrice,

      // Starts at purchase price
      currentBookValue: purchasePrice
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'ASSET_PROCURED',
      resourceType: 'Asset',
      resourceIds: [asset._id],
      details: { name, serialNumber, purchasePrice },
      req,
    });

    res.status(201).json({ message: 'Asset registered successfully', asset });
  } catch (error) {
    if (error.code === 11000)
      return res
        .status(409)
        .json({ message: 'Serial number already exists for this tenant' });
    next(error);
  }
};

/**
 * GET /api/assets
 * Fetch all assets for the tenant.
 */
exports.getAssets = async (req, res, next) => {
  try {
    const assets = await Asset.find({})
      .populate('categoryId', 'name depreciationMethod usefulLifeYears')
      .populate('assignedTo', 'fullName email')
      .sort({ createdAt: -1 });

    res.status(200).json({ assets });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/assets/:id/assign
 * Assign an asset to an employee.
 */
exports.assignAsset = async (req, res, next) => {
  try {
    const { employeeId, checkoutCondition, expectedReturnDate } = req.body;
    const asset = await Asset.findOne({
      _id: req.params.id
    });

    if (!asset) return res.status(404).json({ message: 'Asset not found' });
    if (asset.status === 'Assigned')
      return res.status(400).json({ message: 'Asset is already assigned' });

    const employee = await Employee.findOne({
      _id: employeeId
    });
    if (!employee)
      return res.status(404).json({ message: 'Employee not found' });

    const assignment = await AssetAssignment.create({
      assetId: asset._id,
      employeeId,
      checkoutDate: new Date(),

      expectedReturnDate: expectedReturnDate
        ? new Date(expectedReturnDate)
        : null,

      checkoutCondition,
      isActive: true
    });

    asset.status = 'Assigned';
    asset.assignedTo = employeeId;
    await asset.save();

    res
      .status(200)
      .json({ message: 'Asset assigned successfully', asset, assignment });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/assets/:id/return
 * Check-in/Return an asset from an employee.
 */
exports.returnAsset = async (req, res, next) => {
  try {
    const { checkinCondition, damageReported, recoveryAmount } = req.body;
    const asset = await Asset.findOne({
      _id: req.params.id
    });

    if (!asset) return res.status(404).json({ message: 'Asset not found' });

    const assignment = await AssetAssignment.findOne({
      assetId: asset._id,
      isActive: true
    });

    if (!assignment)
      return res
        .status(400)
        .json({ message: 'No active assignment found for this asset' });

    // `checkinDate`, not `returnDate`. The schema declares the former and
    // Mongoose stripped the latter on every save, so `checkinDate` stayed null
    // on every returned asset and custody duration could not be computed
    // (#1156).
    assignment.checkinDate = new Date();
    assignment.checkinCondition = checkinCondition;
    assignment.damageReported = !!damageReported;
    assignment.recoveryAmount = Number(recoveryAmount) || 0;
    assignment.isActive = false;
    await assignment.save();

    asset.status = damageReported ? 'Maintenance' : 'Available';
    asset.assignedTo = null;
    asset.conditionNotes = checkinCondition;
    await asset.save();

    res
      .status(200)
      .json({ message: 'Asset returned successfully', asset, assignment });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/assets/depreciate
 * Runs monthly depreciation for all active assets.
 */
exports.runMonthlyDepreciation = async (req, res, next) => {
  try {
    // The period being charged for, so the run is idempotent. Without it every
    // call subtracted another month: a retried cron, or an admin pressing the
    // button twice, depreciated twice and the register understated net block
    // for the rest of each asset's life with nothing recording that it had
    // happened (#1156).
    const period = resolveDepreciationPeriod(req.body?.period || new Date());

    const assets = await Asset.find({
      status: { $nin: ['Retired', 'Lost'] }
    }).populate('categoryId');

    let totalDepreciation = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const asset of assets) {
      if (!asset.categoryId) continue;

      if (!shouldDepreciateForPeriod(asset, period)) {
        skippedCount++;
        continue;
      }

      const expense = calculateMonthlyDepreciation(asset, asset.categoryId);

      if (expense > 0) {
        asset.currentBookValue -= expense;
        totalDepreciation += expense;
        updatedCount++;
      }

      // Stamped whether or not a charge fell due, so a fully-depreciated asset
      // is not re-examined on every subsequent run of the same period.
      asset.lastDepreciationPeriod = period;
      await asset.save();
    }

    logger.info(
      `Monthly depreciation completed for ${period}. Updated ${updatedCount} assets, skipped ${skippedCount} already charged. Total expense: ${totalDepreciation}`,
    );

    res.status(200).json({
      message: 'Depreciation processed',
      period,
      updatedCount,
      skippedCount,
      totalDepreciation: Math.round(totalDepreciation * 100) / 100,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/assets/:id/schedule
 * Generate multi-year forecast depreciation schedule for an asset.
 */
exports.getDepreciationSchedule = async (req, res, next) => {
  try {
    const asset = await Asset.findOne({
      _id: req.params.id
    }).populate('categoryId');
    if (!asset) return res.status(404).json({ message: 'Asset not found' });

    const schedule = calculateDepreciationSchedule(
      asset,
      asset.categoryId || {},
    );

    res.status(200).json({
      success: true,
      asset: {
        id: asset._id,
        name: asset.name,
        serialNumber: asset.serialNumber,
        purchasePrice: asset.purchasePrice,
        currentBookValue: asset.currentBookValue,
        method: asset.categoryId?.depreciationMethod || 'SLM',
      },
      schedule,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/assets/:id/dispose
 * Dispose/Scrap an asset and calculate gain or loss on realization.
 */
exports.disposeAsset = async (req, res, next) => {
  try {
    const {
      saleProceeds = 0,
      disposalCost = 0,
      reason = 'Scrapped',
    } = req.body;
    const asset = await Asset.findOne({
      _id: req.params.id
    });

    if (!asset) return res.status(404).json({ message: 'Asset not found' });
    if (asset.status === 'Retired')
      return res.status(400).json({ message: 'Asset is already retired' });

    const disposal = calculateDisposalGainLoss(
      asset.currentBookValue,
      saleProceeds,
      disposalCost,
    );

    asset.status = 'Retired';
    asset.assignedTo = null;
    // Recorded so the disposal can be placed in a reporting period. The status
    // alone gave the register's disposals column no source (#1156).
    asset.disposedAt = new Date();
    asset.conditionNotes = `Disposed: ${reason}. Realized Gain/Loss: ${disposal.gainOrLoss}`;
    await asset.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'ASSET_DISPOSED',
      resourceType: 'Asset',
      resourceIds: [asset._id],
      details: {
        name: asset.name,
        bookValue: disposal.currentBookValue,
        saleProceeds: disposal.saleProceeds,
        gainOrLoss: disposal.gainOrLoss,
      },
      req,
    });

    res.status(200).json({
      message: 'Asset disposed and realization recorded',
      asset,
      disposalBreakdown: disposal,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/assets/register?startDate=&endDate=
 * The Fixed Asset Register: gross block, movements and net block by category.
 *
 * The statement an auditor asks for. Producing it before this meant exporting
 * every asset and pivoting it by hand.
 */
exports.getFixedAssetRegister = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    // Disposed assets are included in the query and excluded from the block by
    // the register itself: they still contribute to the disposals movement for
    // the period, so filtering them out here would lose that column.
    const [assets, categories] = await Promise.all([
      Asset.find({}).populate(
        'categoryId',
        'name depreciationMethod usefulLifeYears',
      ),
      AssetCategory.find({}),
    ]);

    const register = buildFixedAssetRegister(assets, categories, {
      startDate,
      endDate,
    });

    if (!register.isBalanced) {
      // A register that does not tie out is a data problem, not a rounding
      // one. Logged rather than thrown: the finance user still needs to see
      // the statement in order to work out which row is wrong.
      logger.warn('Fixed asset register does not balance', {
        tenantId: String(req.tenantId),
        netBlock: register.totals.netBlock,
        derivedNetBlock: register.derivedNetBlock,
      });
    }

    res.status(200).json({
      ...register,
      ageing: summarizeAssetAgeing(assets, endDate || new Date()),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/assets/overdue-returns
 * Assets an employee is still holding past their expected return date.
 */
exports.getOverdueReturns = async (req, res, next) => {
  try {
    const assignments = await AssetAssignment.find({
      isActive: true
    })
      .populate('assetId', 'name serialNumber purchasePrice currentBookValue')
      .populate('employeeId', 'fullName email');

    const result = detectOverdueReturns(
      assignments,
      req.query.asOf || new Date(),
    );

    // The ids the engine returns are strings; the populated documents are what
    // the caller actually wants to display, so they are joined back on here
    // rather than inside a pure function that has no business knowing about
    // Mongoose.
    const byId = new Map(assignments.map((a) => [String(a._id), a]));

    res.status(200).json({
      ...result,
      overdue: result.overdue.map((entry) => {
        const source = byId.get(entry.assignmentId);

        return {
          ...entry,
          asset: source?.assetId || null,
          employee: source?.employeeId || null,
        };
      }),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/assets/:id/impair
 * Write an asset down to its recoverable amount, or reverse a previous write-down.
 */
exports.impairAsset = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid asset id format' });
    }

    const asset = await Asset.findOne({
      _id: req.params.id
    });

    if (!asset) return res.status(404).json({ message: 'Asset not found' });

    const result = computeImpairment(asset, req.body?.recoverableAmount);

    if (!result.ok) {
      return res
        .status(400)
        .json({
          message: 'Impairment could not be applied',
          errors: result.errors,
        });
    }

    asset.currentBookValue = result.revisedCarryingValue;
    asset.accumulatedImpairment = result.accumulatedImpairment;
    asset.lastImpairmentDate = new Date();
    asset.lastRecoverableAmount = result.recoverableAmount;
    await asset.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action:
        result.impairmentLoss > 0
          ? 'ASSET_IMPAIRED'
          : 'ASSET_IMPAIRMENT_REVERSED',
      resourceType: 'Asset',
      resourceIds: [asset._id],
      details: {
        name: asset.name,
        carryingValue: result.carryingValue,
        recoverableAmount: result.recoverableAmount,
        impairmentLoss: result.impairmentLoss,
        impairmentReversal: result.impairmentReversal,
        revisedCarryingValue: result.revisedCarryingValue,
        reason: req.body?.reason || null,
      },
      req,
    });

    res.status(200).json({
      message:
        result.impairmentLoss > 0
          ? 'Asset impaired'
          : result.impairmentReversal > 0
            ? 'Impairment reversed'
            : 'No impairment adjustment required',
      asset,
      impairment: result,
    });
  } catch (error) {
    next(error);
  }
};
