/**
 * @fileoverview Asset Management Controller
 * @description Handles CRUD, assignment, check-in, multi-year depreciation schedules, and scrap disposal workflows.
 */
const mongoose = require('mongoose');
const { Asset, AssetCategory, AssetAssignment } = require('../models/asset.model');
const Employee = require('../models/employee.model');
const {
  calculateMonthlyDepreciation,
  calculateDepreciationSchedule,
  calculateDisposalGainLoss,
} = require('../utils/depreciationCalculator');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');

/**
 * POST /api/assets/categories
 * Create a new asset category with depreciation rules.
 */
exports.createCategory = async (req, res, next) => {
  try {
    const { name, depreciationMethod, usefulLifeYears, salvageValuePercentage } = req.body;
    const category = await AssetCategory.create({
      tenantId: req.tenantId,
      name,
      depreciationMethod,
      usefulLifeYears,
      salvageValuePercentage,
    });
    res.status(201).json({ message: 'Category created', category });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'Category name already exists' });
    next(error);
  }
};

/**
 * POST /api/assets
 * Procure and register a new asset.
 */
exports.createAsset = async (req, res, next) => {
  try {
    const { categoryId, name, serialNumber, purchaseDate, purchasePrice } = req.body;

    const category = await AssetCategory.findOne({ _id: categoryId, tenantId: req.tenantId });
    if (!category) return res.status(404).json({ message: 'Asset category not found' });

    const asset = await Asset.create({
      tenantId: req.tenantId,
      categoryId,
      name,
      serialNumber,
      purchaseDate: new Date(purchaseDate),
      purchasePrice,
      currentBookValue: purchasePrice, // Starts at purchase price
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
    if (error.code === 11000) return res.status(409).json({ message: 'Serial number already exists for this tenant' });
    next(error);
  }
};

/**
 * GET /api/assets
 * Fetch all assets for the tenant.
 */
exports.getAssets = async (req, res, next) => {
  try {
    const assets = await Asset.find({ tenantId: req.tenantId })
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
    const asset = await Asset.findOne({ _id: req.params.id, tenantId: req.tenantId });

    if (!asset) return res.status(404).json({ message: 'Asset not found' });
    if (asset.status === 'Assigned') return res.status(400).json({ message: 'Asset is already assigned' });

    const employee = await Employee.findOne({ _id: employeeId, tenantId: req.tenantId });
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const assignment = await AssetAssignment.create({
      tenantId: req.tenantId,
      assetId: asset._id,
      employeeId,
      checkoutDate: new Date(),
      expectedReturnDate: expectedReturnDate ? new Date(expectedReturnDate) : null,
      checkoutCondition,
      isActive: true,
    });

    asset.status = 'Assigned';
    asset.assignedTo = employeeId;
    await asset.save();

    res.status(200).json({ message: 'Asset assigned successfully', asset, assignment });
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
    const asset = await Asset.findOne({ _id: req.params.id, tenantId: req.tenantId });

    if (!asset) return res.status(404).json({ message: 'Asset not found' });

    const assignment = await AssetAssignment.findOne({
      assetId: asset._id,
      tenantId: req.tenantId,
      isActive: true,
    });

    if (!assignment) return res.status(400).json({ message: 'No active assignment found for this asset' });

    assignment.returnDate = new Date();
    assignment.checkinCondition = checkinCondition;
    assignment.damageReported = !!damageReported;
    assignment.recoveryAmount = Number(recoveryAmount) || 0;
    assignment.isActive = false;
    await assignment.save();

    asset.status = damageReported ? 'Maintenance' : 'Available';
    asset.assignedTo = null;
    asset.conditionNotes = checkinCondition;
    await asset.save();

    res.status(200).json({ message: 'Asset returned successfully', asset, assignment });
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
    const assets = await Asset.find({
      tenantId: req.tenantId,
      status: { $nin: ['Retired', 'Lost'] },
    }).populate('categoryId');

    let totalDepreciation = 0;
    let updatedCount = 0;

    for (const asset of assets) {
      if (!asset.categoryId) continue;

      const expense = calculateMonthlyDepreciation(asset, asset.categoryId);
      if (expense > 0) {
        asset.currentBookValue -= expense;
        await asset.save();
        totalDepreciation += expense;
        updatedCount++;
      }
    }

    logger.info(`Monthly depreciation completed. Updated ${updatedCount} assets. Total expense: ₹${totalDepreciation}`);
    res.status(200).json({ message: 'Depreciation processed', updatedCount, totalDepreciation });
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
    const asset = await Asset.findOne({ _id: req.params.id, tenantId: req.tenantId }).populate('categoryId');
    if (!asset) return res.status(404).json({ message: 'Asset not found' });

    const schedule = calculateDepreciationSchedule(asset, asset.categoryId || {});

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
    const { saleProceeds = 0, disposalCost = 0, reason = 'Scrapped' } = req.body;
    const asset = await Asset.findOne({ _id: req.params.id, tenantId: req.tenantId });

    if (!asset) return res.status(404).json({ message: 'Asset not found' });
    if (asset.status === 'Retired') return res.status(400).json({ message: 'Asset is already retired' });

    const disposal = calculateDisposalGainLoss(asset.currentBookValue, saleProceeds, disposalCost);

    asset.status = 'Retired';
    asset.assignedTo = null;
    asset.conditionNotes = `Disposed: ${reason}. Realized Gain/Loss: ₹${disposal.gainOrLoss}`;
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
