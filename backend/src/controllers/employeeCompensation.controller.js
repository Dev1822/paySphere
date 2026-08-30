const employeeCompensationService = require('../services/employeeCompensation.service');
const asyncHandler = require('../middlewares/asyncHandler.middleware');

/**
 * Get longitudinal compensation timeline
 */
exports.getTimeline = asyncHandler(async (req, res) => {
  const { employeeId } = req.params;
  const tenantId = req.tenantId || req.user.tenantId;

  // Authorization: Enforce that an employee can only view their own timeline
  // HR admins can view any employee's timeline.
  if (
    req.user.employeeId !== employeeId &&
    req.user.role !== 'admin' &&
    req.user.role !== 'hr'
  ) {
    return res
      .status(403)
      .json({
        success: false,
        message: 'Not authorized to access this resource',
      });
  }

  const data = await employeeCompensationService.getCompensationTimeline(
    employeeId,
    tenantId,
  );

  res.status(200).json({
    success: true,
    data,
  });
});

/**
 * Get Year-to-Date summary
 */
exports.getYTD = asyncHandler(async (req, res) => {
  const { employeeId } = req.params;
  const { financialYearStart } = req.query; // Expecting '2023', '2024' etc.
  const tenantId = req.tenantId || req.user.tenantId;

  if (!financialYearStart) {
    return res
      .status(400)
      .json({
        success: false,
        message: 'financialYearStart query parameter is required',
      });
  }

  // Authorization: Enforce that an employee can only view their own YTD
  if (
    req.user.employeeId !== employeeId &&
    req.user.role !== 'admin' &&
    req.user.role !== 'hr'
  ) {
    return res
      .status(403)
      .json({
        success: false,
        message: 'Not authorized to access this resource',
      });
  }

  const data = await employeeCompensationService.getYTDSummary(
    employeeId,
    tenantId,
    financialYearStart,
  );

  res.status(200).json({
    success: true,
    data,
  });
});

/**
 * Generate and download PDF Statement
 */
exports.downloadStatement = asyncHandler(async (req, res) => {
  const { employeeId } = req.params;
  const { financialYearStart } = req.query;
  const tenantId = req.tenantId || req.user.tenantId;

  if (!financialYearStart) {
    return res
      .status(400)
      .json({
        success: false,
        message: 'financialYearStart query parameter is required',
      });
  }

  // Authorization
  if (
    req.user.employeeId !== employeeId &&
    req.user.role !== 'admin' &&
    req.user.role !== 'hr'
  ) {
    return res
      .status(403)
      .json({
        success: false,
        message: 'Not authorized to access this resource',
      });
  }

  const pdfBuffer = await employeeCompensationService.generateStatementPDF(
    employeeId,
    tenantId,
    financialYearStart,
  );

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=Compensation_Statement_${financialYearStart}.pdf`,
  );
  res.status(200).send(pdfBuffer);
});
