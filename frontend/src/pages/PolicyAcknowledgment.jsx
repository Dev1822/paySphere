import { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import GavelIcon from '@mui/icons-material/Gavel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingIcon from '@mui/icons-material/Pending';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import BarChartIcon from '@mui/icons-material/BarChart';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

const CATEGORY_COLORS = {
  'Code of Conduct': 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
  'Data Security': 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  'Leave Policy': 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300',
  'Workplace Safety': 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  'Remote Work': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
};

const CATEGORIES = ['Code of Conduct', 'Data Security', 'Leave Policy', 'Workplace Safety', 'Remote Work', 'Benefits', 'Other'];

export default function PolicyAcknowledgment() {
  const [view, setView] = useState('policies');
  const [policies, setPolicies] = useState([]);
  const [myPolicies, setMyPolicies] = useState(null);
  const [complianceReport, setComplianceReport] = useState(null);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [policyDetail, setPolicyDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '', description: '', content: '', category: 'Code of Conduct',
    version: '1.0', isMandatory: true,
  });
  const [formError, setFormError] = useState('');

  const fetchPolicies = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/policies/');
      setPolicies(res.data.policies || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  const fetchMyPolicies = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/policies/my/policies');
      setMyPolicies(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  const fetchComplianceReport = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/policies/admin/compliance-report');
      setComplianceReport(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  const fetchPolicyDetail = useCallback(async (id) => {
    try {
      const res = await api.get(`/api/policies/${id}`);
      setPolicyDetail(res.data);
      setSelectedPolicy(id);
    } catch (err) { console.error(err); }
  }, []);

  const handleAcknowledge = async (policyId) => {
    try {
      await api.post(`/api/policies/${policyId}/acknowledge`);
      await fetchMyPolicies();
      if (selectedPolicy === policyId) fetchPolicyDetail(policyId);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreatePolicy = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!createForm.title.trim() || !createForm.content.trim()) {
      setFormError('Title and content are required');
      return;
    }
    try {
      await api.post('/api/policies/', createForm);
      setShowCreateForm(false);
      setCreateForm({ title: '', description: '', content: '', category: 'Code of Conduct', version: '1.0', isMandatory: true });
      fetchPolicies();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to create policy');
    }
  };

  useEffect(() => {
    if (view === 'policies') fetchPolicies();
    else if (view === 'my') fetchMyPolicies();
    else if (view === 'compliance') fetchComplianceReport();
  }, [view, fetchPolicies, fetchMyPolicies, fetchComplianceReport]);

  const pendingCount = myPolicies?.summary?.mandatoryPending || 0;
  const totalAck = myPolicies?.summary?.acknowledged || 0;
  const totalPolicies = myPolicies?.summary?.total || policies.length;
  const complianceRate = myPolicies?.summary?.complianceRate ?? complianceReport?.overallCompliance ?? 100;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
      <Sidebar activePage="Policies" setActivePage={() => {}} isSidebarOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:ml-64">
        <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <GavelIcon className="text-indigo-500" /> Policy Acknowledgments
            </h1>
          </div>
          <ThemeToggle />
        </div>

        <div className="p-4 lg:p-8">
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard icon={<AssignmentIcon />} label="Total Policies" value={totalPolicies} color="indigo" />
            <StatCard icon={<CheckCircleIcon />} label="Acknowledged" value={totalAck} color="green" />
            <StatCard icon={<PendingIcon />} label="Pending" value={pendingCount} color="amber" />
            <StatCard icon={<BarChartIcon />} label="Compliance" value={`${complianceRate}%`} color={complianceRate >= 80 ? 'green' : 'red'} />
          </div>

          {pendingCount > 0 && (
            <div className="mb-6 flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-300">
              <WarningAmberIcon fontSize="small" /> You have {pendingCount} mandatory {pendingCount === 1 ? 'policy' : 'policies'} pending acknowledgment
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-slate-800 rounded-lg p-1 w-fit">
            {[
              { id: 'policies', label: 'All Policies', icon: <AssignmentIcon fontSize="small" /> },
              { id: 'my', label: 'My Acknowledgments', icon: <CheckCircleIcon fontSize="small" /> },
              { id: 'compliance', label: 'Compliance Report', icon: <BarChartIcon fontSize="small" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setView(tab.id); setSelectedPolicy(null); setPolicyDetail(null); }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  view === tab.id
                    ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* All Policies */}
          {view === 'policies' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Company Policies</h2>
                <button onClick={() => setShowCreateForm(true)} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg">
                  <AddCircleOutlineIcon fontSize="small" /> New Policy
                </button>
              </div>

              {selectedPolicy && policyDetail ? (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
                  <button onClick={() => { setSelectedPolicy(null); setPolicyDetail(null); }} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline mb-4">← Back to all policies</button>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">{policyDetail.policy.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500 dark:text-slate-400">v{policyDetail.policy.version}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[policyDetail.policy.category] || 'bg-gray-100 text-gray-700'}`}>
                          {policyDetail.policy.category}
                        </span>
                        {policyDetail.policy.isMandatory && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">Mandatory</span>}
                      </div>
                    </div>
                  </div>
                  {policyDetail.policy.description && <p className="text-sm text-gray-600 dark:text-slate-300 mb-4">{policyDetail.policy.description}</p>}
                  <div className="prose prose-sm dark:prose-invert max-w-none bg-gray-50 dark:bg-slate-900 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
                    <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-slate-300 font-sans">{policyDetail.policy.content}</pre>
                  </div>
                  <div className="mt-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-sm text-indigo-700 dark:text-indigo-300">
                    {policyDetail.stats.acknowledgedCount}/{policyDetail.stats.totalEmployees} employees have acknowledged ({policyDetail.stats.completionRate}%)
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {loading ? (
                    <div className="text-center py-12 text-gray-500 dark:text-slate-400">Loading...</div>
                  ) : policies.length === 0 ? (
                    <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
                      <GavelIcon className="text-4xl text-gray-300 dark:text-slate-600 mb-3" />
                      <p className="text-gray-500 dark:text-slate-400">No policies created yet.</p>
                    </div>
                  ) : policies.map((policy) => (
                    <div key={policy._id} onClick={() => fetchPolicyDetail(policy._id)} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 hover:border-indigo-300 dark:hover:border-indigo-700 cursor-pointer transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-gray-900 dark:text-white">{policy.title}</h3>
                            {policy.isMandatory && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">Mandatory</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[policy.category] || 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400'}`}>{policy.category}</span>
                            <span className="text-xs text-gray-500 dark:text-slate-400">v{policy.version}</span>
                          </div>
                        </div>
                        <span className={`text-xs font-medium ${policy.isActive ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-slate-500'}`}>
                          {policy.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* My Acknowledgments */}
          {view === 'my' && (
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">My Acknowledgments</h2>
              {loading ? (
                <div className="text-center py-12 text-gray-500 dark:text-slate-400">Loading...</div>
              ) : myPolicies?.policies?.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
                  <p className="text-gray-500 dark:text-slate-400">No policies to acknowledge.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {myPolicies?.policies?.map((policy) => (
                    <div key={policy._id} className={`bg-white dark:bg-slate-800 rounded-xl border p-4 ${policy.acknowledged ? 'border-green-200 dark:border-green-900/30' : policy.isMandatory ? 'border-amber-200 dark:border-amber-900/30' : 'border-gray-200 dark:border-slate-700'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-gray-900 dark:text-white">{policy.title}</h3>
                            {policy.isMandatory && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">Required</span>}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-slate-400">
                            <span>{policy.category}</span>
                            <span>v{policy.version}</span>
                            {policy.acknowledged && (
                              <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                                <CheckCircleIcon fontSize="inherit" /> Acknowledged {new Date(policy.acknowledgedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                        {!policy.acknowledged && (
                          <button onClick={() => handleAcknowledge(policy._id)} className="ml-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg whitespace-nowrap transition-colors">
                            Acknowledge
                          </button>
                        )}
                        {policy.acknowledged && (
                          <CheckCircleIcon className="text-green-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Compliance Report */}
          {view === 'compliance' && (
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <BarChartIcon /> Compliance Report
              </h2>
              {loading ? (
                <div className="text-center py-12 text-gray-500 dark:text-slate-400">Loading...</div>
              ) : !complianceReport?.report?.length ? (
                <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
                  <p className="text-gray-500 dark:text-slate-400">No mandatory policies to report on.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800">
                    <p className="text-sm text-indigo-700 dark:text-indigo-300">
                      Overall compliance rate: <strong>{complianceReport.overallCompliance}%</strong> across {complianceReport.report.length} mandatory {complianceReport.report.length === 1 ? 'policy' : 'policies'}
                    </p>
                  </div>
                  {complianceReport.report.map((item) => (
                    <div key={item.policyId} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-bold text-gray-900 dark:text-white">{item.title}</h3>
                          <span className="text-xs text-gray-500 dark:text-slate-400">{item.category} · v{item.version}</span>
                        </div>
                        <div className="text-right">
                          <span className={`text-2xl font-bold ${item.completionRate === 100 ? 'text-green-600 dark:text-green-400' : item.completionRate >= 80 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                            {item.completionRate}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2.5 mb-3">
                        <div
                          className={`h-2.5 rounded-full ${item.completionRate === 100 ? 'bg-green-500' : item.completionRate >= 80 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${item.completionRate}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
                        <span>{item.acknowledgedCount}/{item.totalEmployees} acknowledged</span>
                        {item.pendingCount > 0 && <span className="text-red-600 dark:text-red-400">{item.pendingCount} pending</span>}
                      </div>
                      {item.pendingEmployees.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {item.pendingEmployees.slice(0, 5).map((emp) => (
                            <span key={emp.id} className="text-xs bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 px-2 py-0.5 rounded-full">{emp.name}</span>
                          ))}
                          {item.pendingEmployees.length > 5 && (
                            <span className="text-xs text-gray-400 dark:text-slate-500">+{item.pendingEmployees.length - 5} more</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Create Policy Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 w-full max-w-lg p-6 shadow-xl max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Create New Policy</h3>
              {formError && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">{formError}</div>}
              <form onSubmit={handleCreatePolicy} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Title *</label>
                  <input type="text" value={createForm.title} onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent" required />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Description</label>
                  <input type="text" value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Category *</label>
                    <select value={createForm.category} onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white">
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Version</label>
                    <input type="text" value={createForm.version} onChange={(e) => setCreateForm({ ...createForm, version: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Content *</label>
                  <textarea value={createForm.content} onChange={(e) => setCreateForm({ ...createForm, content: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white resize-none" rows={6} required />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="mandatory" checked={createForm.isMandatory} onChange={(e) => setCreateForm({ ...createForm, isMandatory: e.target.checked })}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                  <label htmlFor="mandatory" className="text-sm font-medium text-gray-700 dark:text-slate-300">Mandatory for all employees</label>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors">Create Policy</button>
                  <button type="button" onClick={() => setShowCreateForm(false)} className="px-6 py-2.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-300 font-medium rounded-lg transition-colors">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  const colorClasses = {
    indigo: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
  };
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>{icon}</div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          <p className="text-xs text-gray-500 dark:text-slate-400">{label}</p>
        </div>
      </div>
    </div>
  );
}
