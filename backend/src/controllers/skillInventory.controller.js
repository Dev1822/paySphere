const SkillInventoryService = require('../services/skillInventory.service');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

exports.createTaxonomy = catchAsync(async (req, res, next) => {
  const skill = await SkillInventoryService.createSkillTaxonomy(
    req.body,
    req.tenantId,
    req.userId,
  );
  res.status(201).json({
    status: 'success',
    data: { skill },
  });
});

exports.getTaxonomy = catchAsync(async (req, res, next) => {
  const skills = await SkillInventoryService.getSkillTaxonomy(req.tenantId);
  res.status(200).json({
    status: 'success',
    results: skills.length,
    data: { skills },
  });
});

exports.addEmployeeSkill = catchAsync(async (req, res, next) => {
  const employeeId = req.params.employeeId;
  const skill = await SkillInventoryService.addEmployeeSkill(
    employeeId,
    req.body,
    req.tenantId,
    req.userId,
  );
  res.status(201).json({
    status: 'success',
    data: { skill },
  });
});

exports.endorseSkill = catchAsync(async (req, res, next) => {
  const skillId = req.params.skillId;
  const skill = await SkillInventoryService.endorseEmployeeSkill(
    skillId,
    req.tenantId,
    req.userId,
  );

  if (!skill) {
    return next(new AppError('Skill not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: { skill },
  });
});

exports.getTeamMatrix = catchAsync(async (req, res, next) => {
  // Use the currently logged-in user as the manager
  // In a real implementation, you might pass managerId or resolve it via employee records
  const matrix = await SkillInventoryService.getTeamSkillMatrix(
    req.employeeId,
    req.tenantId,
  );
  res.status(200).json({
    status: 'success',
    data: { matrix },
  });
});

exports.getSkillGapAnalysis = catchAsync(async (req, res, next) => {
  const employeeId = req.params.employeeId;
  const analysis = await SkillInventoryService.getSkillGapAnalysis(
    employeeId,
    req.tenantId,
  );
  res.status(200).json({
    status: 'success',
    data: { analysis },
  });
});
