'use strict';
const { getMonthlyVariance, getAnnualForecast } = require('../services/varianceReport.service');
const Budget = require('../models/budget.model');

async function monthlyVariance(req, res) {
  const tenantId = requireTenant(req);
  const year  = parseInt(req.query.year,  10) || new Date().getFullYear();
  const month = parseInt(req.query.month, 10) || (new Date().getMonth() + 1);
  if (month < 1 || month > 12) return res.status(400).json({ message: 'month must be 1-12.' });
  const data = await getMonthlyVariance(tenantId, year, month);
  return res.json(data);
}

async function annualForecast(req, res) {
  const tenantId = requireTenant(req);
  const year = parseInt(req.query.year, 10) || new Date().getFullYear();
  const data = await getAnnualForecast(tenantId, year);
  return res.json({ year, forecast: data });
}

async function setBudget(req, res) {
  const tenantId = requireTenant(req);
  const { department, year, month, budgetedGross } = req.body;
  if (!department || !year || !month || budgetedGross == null) {
    return res.status(400).json({ message: 'department, year, month, and budgetedGross are required.' });
  }
  const budget = await Budget.findOneAndUpdate(
    { tenantId, department, year: Number(year), month: Number(month) },
    { budgetedGross: Number(budgetedGross), createdBy: req.userId },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  );
  return res.status(201).json(budget);
}

async function listBudgets(req, res) {
  const tenantId = requireTenant(req);
  const filter = { tenantId };
  if (req.query.year)       filter.year       = Number(req.query.year);
  if (req.query.department) filter.department = req.query.department;
  const budgets = await Budget.find(filter).sort({ year: 1, month: 1 }).lean();
  return res.json({ budgets });
}

module.exports = { monthlyVariance, annualForecast, setBudget, listBudgets };