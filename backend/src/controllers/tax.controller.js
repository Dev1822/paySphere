const taxService = require('../services/taxService');
const asyncHandler = require('../middlewares/asyncHandler.middleware');

exports.getJurisdictions = asyncHandler(async (req, res) => {
    const data = await taxService.getJurisdictions(req.query);
    res.status(200).json({ success: true, count: data.length, data });
});

exports.getObligations = asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, ...filters } = req.query;
    const result = await taxService.getObligations(page, limit, filters);
    res.status(200).json({ success: true, ...result });
});

exports.getRiskTopology = asyncHandler(async (req, res) => {
    const data = await taxService.calculateRiskTopology();
    res.status(200).json({ success: true, count: data.length, data });
});

exports.seedTaxData = asyncHandler(async (req, res) => {
    const result = await taxService.seedMockData();
    res.status(201).json({ success: true, ...result });
});
