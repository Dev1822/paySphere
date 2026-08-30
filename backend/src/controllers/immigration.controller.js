const immigrationService = require('../services/immigrationService');
const asyncHandler = require('../middlewares/asyncHandler.middleware');

exports.getWorkers = asyncHandler(async (req, res) => {
    const data = await immigrationService.getWorkers(req.query);
    res.status(200).json({ success: true, count: data.length, data });
});

exports.getSponsorships = asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, ...filters } = req.query;
    const result = await immigrationService.getSponsorships(page, limit, filters);
    res.status(200).json({ success: true, ...result });
});

exports.getRiskChart = asyncHandler(async (req, res) => {
    const data = await immigrationService.calculateImmigrationRisk();
    res.status(200).json({ success: true, count: data.length, data });
});

exports.seedImmigrationData = asyncHandler(async (req, res) => {
    const result = await immigrationService.seedMockData();
    res.status(201).json({ success: true, ...result });
});
