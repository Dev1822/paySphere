const logger = require("../utils/logger");

/**
 * Shared Payslip PDF Renderer using PDFKit.
 * Render clean, professional payslips with support for company logos, addresses, GSTIN/PAN,
 * bank details, reimbursements, and authorized signatures.
 *
 * @param {PDFDocument} doc - PDFKit document instance
 * @param {Object} data - Payslip rendering payload
 * @param {Object} data.employee - Employee object { fullName, role, companyName, email, bankDetails }
 * @param {Object} data.payroll - Payroll object { month, year, baseSalary, leaveDays, leaveDeduction, overtimeHours, overtimePay, bonus, deductions, reimbursements, netSalary }
 * @param {Object} data.company - Company settings object from user.settings.companyInfo { companyLogo, showLogoOnPayslip, address, gstin, pan, contactPhone, contactEmail, bankDetails, signatureImage, showSignatureOnPayslip }
 * @param {String} [data.currency] - Currency label (defaults to "Rs.")
 */
function renderPayslip(doc, { employee = {}, payroll = {}, company = {}, currency = "Rs." }) {
  const compName = company.companyName || employee.companyName || "PaySphere";
  const curr = currency || "Rs.";

  // Margin and layout constants
  const startX = doc.page.margins.left || 50;
  const contentWidth = doc.page.width - startX - (doc.page.margins.right || 50);

  // --- 1. Header Section (Logo + Company Info) ---
  let headerY = doc.y;

  // Render logo if configured
  let logoRendered = false;
  if (company.companyLogo && company.showLogoOnPayslip !== false) {
    try {
      let logoBuffer;
      const logoStr = company.companyLogo;
      if (logoStr.startsWith("data:image")) {
        const base64Data = logoStr.split(",")[1];
        logoBuffer = Buffer.from(base64Data, "base64");
      } else {
        logoBuffer = Buffer.from(logoStr, "base64");
      }
      doc.image(logoBuffer, startX, headerY, { fit: [120, 50] });
      logoRendered = true;
    } catch (err) {
      logger.warn("Failed to render company logo on payslip PDF", { error: err.message });
    }
  }

  // Company Name and Details
  const compInfoX = logoRendered ? startX + 130 : startX;
  const compInfoWidth = logoRendered ? contentWidth - 130 : contentWidth;

  doc.fontSize(18).font("Helvetica-Bold").fillColor("#1e3a5f").text(compName, compInfoX, headerY, { width: compInfoWidth });
  
  doc.fontSize(9).font("Helvetica").fillColor("#555555");
  if (company.address) {
    doc.text(company.address, compInfoX, doc.y, { width: compInfoWidth });
  }

  const taxDetails = [];
  if (company.gstin) taxDetails.push(`GSTIN: ${company.gstin}`);
  if (company.pan) taxDetails.push(`PAN: ${company.pan}`);
  if (taxDetails.length > 0) {
    doc.text(taxDetails.join("  |  "), compInfoX, doc.y, { width: compInfoWidth });
  }

  const contactDetails = [];
  if (company.contactEmail) contactDetails.push(`Email: ${company.contactEmail}`);
  if (company.contactPhone) contactDetails.push(`Phone: ${company.contactPhone}`);
  if (contactDetails.length > 0) {
    doc.text(contactDetails.join("  |  "), compInfoX, doc.y, { width: compInfoWidth });
  }

  doc.moveDown(1);
  if (doc.y < headerY + 55) {
    doc.y = headerY + 60;
  }

  // Divider Line
  doc.moveTo(startX, doc.y).lineTo(startX + contentWidth, doc.y).strokeColor("#e2e8f0").lineWidth(1).stroke();
  doc.moveDown(0.8);

  // --- 2. Title & Pay Period ---
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const monthStr = typeof payroll.month === "number" && payroll.month >= 1 && payroll.month <= 12
    ? monthNames[payroll.month - 1]
    : (payroll.month || "");
  const periodStr = monthStr ? `${monthStr} ${payroll.year || ""}` : `Period: ${payroll.month || ""}/${payroll.year || ""}`;

  doc.fontSize(14).font("Helvetica-Bold").fillColor("#1e3a5f").text(`PAYSLIP FOR ${periodStr.toUpperCase()}`, startX, doc.y, { align: "center" });
  doc.moveDown(1);

  // --- 3. Employee & Bank Details Section ---
  const detailsY = doc.y;
  const colWidth = (contentWidth - 20) / 2;

  // Left Box: Employee Info
  doc.fontSize(10).font("Helvetica-Bold").fillColor("#333333").text("EMPLOYEE DETAILS", startX, detailsY);
  doc.moveDown(0.3);
  doc.fontSize(9).font("Helvetica").fillColor("#555555");
  doc.text(`Name: ${employee.fullName || payroll.employeeName || "N/A"}`);
  doc.text(`Role: ${employee.role || "N/A"}`);
  if (employee.email) {
    doc.text(`Email: ${employee.email}`);
  }

  // Employee Bank Account Details
  const empBank = employee.bankDetails || payroll.bankDetails;
  if (empBank && (empBank.bankName || empBank.accountNumber)) {
    doc.moveDown(0.3);
    doc.font("Helvetica-Bold").fillColor("#444444").text("Employee Bank Account:");
    doc.font("Helvetica").fillColor("#555555");
    if (empBank.bankName) doc.text(`Bank: ${empBank.bankName}`);
    if (empBank.accountNumber) doc.text(`A/C: ${empBank.accountNumber}`);
    if (empBank.ifscCode) doc.text(`IFSC: ${empBank.ifscCode}`);
  }

  const leftBoxHeight = doc.y - detailsY;

  // Right Box: Company Bank / Payment Info
  const rightX = startX + colWidth + 20;
  doc.y = detailsY;
  if (company.bankDetails && (company.bankDetails.bankName || company.bankDetails.accountNumber)) {
    doc.fontSize(10).font("Helvetica-Bold").fillColor("#333333").text("COMPANY BANK DETAILS", rightX, detailsY);
    doc.moveDown(0.3);
    doc.fontSize(9).font("Helvetica").fillColor("#555555");
    if (company.bankDetails.bankName) doc.text(`Bank: ${company.bankDetails.bankName}`, rightX);
    if (company.bankDetails.accountNumber) doc.text(`A/C No: ${company.bankDetails.accountNumber}`, rightX);
    if (company.bankDetails.ifscCode) doc.text(`IFSC: ${company.bankDetails.ifscCode}`, rightX);
  }

  doc.y = Math.max(doc.y, detailsY + leftBoxHeight);
  doc.moveDown(1);

  // --- 4. Earnings & Deductions Table ---
  doc.moveTo(startX, doc.y).lineTo(startX + contentWidth, doc.y).strokeColor("#e2e8f0").lineWidth(1).stroke();
  doc.moveDown(0.8);

  doc.fontSize(11).font("Helvetica-Bold").fillColor("#1e3a5f").text("PAYROLL BREAKDOWN", startX, doc.y);
  doc.moveDown(0.5);

  const baseSalary = payroll.baseSalary || 0;
  const leaveDays = payroll.leaveDays || 0;
  const leaveDeduction = payroll.leaveDeduction || 0;
  const overtimeHours = payroll.overtimeHours || 0;
  const overtimePay = payroll.overtimePay || 0;
  const bonus = payroll.bonus || 0;
  const reimbursements = payroll.reimbursements || 0;
  const deductions = payroll.deductions || 0;
  const netSalary = payroll.netSalary || 0;

  const items = [
    { label: "Base Salary", amount: baseSalary, isDeduction: false },
  ];

  if (leaveDays > 0 || leaveDeduction > 0) {
    items.push({
      label: `Leave Deduction (${leaveDays} day${leaveDays !== 1 ? "s" : ""})`,
      amount: leaveDeduction,
      isDeduction: true,
    });
  }

  if (overtimeHours > 0 || overtimePay > 0) {
    items.push({
      label: `Overtime Pay (${overtimeHours} hr${overtimeHours !== 1 ? "s" : ""})`,
      amount: overtimePay,
      isDeduction: false,
    });
  }

  if (bonus > 0) {
    items.push({ label: "Bonus", amount: bonus, isDeduction: false });
  }

  if (reimbursements > 0) {
    items.push({ label: "Reimbursements (Tax-Free)", amount: reimbursements, isDeduction: false });
  }

  if (deductions > 0) {
    items.push({ label: "Other Deductions", amount: deductions, isDeduction: true });
  }

  // Draw items
  items.forEach((item) => {
    const prefix = item.isDeduction ? "- " : "+ ";
    const displayPrefix = item.label === "Base Salary" ? "" : prefix;
    const valStr = `${displayPrefix}${curr} ${item.amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    doc.fontSize(9.5).font("Helvetica").fillColor(item.isDeduction ? "#c53030" : "#2d3748");
    doc.text(item.label, startX, doc.y, { continued: true, width: contentWidth - 120 });
    doc.text(valStr, { align: "right" });
    doc.moveDown(0.4);
  });

  doc.moveDown(0.5);
  doc.moveTo(startX, doc.y).lineTo(startX + contentWidth, doc.y).strokeColor("#cbd5e0").lineWidth(1.5).stroke();
  doc.moveDown(0.6);

  // Net Salary
  doc.fontSize(12).font("Helvetica-Bold").fillColor("#1e3a5f");
  doc.text("NET SALARY PAYOUT", startX, doc.y, { continued: true, width: contentWidth - 150 });
  doc.fontSize(13).fillColor("#2b6cb0").text(`${curr} ${netSalary.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, { align: "right" });
  doc.moveDown(1.5);

  // --- 5. Signature Section ---
  if (company.signatureImage && company.showSignatureOnPayslip !== false) {
    try {
      let sigBuffer;
      const sigStr = company.signatureImage;
      if (sigStr.startsWith("data:image")) {
        const base64Data = sigStr.split(",")[1];
        sigBuffer = Buffer.from(base64Data, "base64");
      } else {
        sigBuffer = Buffer.from(sigStr, "base64");
      }

      const sigX = startX + contentWidth - 120;
      doc.image(sigBuffer, sigX, doc.y, { fit: [120, 45] });
      doc.y += 48;
      doc.fontSize(8.5).font("Helvetica-Bold").fillColor("#4a5568").text("Authorized Signatory", sigX, doc.y, { width: 120, align: "center" });
    } catch (err) {
      logger.warn("Failed to render signature image on payslip PDF", { error: err.message });
    }
  }

  // Footer Note
  doc.fontSize(8).font("Helvetica-Oblique").fillColor("#a0aec0").text("This is a computer-generated document and does not require a physical stamp.", startX, doc.page.height - 40, { align: "center", width: contentWidth });
}

module.exports = {
  renderPayslip,
};
