const RetroactiveAdjustment = require('../models/retroactiveAdjustment.model');
const { calculateRetroactiveArrears } = require('../services/retroCalculator.service');

exports.calculateArrears = async (req, res, next) => {
  try {
    const { employeeId, effectiveDate, newStructureId, referenceId } = req.body;
    const tenantId = req.tenantId;
    const userId = req.userId;

    if (!employeeId || !effectiveDate || !newStructureId) {
      return res.status(400).json({ error: 'employeeId, effectiveDate, and newStructureId are required' });
    }

    const { calculatedArrears, totalArrears, totalTaxLiability } = await calculateRetroactiveArrears(
      tenantId,
      employeeId,
      effectiveDate,
      newStructureId
    );

    // Save pending retroactive adjustment record
    const adjustment = new RetroactiveAdjustment({
      tenantId,
      employeeId,
      effectiveDate,
      originalStructureId: newStructureId, // Will resolve automatically
      newStructureId,
      referenceId: referenceId || '',
      calculatedArrears,
      totalArrears,
      totalTaxLiability,
      status: 'PENDING',
      createdBy: userId,
    });

    await adjustment.save();

    res.status(200).json({
      message: 'Retroactive arrears calculated successfully',
      adjustmentId: adjustment._id,
      calculatedArrears,
      totalArrears,
      totalTaxLiability,
    });
  } catch (error) {
    next(error);
  }
};

exports.approveAdjustment = async (req, res, next) => {
  try {
    const { id } = req.body;
    const tenantId = req.tenantId;

    const adjustment = await RetroactiveAdjustment.findOne({ _id: id || req.params.id, tenantId });
    if (!adjustment) {
      return res.status(404).json({ error: 'Retroactive adjustment record not found' });
    }

    if (adjustment.status !== 'PENDING') {
      return res.status(400).json({ error: `Cannot approve adjustment in ${adjustment.status} state` });
    }

    adjustment.status = 'APPROVED';
    await adjustment.save();

    res.status(200).json({
      message: 'Retroactive adjustment approved and queued for next payroll run',
      adjustment,
    });
  } catch (error) {
    next(error);
  }
};
