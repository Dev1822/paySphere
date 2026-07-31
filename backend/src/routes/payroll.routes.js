const express = require("express");
const {  submitPayrollForReview, getPendingApprovals, approvePayroll, rejectPayroll, getPayrollSummary, exportPayrollCSV, sendPayslipEmailHandler, sendAllPayslipsEmailHandler } = require("../controllers/payroll.controller");
const auth = require("../middlewares/auth.middleware");
const { requirePermission } = require("../middlewares/rbac.middleware");
const { writeRateLimiter } = require("../middlewares/rateLimiter.middleware");
const router = express.Router();

router.post("/finalize", auth, writeRateLimiter, finalizePayroll);
router.get("/summary", auth, getPayrollSummary);
router.get("/export-csv", auth, exportPayrollCSV);
router.post("/send-email/:id", auth, writeRateLimiter, sendPayslipEmailHandler);
router.post("/send-all-emails", auth, writeRateLimiter, sendAllPayslipsEmailHandler);

module.exports = router;

