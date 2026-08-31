/**
 * Expat COLA Controller - Issue #1814
 */
'use strict';

const ExpatColaSetting = require('../models/expatColaSetting.model');
const { calculateExpatAllowances } = require('../services/expatColaCalculator.service');
const logger = require('../utils/logger');

async function previewAllowance(req, res) {
  try {
    const {
      baseMonthlySalary,
      priceIndexRatio,
      spendableIncomePercent,
      hostHousingNormMonthly,
      homeHousingNormMonthly,
      hardshipAllowancePercent,
    } = req.body;

    if (!baseMonthlySalary) {
      return res.status(400).json({ message: 'baseMonthlySalary is required.' });
    }

    const breakdown = calculateExpatAllowances({
      baseMonthlySalary: Number(baseMonthlySalary),
      priceIndexRatio: priceIndexRatio !== undefined ? Number(priceIndexRatio) : 100,
      spendableIncomePercent: spendableIncomePercent !== undefined ? Number(spendableIncomePercent) : 40,
      hostHousingNormMonthly: Number(hostHousingNormMonthly) || 0,
      homeHousingNormMonthly: Number(homeHousingNormMonthly) || 0,
      hardshipAllowancePercent: Number(hardshipAllowancePercent) || 0,
    });

    return res.json({ breakdown });
  } catch (err) {
    logger.error('previewAllowance error', { error: err.message });
    return res.status(400).json({ message: err.message });
  }
}

async function upsertSetting(req, res) {
  try {
    const {
      homeCountry,
      homeCity,
      hostCountry,
      hostCity,
      effectiveYear,
      priceIndexRatio,
      spendableIncomePercent,
      hostHousingNormMonthly,
      homeHousingNormMonthly,
      hardshipAllowancePercent,
      currencyCode,
    } = req.body;

    if (!homeCity || !hostCity || !effectiveYear || priceIndexRatio === undefined) {
      return res.status(400).json({
        message: 'homeCity, hostCity, effectiveYear, and priceIndexRatio are required.',
      });
    }

    const setting = await ExpatColaSetting.findOneAndUpdate(
      {
        homeCity,
        hostCity,
        effectiveYear: Number(effectiveYear)
      },
      {
        $set: {
          homeCountry: homeCountry || 'USA',
          hostCountry: hostCountry || 'Global',
          priceIndexRatio: Number(priceIndexRatio),
          spendableIncomePercent: spendableIncomePercent !== undefined ? Number(spendableIncomePercent) : 40,
          hostHousingNormMonthly: Number(hostHousingNormMonthly) || 0,
          homeHousingNormMonthly: Number(homeHousingNormMonthly) || 0,
          hardshipAllowancePercent: Number(hardshipAllowancePercent) || 0,
          currencyCode: currencyCode || 'USD',
          isActive: true,
        },
      },
      { upsert: true, new: true }
    );

    return res.status(201).json({ message: 'Expat COLA setting saved successfully.', setting });
  } catch (err) {
    logger.error('upsertSetting error', { error: err.message });
    return res.status(500).json({ message: 'Failed to save expat COLA setting.' });
  }
}

async function getSettings(req, res) {
  try {
    const filter = { ...{} };
    if (req.query.effectiveYear) filter.effectiveYear = req.query.effectiveYear;
    if (req.query.hostCity) filter.hostCity = req.query.hostCity;

    const settings = await ExpatColaSetting.find(filter).sort('-effectiveYear').lean();
    return res.json({ count: settings.length, settings });
  } catch (err) {
    logger.error('getSettings error', { error: err.message });
    return res.status(500).json({ message: 'Failed to fetch expat COLA settings.' });
  }
}

module.exports = {
  previewAllowance,
  upsertSetting,
  getSettings,
};