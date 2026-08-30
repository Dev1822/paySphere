const { formatCurrency } = require('./currency');

function renderPayslipHtml(assembledData, currency = 'INR') {
  const { branding, sections } = assembledData;
  const primaryColor = branding?.primaryColor || '#3b82f6';
  const fontFamily = branding?.fontFamily || 'Helvetica, Arial, sans-serif';

  let html = `
    <div style="font-family: ${fontFamily}; max-width: 800px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb;">
  `;

  if (branding?.logoUrl) {
    html += `<div style="text-align: center; margin-bottom: 20px;"><img src="${branding.logoUrl}" style="max-height: 80px;" alt="Logo" /></div>`;
  }

  sections.forEach((section) => {
    html += `<div style="margin-bottom: 20px;">`;
    if (section.title) {
      html += `<h3 style="color: ${primaryColor}; border-bottom: 1px solid ${primaryColor}; padding-bottom: 5px;">${section.title}</h3>`;
    }

    if (section.id === 'header') {
      html += `
        <p><strong>${section.content.companyName}</strong></p>
        <p>Payslip for ${section.content.payslipMonth} ${section.content.payslipYear}</p>
      `;
    } else if (section.id === 'employeeDetails') {
      html += `
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 5px 0;"><strong>Name:</strong> ${section.content.fullName}</td>
            <td style="padding: 5px 0;"><strong>Employee ID:</strong> ${section.content.employeeId}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0;"><strong>Role:</strong> ${section.content.role}</td>
            <td style="padding: 5px 0;"><strong>Department:</strong> ${section.content.department}</td>
          </tr>
        </table>
      `;
    } else if (section.id === 'earnings') {
      html += `
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 5px 0;">Base Salary</td><td style="text-align: right;">${formatCurrency(section.content.baseSalary, currency)}</td></tr>
          <tr><td style="padding: 5px 0;">Overtime</td><td style="text-align: right;">${formatCurrency(section.content.overtimePay, currency)}</td></tr>
          <tr><td style="padding: 5px 0;">Bonus</td><td style="text-align: right;">${formatCurrency(section.content.bonus, currency)}</td></tr>
          <tr><td style="padding: 5px 0;">Reimbursements</td><td style="text-align: right;">${formatCurrency(section.content.reimbursements, currency)}</td></tr>
          <tr style="font-weight: bold; border-top: 1px solid #ccc;"><td style="padding: 5px 0;">Total Earnings</td><td style="text-align: right;">${formatCurrency(section.content.totalEarnings, currency)}</td></tr>
        </table>
      `;
    } else if (section.id === 'deductions') {
      html += `
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 5px 0;">Leave Deduction</td><td style="text-align: right;">${formatCurrency(section.content.leaveDeduction, currency)}</td></tr>
          <tr><td style="padding: 5px 0;">Tax Deduction</td><td style="text-align: right;">${formatCurrency(section.content.taxDeduction, currency)}</td></tr>
          <tr><td style="padding: 5px 0;">Other Deductions</td><td style="text-align: right;">${formatCurrency(section.content.otherDeductions, currency)}</td></tr>
          <tr style="font-weight: bold; border-top: 1px solid #ccc;"><td style="padding: 5px 0;">Total Deductions</td><td style="text-align: right;">${formatCurrency(section.content.totalDeductions, currency)}</td></tr>
        </table>
      `;
    } else if (section.id === 'netPay') {
      html += `
        <div style="background-color: #f3f4f6; padding: 15px; margin-top: 10px; text-align: center;">
          <h2 style="margin: 0; color: ${primaryColor};">Net Pay: ${formatCurrency(section.content.netSalary, currency)}</h2>
        </div>
      `;
    } else if (section.id === 'footer') {
      html += `<p style="text-align: center; color: #6b7280; font-size: 0.875rem;">${section.content.customText}</p>`;
    }

    html += `</div>`;
  });

  html += `</div>`;
  return html;
}

module.exports = { renderPayslipHtml };
