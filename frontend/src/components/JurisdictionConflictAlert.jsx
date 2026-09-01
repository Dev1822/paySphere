import WarningAmberIcon from '@mui/icons-material/WarningAmber';

/**
 * @fileoverview Jurisdiction Conflict Alert Component
 * @description Displays warnings for employees with missing certificates or double-taxation risks.
 * Issue: #2062
 */
export default function JurisdictionConflictAlert({ conflicts }) {
    if (!conflicts || conflicts.length === 0) return null;

    const missingCerts = conflicts.filter(c => c.conflictType === 'Missing Certificate').length;
    const doubleTax = conflicts.filter(c => c.conflictType === 'Double Taxation Risk').length;
    const pending = conflicts.filter(c => c.conflictType === 'Pending Review').length;

    return (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-3">
            <WarningAmberIcon className="text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="flex-1">
                <h3 className="text-sm font-bold text-amber-800 dark:text-amber-200">Jurisdiction Conflict Guardrail Alert</h3>
                <ul className="text-xs text-amber-700 dark:text-amber-300 mt-2 space-y-1 list-disc list-inside">
                    {missingCerts > 0 && <li><strong>{missingCerts}</strong> employee(s) are missing local tax certificates. Defaulting to highest rates.</li>}
                    {doubleTax > 0 && <li><strong>{doubleTax}</strong> employee(s) face double taxation risk due to lack of reciprocity agreements.</li>}
                    {pending > 0 && <li><strong>{pending}</strong> employee(s) have residency declarations pending HR review.</li>}
                </ul>
            </div>
        </div>
    );
}
