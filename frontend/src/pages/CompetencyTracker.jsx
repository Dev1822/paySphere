import { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import PsychologyIcon from '@mui/icons-material/Psychology';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import BarChartIcon from '@mui/icons-material/BarChart';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import AssessmentIcon from '@mui/icons-material/Assessment';
import GroupsIcon from '@mui/icons-material/Groups';

const PROFICIENCY_COLORS = {
  Beginner: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-300 dark:border-blue-700',
    bar: 'bg-blue-500',
  },
  Intermediate: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-700 dark:text-yellow-300',
    border: 'border-yellow-300 dark:border-yellow-700',
    bar: 'bg-yellow-500',
  },
  Advanced: {
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    text: 'text-orange-700 dark:text-orange-300',
    border: 'border-orange-300 dark:border-orange-700',
    bar: 'bg-orange-500',
  },
  Expert: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-700 dark:text-green-300',
    border: 'border-green-300 dark:border-green-700',
    bar: 'bg-green-500',
  },
};

const PROFICIENCY_WIDTH = {
  Beginner: '25%',
  Intermediate: '50%',
  Advanced: '75%',
  Expert: '100%',
};

const CATEGORIES = [
  'Technical',
  'Leadership',
  'Communication',
  'Design',
  'Domain',
  'Soft Skills',
  'Other',
];
const PROFICIENCY_OPTIONS = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];

