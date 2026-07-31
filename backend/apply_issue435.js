const fs = require('fs');
const path = require('path');

// 1. backend/src/models/payroll.model.js
const payrollModelPath = path.join(__dirname, 'src', 'models', 'payroll.model.js');
let payrollModelCode = fs.readFileSync(payrollModelPath, 'utf8');

if (!payrollModelCode.includes('PENDING_APPROVAL')) {
  payrollModelCode = payrollModelCode.replace(
    /status: \{\s*type: String,\s*enum: \["paid", "pending", "failed", "finalized"\],\s*default: "pending",\s*\}/,
    `status: {
      type: String,
      enum: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "paid", "pending", "failed", "finalized"],
      default: "DRAFT",
    },
    rejectionReason: { type: String, default: "" },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date }`
  );
  fs.writeFileSync(payrollModelPath, payrollModelCode);
  console.log("Updated payroll.model.js");
}

// 2. backend/src/controllers/payroll.controller.js
const payrollCtrlPath = path.join(__dirname, 'src', 'controllers', 'payroll.controller.js');
let payrollCtrlCode = fs.readFileSync(payrollCtrlPath, 'utf8');

if (!payrollCtrlCode.includes('PENDING_APPROVAL')) {
  // Update finalize to submit
  payrollCtrlCode = payrollCtrlCode.replace(
    /status: "finalized"/,
    `status: "PENDING_APPROVAL"`
  );
  payrollCtrlCode = payrollCtrlCode.replace(
    /exports\.finalizePayroll = async/,
    `exports.submitPayrollForReview = async`
  );
  payrollCtrlCode = payrollCtrlCode.replace(
    /message: \`Payroll finalized for \$\{results\.length\}/,
    `message: \`Payroll submitted for review for \$\{results.length\}`
  );

  // Add approve, reject, getApprovals
  const additionalCtrls = `
exports.getPendingApprovals = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const query = { status: "PENDING_APPROVAL" }; // Admin sees all in this demo

    const pending = await PayrollUpdate.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("createdBy", "fullName email")
      .populate("employeeId", "fullName role");
      
    const totalCount = await PayrollUpdate.countDocuments(query);

    res.status(200).json({
      pending,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      totalCount
    });
  } catch (error) {
    next(error);
  }
};

exports.approvePayroll = async (req, res, next) => {
  try {
    const { payrollIds } = req.body;
    if (!payrollIds || !Array.isArray(payrollIds)) {
      return res.status(400).json({ message: "payrollIds array required" });
    }

    await PayrollUpdate.updateMany(
      { _id: { $in: payrollIds }, status: "PENDING_APPROVAL" },
      { $set: { status: "APPROVED", approvedBy: req.userId, approvedAt: new Date() } }
    );

    res.status(200).json({ message: "Payroll approved successfully" });
  } catch (error) {
    next(error);
  }
};

exports.rejectPayroll = async (req, res, next) => {
  try {
    const { payrollIds, reason } = req.body;
    if (!payrollIds || !Array.isArray(payrollIds)) {
      return res.status(400).json({ message: "payrollIds array required" });
    }
    if (!reason) {
      return res.status(400).json({ message: "Rejection reason required" });
    }

    await PayrollUpdate.updateMany(
      { _id: { $in: payrollIds }, status: "PENDING_APPROVAL" },
      { $set: { status: "REJECTED", rejectionReason: reason } }
    );

    res.status(200).json({ message: "Payroll rejected successfully" });
  } catch (error) {
    next(error);
  }
};
`;
  
  payrollCtrlCode = payrollCtrlCode.replace(/exports\.parsePayrollCSV = async/, additionalCtrls + '\nexports.parsePayrollCSV = async');
  fs.writeFileSync(payrollCtrlPath, payrollCtrlCode);
  console.log("Updated payroll.controller.js");
}

// 3. backend/src/routes/payroll.routes.js
const payrollRoutesPath = path.join(__dirname, 'src', 'routes', 'payroll.routes.js');
let payrollRoutesCode = fs.readFileSync(payrollRoutesPath, 'utf8');

if (!payrollRoutesCode.includes('submitPayrollForReview')) {
  payrollRoutesCode = payrollRoutesCode.replace(
    /const \{([\s\S]*?)finalizePayroll,([\s\S]*?)\} = require\("\.\.\/controllers\/payroll\.controller"\);/,
    `const { $1submitPayrollForReview, getPendingApprovals, approvePayroll, rejectPayroll,$2} = require("../controllers/payroll.controller");`
  );
  payrollRoutesCode = payrollRoutesCode.replace(
    /router\.post\("\/finalize", auth, requirePermission\("WRITE_PAYROLL"\), writeRateLimiter, finalizePayroll\);/,
    `router.post("/submit", auth, requirePermission("WRITE_PAYROLL"), writeRateLimiter, submitPayrollForReview);
router.get("/approvals", auth, requirePermission("APPROVE_PAYROLL"), writeRateLimiter, getPendingApprovals);
router.post("/approve", auth, requirePermission("APPROVE_PAYROLL"), writeRateLimiter, approvePayroll);
router.post("/reject", auth, requirePermission("APPROVE_PAYROLL"), writeRateLimiter, rejectPayroll);`
  );
  fs.writeFileSync(payrollRoutesPath, payrollRoutesCode);
  console.log("Updated payroll.routes.js");
}

// 4. frontend/src/pages/Dashboard.jsx
const dashPath = path.join(__dirname, '..', 'frontend', 'src', 'pages', 'Dashboard.jsx');
let dashCode = fs.readFileSync(dashPath, 'utf8');

if (!dashCode.includes('Submit for Review')) {
  dashCode = dashCode.replace(
    />\s*Finish & Pay\s*<\/button>/,
    ` onClick={() => navigate('/monthly-updates')}>\n            Submit for Review\n          </button>`
  );
  fs.writeFileSync(dashPath, dashCode);
  console.log("Updated Dashboard.jsx");
}

// 5. frontend/src/components/Sidebar.jsx
const sidebarPath = path.join(__dirname, '..', 'frontend', 'src', 'components', 'Sidebar.jsx');
let sidebarCode = fs.readFileSync(sidebarPath, 'utf8');

if (!sidebarCode.includes('Approvals')) {
  sidebarCode = sidebarCode.replace(
    /import AssessmentIcon from '@mui\/icons-material\/Assessment';/,
    `import AssessmentIcon from '@mui/icons-material/Assessment';\nimport FactCheckIcon from '@mui/icons-material/FactCheck';`
  );
  sidebarCode = sidebarCode.replace(
    /\{ id: 'Employees', label: 'Employees', icon: <PeopleIcon \/> \},/,
    `{ id: 'Employees', label: 'Employees', icon: <PeopleIcon /> },\n      { id: 'Approvals', label: 'Approvals', icon: <FactCheckIcon /> },`
  );
  fs.writeFileSync(sidebarPath, sidebarCode);
  console.log("Updated Sidebar.jsx");
}
