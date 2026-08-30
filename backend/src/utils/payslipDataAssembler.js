/**
 * Transforms raw payroll and employee data into a format-agnostic structured JSON
 * suitable for the payslip renderers based on the template's sections.
 */
function assemblePayslipData(employee, payroll, template) {
  // Sort sections by order
  const sections = (template.sections || []).sort((a, b) => a.order - b.order);

  const data = {
    branding: template.branding,
    footerOptions: template.footerOptions,
    security: template.security,
    sections: [],
  };

  sections.forEach((section) => {
    if (!section.visible) return;

    let sectionData = { id: section.id, title: section.title, content: {} };

    switch (section.id) {
      case 'header':
        sectionData.content = {
          companyName: employee.companyName || 'Company Name',
          payslipMonth: payroll.monthName || 'Month',
          payslipYear: payroll.year || new Date().getFullYear(),
        };
        break;
      case 'employeeDetails':
        sectionData.content = {
          fullName: employee.fullName,
          employeeId: employee.employeeId || 'N/A',
          role: employee.role || 'N/A',
          department: employee.department || 'N/A',
          pan: employee.pan || 'N/A',
        };
        break;
      case 'earnings':
        sectionData.content = {
          baseSalary: payroll.baseSalary || 0,
          overtimePay: payroll.overtimePay || 0,
          bonus: payroll.bonus || 0,
          reimbursements: payroll.reimbursements || 0,
          totalEarnings:
            (payroll.baseSalary || 0) +
            (payroll.overtimePay || 0) +
            (payroll.bonus || 0) +
            (payroll.reimbursements || 0),
        };
        break;
      case 'deductions':
        sectionData.content = {
          leaveDeduction: payroll.leaveDeduction || 0,
          taxDeduction: payroll.taxDeduction || 0,
          otherDeductions: payroll.deductions || 0,
          totalDeductions:
            (payroll.leaveDeduction || 0) +
            (payroll.taxDeduction || 0) +
            (payroll.deductions || 0),
        };
        break;
      case 'netPay':
        sectionData.content = {
          netSalary: payroll.netSalary || 0,
        };
        break;
      case 'footer':
        sectionData.content = {
          customText: template.footerOptions?.customText || '',
        };
        break;
      default:
        break;
    }

    data.sections.push(sectionData);
  });

  return data;
}

module.exports = { assemblePayslipData };
