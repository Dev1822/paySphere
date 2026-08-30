import { formatDateTime } from './formatLocale';

/**
 * Build a CSV string from an array of employee objects and trigger a
 * browser download. Pure client-side — no network call, no dependency.
 *
 * CSV columns (per issue #37, extended in #8): Name, Role, Phone, Base Pay
 *
 * @param {Array<{ fullName: string, role?: string, phone?: string, monthlySalary?: number }>} employees
 * @param {object} [options]
 * @param {string} [options.filename]   Override the default filename.
 * @param {string} [options.companyName] Company name to include in the header row.
 * @returns {void}
 */
export function exportEmployeesToCsv(employees, options = {}) {
  const {
    filename = `employee-roster-${new Date().toISOString().slice(0, 10)}.csv`,
    companyName = '',
  } = options;

  const safe = Array.isArray(employees) ? employees : [];

  // ---- 1. Build CSV rows ------------------------------------------------
  const header = ['Name', 'Role', 'Phone', 'Base Pay'];
  const rows = safe.map((emp) => [
    emp?.fullName ?? '',
    emp?.role ?? 'Employee',
    emp?.phone ?? '',
    emp?.monthlySalary ?? 0,
  ]);

  // ---- 2. Escape each cell per RFC 4180 ---------------------------------
  // Wrap in quotes if the value contains a comma, quote, or newline;
  // double any internal quotes.
  const escapeCell = (value) => {
    const str = String(value ?? '');
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvLines = [];
  if (companyName) {
    csvLines.push(`# ${companyName} — Employee Roster`);
    csvLines.push(`# Exported: ${formatDateTime(new Date())}`);
    csvLines.push(''); // blank line separates metadata from data
  }
  csvLines.push(header.map(escapeCell).join(','));
  rows.forEach((row) => csvLines.push(row.map(escapeCell).join(',')));

  // Append a totals row for quick offline reconciliation.
  const totalBasePay = safe.reduce(
    (sum, e) => sum + (Number(e?.monthlySalary) || 0),
    0,
  );
  csvLines.push('');
  csvLines.push(`"Total","${safe.length} employees","","${totalBasePay}"`);

  const csv = csvLines.join('\r\n');

  // ---- 3. Trigger the download -----------------------------------------
  // Prepend BOM so Excel opens UTF-8 content correctly.
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Defer revocation slightly so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}