export default function CompetencyTracker() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('skills');
  const [gapAnalysis, setGapAnalysis] = useState(null);
  const [matrix, setMatrix] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Skill form state
  const [showSkillForm, setShowSkillForm] = useState(false);
  const [editingSkill, setEditingSkill] = useState(null);
  const [skillForm, setSkillForm] = useState({
    skillName: '',
    category: 'Technical',
    proficiency: 'Beginner',
    yearsOfExperience: 0,
    notes: '',
    assessedBy: 'Self',
  });
  const [formError, setFormError] = useState('');

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/competencies/me');
      setProfile(res.data.profile);
    } catch (err) {
      console.error('Failed to fetch competency profile', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMatrix = useCallback(async () => {
    try {
      const res = await api.get('/api/competencies/matrix');
      setMatrix(res.data);
    } catch (err) {
      console.error('Failed to fetch skill matrix', err);
    }
  }, []);

  const fetchGapAnalysis = useCallback(async () => {
    if (!profile?.employeeId) return;
    try {
      const empId =
        typeof profile.employeeId === 'object'
          ? profile.employeeId
          : profile.employeeId;
      const res = await api.get(`/api/competencies/gap-analysis/${empId}`);
      setGapAnalysis(res.data);
    } catch (err) {
      console.error('Failed to fetch gap analysis', err);
    }
  }, [profile]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);
  useEffect(() => {
    if (activeTab === 'matrix') fetchMatrix();
    if (activeTab === 'gaps') fetchGapAnalysis();
  }, [activeTab, fetchMatrix, fetchGapAnalysis]);

  const resetForm = () => {
    setSkillForm({
      skillName: '',
      category: 'Technical',
      proficiency: 'Beginner',
      yearsOfExperience: 0,
      notes: '',
      assessedBy: 'Self',
    });
    setEditingSkill(null);
    setFormError('');
    setShowSkillForm(false);
  };

  const handleEditSkill = (skill) => {
    setSkillForm({
      skillName: skill.skillName,
      category: skill.category,
      proficiency: skill.proficiency,
      yearsOfExperience: skill.yearsOfExperience || 0,
      notes: skill.notes || '',
      assessedBy: skill.assessedBy || 'Self',
    });
    setEditingSkill(skill);
    setShowSkillForm(true);
    setFormError('');
  };

  const handleAddSkill = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!skillForm.skillName.trim()) {
      setFormError('Skill name is required');
      return;
    }

    const empId =
      typeof profile.employeeId === 'object'
        ? profile.employeeId._id
        : profile.employeeId;
    try {
      if (editingSkill) {
        await api.patch(
          `/api/competencies/employee/${empId}/skills/${editingSkill._id}`,
          skillForm,
        );
      } else {
        await api.post(`/api/competencies/employee/${empId}/skills`, skillForm);
      }
      await fetchProfile();
      resetForm();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save skill');
    }
  };

  const handleDeleteSkill = async (skillId) => {
    if (!window.confirm('Remove this skill?')) return;
    const empId =
      typeof profile.employeeId === 'object'
        ? profile.employeeId._id
        : profile.employeeId;
    try {
      await api.delete(`/api/competencies/employee/${empId}/skills/${skillId}`);
      await fetchProfile();
    } catch (err) {
      console.error('Failed to delete skill', err);
    }
  };

  const skillsByCategory = {};
  (profile?.skills || []).forEach((skill) => {
    if (!skillsByCategory[skill.category])
      skillsByCategory[skill.category] = [];
    skillsByCategory[skill.category].push(skill);
  });

  const totalSkills = profile?.skills?.length || 0;
  const expertCount =
    profile?.skills?.filter((s) => s.proficiency === 'Expert').length || 0;
  const advancedCount =
    profile?.skills?.filter((s) => s.proficiency === 'Advanced').length || 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
      <Sidebar
        activePage="Competencies"
        setActivePage={() => {}}
        isSidebarOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="lg:ml-64">
        <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <PsychologyIcon className="text-purple-500" /> Competency Tracker
            </h1>
          </div>
          <ThemeToggle />
        </div>

        <div className="p-4 lg:p-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              icon={<PsychologyIcon />}
              label="Total Skills"
              value={totalSkills}
              color="purple"
            />
            <StatCard
              icon={<TrendingUpIcon />}
              label="Expert Level"
              value={expertCount}
              color="green"
            />
            <StatCard
              icon={<BarChartIcon />}
              label="Advanced"
              value={advancedCount}
              color="orange"
            />
            <StatCard
              icon={<GroupsIcon />}
              label="Departments"
              value={Object.keys(skillsByCategory).length}
              color="blue"
            />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-slate-800 rounded-lg p-1 w-fit">
            {[
              {
                id: 'skills',
                label: 'My Skills',
                icon: <PsychologyIcon fontSize="small" />,
              },
              {
                id: 'matrix',
                label: 'Department Matrix',
                icon: <GroupsIcon fontSize="small" />,
              },
              {
                id: 'gaps',
                label: 'Gap Analysis',
                icon: <AssessmentIcon fontSize="small" />,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Skills Tab */}
          {activeTab === 'skills' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Skills & Competencies
                </h2>
                <button
                  onClick={() => {
                    resetForm();
                    setShowSkillForm(true);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <AddCircleOutlineIcon fontSize="small" /> Add Skill
                </button>
              </div>

              {loading ? (
                <div className="text-center py-12 text-gray-500 dark:text-slate-400">
                  Loading...
                </div>
              ) : Object.keys(skillsByCategory).length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
                  <PsychologyIcon className="text-4xl text-gray-300 dark:text-slate-600 mb-3" />
                  <p className="text-gray-500 dark:text-slate-400">
                    No skills added yet. Click "Add Skill" to get started.
                  </p>
                </div>
              ) : (
                Object.entries(skillsByCategory).map(([category, skills]) => (
                  <div key={category} className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3">
                      {category}
                    </h3>
                    <div className="space-y-3">
                      {skills.map((skill) => {
                        const colors =
                          PROFICIENCY_COLORS[skill.proficiency] ||
                          PROFICIENCY_COLORS.Beginner;
                        return (
                          <div
                            key={skill._id}
                            className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <span className="font-bold text-gray-900 dark:text-white">
                                    {skill.skillName}
                                  </span>
                                  <span
                                    className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${colors.bg} ${colors.text} border ${colors.border}`}
                                  >
                                    {skill.proficiency}
                                  </span>
                                </div>
                                <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2 mb-2">
                                  <div
                                    className={`h-2 rounded-full ${colors.bar}`}
                                    style={{
                                      width:
                                        PROFICIENCY_WIDTH[skill.proficiency],
                                    }}
                                  />
                                </div>
                                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-slate-400">
                                  <span>
                                    {skill.yearsOfExperience || 0} yrs
                                    experience
                                  </span>
                                  <span>
                                    Assessed by: {skill.assessedBy || 'Self'}
                                  </span>
                                  {skill.lastAssessedDate && (
                                    <span>
                                      Last assessed:{' '}
                                      {new Date(
                                        skill.lastAssessedDate,
                                      ).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                                {skill.notes && (
                                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 italic">
                                    {skill.notes}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-1 ml-4">
                                <button
                                  onClick={() => handleEditSkill(skill)}
                                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
                                >
                                  <EditIcon fontSize="small" />
                                </button>
                                <button
                                  onClick={() => handleDeleteSkill(skill._id)}
                                  className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500"
                                >
                                  <DeleteOutlineIcon fontSize="small" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Matrix Tab */}
          {activeTab === 'matrix' && (
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <GroupsIcon /> Department Skill Matrix
              </h2>
              {!matrix ? (
                <div className="text-center py-12 text-gray-500 dark:text-slate-400">
                  Loading matrix...
                </div>
              ) : matrix.matrix.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
                  <p className="text-gray-500 dark:text-slate-400">
                    No skill data available for the department matrix.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    Showing {matrix.totalSkills} skills across{' '}
                    {matrix.totalEmployees} employees
                  </p>
                  {matrix.matrix.map((skill) => (
                    <div
                      key={skill.skillName}
                      className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <span className="font-bold text-gray-900 dark:text-white">
                            {skill.skillName}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-slate-400 ml-2">
                            ({skill.category})
                          </span>
                        </div>
                        <span className="text-sm font-medium text-gray-600 dark:text-slate-300">
                          {skill.totalEmployees} employees · Avg{' '}
                          {skill.avgYearsOfExperience} yrs
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {Object.entries(skill.proficiencyDistribution).map(
                          ([level, count]) => {
                            if (count === 0) return null;
                            const colors = PROFICIENCY_COLORS[level];
                            return (
                              <span
                                key={level}
                                className={`text-xs font-medium px-2.5 py-1 rounded-full ${colors.bg} ${colors.text}`}
                              >
                                {level}: {count}
                              </span>
                            );
                          },
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Gap Analysis Tab */}
          {activeTab === 'gaps' && (
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <AssessmentIcon /> Skill Gap Analysis
              </h2>
              {!gapAnalysis ? (
                <div className="text-center py-12 text-gray-500 dark:text-slate-400">
                  Loading gap analysis...
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
                    Comparing your skills against the department average for{' '}
                    <span className="font-medium text-gray-700 dark:text-slate-200">
                      {gapAnalysis.employee?.department || 'N/A'}
                    </span>
                  </p>

                  {gapAnalysis.gaps.length > 0 && (
                    <div className="mb-8">
                      <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide mb-3 flex items-center gap-1">
                        <TrendingDownIcon fontSize="small" /> Gaps (
                        {gapAnalysis.gaps.length})
                      </h3>
                      <div className="space-y-3">
                        {gapAnalysis.gaps.map((gap) => (
                          <div
                            key={gap.skillName}
                            className="bg-white dark:bg-slate-800 rounded-xl border border-red-200 dark:border-red-900/30 p-4"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="font-bold text-gray-900 dark:text-white">
                                  {gap.skillName}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-slate-400 ml-2">
                                  ({gap.category})
                                </span>
                              </div>
                              <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                                Gap: {gap.gapSize.toFixed(1)} levels
                              </span>
                            </div>
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-slate-400">
                              <span>
                                Your level:{' '}
                                <strong>
                                  {gap.employeeProficiency || 'Not assessed'}
                                </strong>
                              </span>
                              <span>
                                Dept avg:{' '}
                                <strong>{gap.departmentAvgProficiency}</strong>
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {gapAnalysis.strengths.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide mb-3 flex items-center gap-1">
                        <TrendingUpIcon fontSize="small" /> Strengths (
                        {gapAnalysis.strengths.length})
                      </h3>
                      <div className="space-y-3">
                        {gapAnalysis.strengths.map((str) => (
                          <div
                            key={str.skillName}
                            className="bg-white dark:bg-slate-800 rounded-xl border border-green-200 dark:border-green-900/30 p-4"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="font-bold text-gray-900 dark:text-white">
                                  {str.skillName}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-slate-400 ml-2">
                                  ({str.category})
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-slate-400">
                              <span>
                                Your level:{' '}
                                <strong>{str.employeeProficiency}</strong>
                              </span>
                              <span>
                                Dept avg:{' '}
                                <strong>{str.departmentAvgProficiency}</strong>
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {gapAnalysis.gaps.length === 0 &&
                    gapAnalysis.strengths.length === 0 && (
                      <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
                        <p className="text-gray-500 dark:text-slate-400">
                          No comparison data available. Add more skills to
                          enable gap analysis.
                        </p>
                      </div>
                    )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Add/Edit Skill Modal */}
        {showSkillForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 w-full max-w-lg p-6 shadow-xl">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                {editingSkill ? 'Edit Skill' : 'Add New Skill'}
              </h3>

              {formError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
                  {formError}
                </div>
              )}

              <form onSubmit={handleAddSkill} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Skill Name *
                  </label>
                  <input
                    type="text"
                    value={skillForm.skillName}
                    onChange={(e) =>
                      setSkillForm({ ...skillForm, skillName: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g. React, Project Management"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">
                      Category *
                    </label>
                    <select
                      value={skillForm.category}
                      onChange={(e) =>
                        setSkillForm({ ...skillForm, category: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">
                      Proficiency *
                    </label>
                    <select
                      value={skillForm.proficiency}
                      onChange={(e) =>
                        setSkillForm({
                          ...skillForm,
                          proficiency: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                    >
                      {PROFICIENCY_OPTIONS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">
                      Years of Experience
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={skillForm.yearsOfExperience}
                      onChange={(e) =>
                        setSkillForm({
                          ...skillForm,
                          yearsOfExperience: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">
                      Assessed By
                    </label>
                    <input
                      type="text"
                      value={skillForm.assessedBy}
                      onChange={(e) =>
                        setSkillForm({
                          ...skillForm,
                          assessedBy: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                      placeholder="e.g. Self, Manager Name"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={skillForm.notes}
                    onChange={(e) =>
                      setSkillForm({ ...skillForm, notes: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white resize-none"
                    rows={2}
                    placeholder="Optional notes about this skill assessment"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors"
                  >
                    {editingSkill ? 'Update Skill' : 'Add Skill'}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-6 py-2.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-300 font-medium rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
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
    purple:
      'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    green:
      'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    orange:
      'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
  };
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>{icon}</div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {value}
          </p>
          <p className="text-xs text-gray-500 dark:text-slate-400">{label}</p>
        </div>
      </div>
    </div>
  );
}
