import React, { useState, useEffect } from 'react';
import {
  User,
  Calendar,
  CheckCircle2,
  FileText,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  X,
} from 'lucide-react';
import api from '../../services/api';

export interface HandoverWizardProps {
  onClose: () => void;
  onSuccess?: () => void;
}

interface EmployeeSummary {
  _id: string;
  fullName: string;
  email: string;
  department: string;
  role: string;
}

export const HandoverWizard: React.FC<HandoverWizardProps> = ({
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState(1);
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  
  // Form fields
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [exitDate, setExitDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  
  // Custom checklist templates to add to knowledge transfers
  const [addEmailTemplate, setAddEmailTemplate] = useState(true);
  const [addCodeTemplate, setAddCodeTemplate] = useState(true);
  const [addProcessDocTemplate, setAddProcessDocTemplate] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoadingEmployees(true);
    api
      .get('/api/employees', { params: { limit: 100 } })
      .then((res) => {
        setEmployees(res.data?.employees || []);
      })
      .catch(() => {
        setError('Failed to fetch employee list.');
      })
      .finally(() => {
        setLoadingEmployees(false);
      });
  }, []);

  const selectedEmployee = employees.find((e) => e._id === selectedEmployeeId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId) {
      setError('Please select an employee.');
      return;
    }
    
    setSubmitting(true);
    setError(null);

    try {
      // 1. Call initiate handover plan
      const res = await api.post('/api/handover/initiate', {
        employeeId: selectedEmployeeId,
        exitDate,
      });

      const planId = res.data.plan?._id;

      // 2. Add custom knowledge transfers if requested
      if (planId) {
        if (addEmailTemplate) {
          await api.patch('/api/handover/knowledge-transfer', {
            planId,
            title: 'Transition inbox & client emails',
            description: 'Set up auto-responder and forward incoming messages.',
            category: 'Client Contact',
            isMandatory: true,
          });
        }
        if (addCodeTemplate) {
          await api.patch('/api/handover/knowledge-transfer', {
            planId,
            title: 'Code handoff & credentials access',
            description: 'Commit open branches, push revisions, and transfer keys.',
            category: 'Code Repository',
            isMandatory: true,
          });
        }
        if (addProcessDocTemplate) {
          await api.patch('/api/handover/knowledge-transfer', {
            planId,
            title: 'Document runbooks & support procedures',
            description: 'Write Process document detailing routine operational steps.',
            category: 'Process Document',
            isMandatory: true,
          });
        }
      }

      setStep(3);
      onSuccess?.();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to initiate handover plan.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      data-testid="handover-wizard"
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 font-sans"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl max-w-lg w-full text-slate-100 relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-500 hover:text-slate-300 transition"
          aria-label="Close wizard"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Wizard Header */}
        <div className="pb-4 border-b border-slate-800 mb-6">
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            Offboarding Handover Wizard
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Step {step} of 3: {step === 1 ? 'Select Employee' : step === 2 ? 'Exit Rules & Templates' : 'Plan Initiated'}
          </p>
        </div>

        {error && (
          <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Step 1: Select Employee */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5">Select Exiting Employee</label>
                {loadingEmployees ? (
                  <div className="text-xs font-mono text-slate-500 py-2">Loading organization hierarchy...</div>
                ) : (
                  <select
                    name="employeeId"
                    value={selectedEmployeeId}
                    onChange={(e) => {
                      setSelectedEmployeeId(e.target.value);
                      setError(null);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 transition"
                  >
                    <option value="">-- Choose employee --</option>
                    {employees.map((e) => (
                      <option key={e._id} value={e._id}>
                        {e.fullName} ({e.email}) - {e.role}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {selectedEmployee && (
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Department:</span>
                    <span className="text-slate-200 font-medium">{selectedEmployee.department}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Current Role:</span>
                    <span className="text-slate-200 font-medium">{selectedEmployee.role}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-4 border-t border-slate-800">
                <button
                  type="button"
                  disabled={!selectedEmployeeId}
                  onClick={() => setStep(2)}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs py-2.5 px-5 rounded-xl shadow-lg transition flex items-center gap-1.5"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Exit Rules & Templates */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5">Official Exit Date</label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="date"
                    name="exitDate"
                    value={exitDate}
                    onChange={(e) => setExitDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-mono text-slate-400">Pre-populate Handover Tasks</label>
                
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">Email inbox migration</h4>
                    <p className="text-[10px] text-slate-500">Inbox forwarding and contacts backup</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={addEmailTemplate}
                    onChange={(e) => setAddEmailTemplate(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                  />
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">Engineering code handoff</h4>
                    <p className="text-[10px] text-slate-500">GitHub commits & keys revocation</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={addCodeTemplate}
                    onChange={(e) => setAddCodeTemplate(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                  />
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">Process runbooks creation</h4>
                    <p className="text-[10px] text-slate-500">Standard operational runbooks write-up</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={addProcessDocTemplate}
                    onChange={(e) => setAddProcessDocTemplate(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs py-2.5 px-5 rounded-xl transition flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs py-2.5 px-5 rounded-xl shadow-lg transition flex items-center gap-1.5"
                >
                  <span>{submitting ? 'Initiating...' : 'Initiate Offboarding'}</span>
                  <CheckCircle2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Success Confirmation */}
          {step === 3 && (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-lg">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">Handover Plan Created Successfully</h3>
                <p className="text-xs text-slate-400">
                  Offboarding tasks and access revocation schedules have been assigned.
                </p>
              </div>

              <div className="pt-6 border-t border-slate-800 flex justify-center">
                <button
                  type="button"
                  onClick={onClose}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-2.5 px-6 rounded-xl shadow-lg transition"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default HandoverWizard;
