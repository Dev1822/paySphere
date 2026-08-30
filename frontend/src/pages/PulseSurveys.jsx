import { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import PollIcon from '@mui/icons-material/Poll';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BarChartIcon from '@mui/icons-material/BarChart';
import SendIcon from '@mui/icons-material/Send';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
import StarIcon from '@mui/icons-material/Star';

const RATING_LABELS = { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Very Good', 5: 'Excellent' };

export default function PulseSurveys() {
  const [view, setView] = useState('manage');
  const [surveys, setSurveys] = useState([]);
  const [available, setAvailable] = useState([]);
  const [results, setResults] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Response form state
  const [respondingTo, setRespondingTo] = useState(null);
  const [answers, setAnswers] = useState({});

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '', description: '', questions: [makeEmptyQuestion()], targetDepartments: [],
  });
  const [formError, setFormError] = useState('');

  function makeEmptyQuestion() {
    return { text: '', type: 'rating', options: ['', ''], maxRating: 5 };
  }

  const fetchSurveys = useCallback(async () => {
    try { setLoading(true); const res = await api.get('/api/pulse-surveys/'); setSurveys(res.data.surveys || []); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  const fetchAvailable = useCallback(async () => {
    try { setLoading(true); const res = await api.get('/api/pulse-surveys/available/surveys'); setAvailable(res.data.surveys || []); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  const fetchResults = useCallback(async (id) => {
    try { const res = await api.get(`/api/pulse-surveys/${id}/results`); setResults(res.data); setSelectedId(id); }
    catch (err) { console.error(err); }
  }, []);

  useEffect(() => {
    if (view === 'manage') fetchSurveys();
    else if (view === 'respond') fetchAvailable();
  }, [view, fetchSurveys, fetchAvailable]);

  const handlePublish = async (id) => {
    try { await api.patch(`/api/pulse-surveys/${id}/publish`); fetchSurveys(); }
    catch (err) { console.error(err); }
  };

  const handleClose = async (id) => {
    try { await api.patch(`/api/pulse-surveys/${id}/close`); fetchSurveys(); }
    catch (err) { console.error(err); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this draft survey?')) return;
    try { await api.delete(`/api/pulse-surveys/${id}`); fetchSurveys(); }
    catch (err) { console.error(err); }
  };

  const handleSubmitResponse = async () => {
    if (!respondingTo) return;
    const answerList = Object.entries(answers).map(([qId, val]) => ({ questionId: qId, value: val }));
    try {
      await api.post(`/api/pulse-surveys/${respondingTo._id}/respond`, { answers: answerList });
      setRespondingTo(null);
      setAnswers({});
      fetchAvailable();
    } catch (err) { console.error(err); }
  };

  const handleCreateSurvey = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!createForm.title.trim()) { setFormError('Title is required'); return; }
    for (const q of createForm.questions) {
      if (!q.text.trim()) { setFormError('All questions need text'); return; }
      if (q.type === 'multiple_choice' && q.options.filter((o) => o.trim()).length < 2) {
        setFormError('Multiple choice needs at least 2 options'); return;
      }
    }
    const payload = {
      ...createForm,
      questions: createForm.questions.map((q) => ({
        text: q.text.trim(),
        type: q.type,
        maxRating: q.maxRating || 5,
        options: q.type === 'multiple_choice' ? q.options.filter((o) => o.trim()) : [],
      })),
    };
    try { await api.post('/api/pulse-surveys/', payload); setShowCreate(false); setCreateForm({ title: '', description: '', questions: [makeEmptyQuestion()], targetDepartments: [] }); fetchSurveys(); }
    catch (err) { setFormError(err.response?.data?.message || 'Failed to create survey'); }
  };

  const addQuestion = () => {
    if (createForm.questions.length >= 20) return;
    setCreateForm({ ...createForm, questions: [...createForm.questions, makeEmptyQuestion()] });
  };

  const updateQuestion = (idx, field, val) => {
    const updated = [...createForm.questions];
    updated[idx] = { ...updated[idx], [field]: val };
    setCreateForm({ ...createForm, questions: updated });
  };

  const removeQuestion = (idx) => {
    if (createForm.questions.length <= 1) return;
    setCreateForm({ ...createForm, questions: createForm.questions.filter((_, i) => i !== idx) });
  };

  const activeSurveys = surveys.filter((s) => s.status === 'active');
  const draftSurveys = surveys.filter((s) => s.status === 'draft');
  const closedSurveys = surveys.filter((s) => s.status === 'closed');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
      <Sidebar activePage="Pulse Surveys" setActivePage={() => {}} isSidebarOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:ml-64">
        <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <PollIcon className="text-violet-500" /> Pulse Surveys
            </h1>
          </div>
          <ThemeToggle />
        </div>

        <div className="p-4 lg:p-8">
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total" value={surveys.length} color="violet" />
            <StatCard label="Active" value={activeSurveys.length} color="green" />
            <StatCard label="Drafts" value={draftSurveys.length} color="amber" />
            <StatCard label="To Respond" value={available.length} color="blue" />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-slate-800 rounded-lg p-1 w-fit">
            {[
              { id: 'manage', label: 'Manage' },
              { id: 'respond', label: 'My Surveys' },
              { id: 'results', label: 'Results' },
            ].map((tab) => (
              <button key={tab.id} onClick={() => { setView(tab.id); setSelectedId(null); setResults(null); setRespondingTo(null); }}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${view === tab.id ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Manage View */}
          {view === 'manage' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">All Surveys</h2>
                <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg">
                  <AddCircleOutlineIcon fontSize="small" /> New Survey
                </button>
              </div>

              {loading ? <div className="text-center py-12 text-gray-500 dark:text-slate-400">Loading...</div>
              : surveys.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
                  <PollIcon className="text-4xl text-gray-300 dark:text-slate-600 mb-3" />
                  <p className="text-gray-500 dark:text-slate-400">No surveys yet. Create your first pulse survey!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {[
                    { label: 'Active', items: activeSurveys, border: 'border-green-200 dark:border-green-900/30' },
                    { label: 'Drafts', items: draftSurveys, border: 'border-amber-200 dark:border-amber-900/30' },
                    { label: 'Closed', items: closedSurveys, border: 'border-gray-200 dark:border-slate-700' },
                  ].filter((g) => g.items.length > 0).map((group) => (
                    <div key={group.label}>
                      <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2">{group.label}</h3>
                      <div className="space-y-2">
                        {group.items.map((survey) => (
                          <div key={survey._id} className={`bg-white dark:bg-slate-800 rounded-xl border ${group.border} p-4`}>
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-bold text-gray-900 dark:text-white">{survey.title}</h4>
                                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{survey.questionCount} questions · {survey.responseCount} responses</p>
                              </div>
                              <div className="flex items-center gap-1.5">
                                {survey.status === 'draft' && (
                                  <>
                                    <button onClick={() => handlePublish(survey._id)} title="Publish" className="p-1.5 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 dark:text-green-400"><PlayArrowIcon fontSize="small" /></button>
                                    <button onClick={() => handleDelete(survey._id)} title="Delete" className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"><DeleteOutlineIcon fontSize="small" /></button>
                                  </>
                                )}
                                {survey.status === 'active' && (
                                  <button onClick={() => handleClose(survey._id)} title="Close" className="p-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-600 dark:text-amber-400"><StopIcon fontSize="small" /></button>
                                )}
                                <button onClick={() => { fetchResults(survey._id); setView('results'); }} title="Results" className="p-1.5 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/20 text-violet-600 dark:text-violet-400"><BarChartIcon fontSize="small" /></button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Respond View */}
          {view === 'respond' && (
            <div>
              {respondingTo ? (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
                  <button onClick={() => { setRespondingTo(null); setAnswers({}); }} className="text-sm text-violet-600 dark:text-violet-400 hover:underline mb-4">← Back to surveys</button>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{respondingTo.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">{respondingTo.questions?.length || 0} questions · Your responses are anonymous</p>
                  <div className="space-y-6">
                    {respondingTo.questions?.map((q, idx) => (
                      <div key={q._id} className="border-b border-gray-100 dark:border-slate-700 pb-4">
                        <p className="font-semibold text-gray-900 dark:text-white mb-3">{idx + 1}. {q.text}</p>
                        {q.type === 'rating' && (
                          <div className="flex gap-2">
                            {Array.from({ length: q.maxRating || 5 }, (_, i) => i + 1).map((n) => (
                              <button key={n} onClick={() => setAnswers({ ...answers, [q._id]: n })}
                                className={`flex flex-col items-center p-3 rounded-lg border transition-colors ${answers[q._id] === n ? 'bg-violet-100 dark:bg-violet-900/30 border-violet-400 dark:border-violet-600' : 'bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-700 hover:border-violet-300'}`}>
                                <StarIcon className={answers[q._id] === n ? 'text-violet-600 dark:text-violet-400' : 'text-gray-400 dark:text-slate-500'} />
                                <span className="text-xs mt-1 text-gray-600 dark:text-slate-300">{n}</span>
                                {RATING_LABELS[n] && <span className="text-[10px] text-gray-400 dark:text-slate-500">{RATING_LABELS[n]}</span>}
                              </button>
                            ))}
                          </div>
                        )}
                        {q.type === 'yes_no' && (
                          <div className="flex gap-3">
                            {['Yes', 'No'].map((opt) => (
                              <button key={opt} onClick={() => setAnswers({ ...answers, [q._id]: opt })}
                                className={`px-6 py-2 rounded-lg border text-sm font-medium transition-colors ${answers[q._id] === opt ? 'bg-violet-100 dark:bg-violet-900/30 border-violet-400 dark:border-violet-600 text-violet-700 dark:text-violet-300' : 'bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-violet-300'}`}>
                                {opt}
                              </button>
                            ))}
                          </div>
                        )}
                        {q.type === 'multiple_choice' && (
                          <div className="space-y-2">
                            {q.options?.filter(Boolean).map((opt) => (
                              <button key={opt} onClick={() => setAnswers({ ...answers, [q._id]: opt })}
                                className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-colors ${answers[q._id] === opt ? 'bg-violet-100 dark:bg-violet-900/30 border-violet-400 dark:border-violet-600 text-violet-700 dark:text-violet-300' : 'bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-violet-300'}`}>
                                <RadioButtonCheckedIcon fontSize="small" className="mr-2" />{opt}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <button onClick={handleSubmitResponse}
                    disabled={Object.keys(answers).length < (respondingTo.questions?.length || 0)}
                    className="mt-6 flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 dark:disabled:bg-slate-600 text-white font-bold rounded-lg transition-colors">
                    <SendIcon fontSize="small" /> Submit Response
                  </button>
                </div>
              ) : (
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Surveys Awaiting Your Response</h2>
                  {loading ? <div className="text-center py-12 text-gray-500 dark:text-slate-400">Loading...</div>
                  : available.length === 0 ? (
                    <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
                      <CheckCircleIcon className="text-4xl text-green-400 mb-3" />
                      <p className="text-gray-500 dark:text-slate-400">All caught up! No pending surveys.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {available.map((survey) => (
                        <div key={survey._id} className="bg-white dark:bg-slate-800 rounded-xl border border-violet-200 dark:border-violet-900/30 p-4 hover:border-violet-400 dark:hover:border-violet-700 cursor-pointer transition-colors"
                          onClick={() => { setRespondingTo(survey); setAnswers({}); }}>
                          <h3 className="font-bold text-gray-900 dark:text-white">{survey.title}</h3>
                          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{survey.questions?.length || 0} questions · {survey.description || 'No description'}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Results View */}
          {view === 'results' && (
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <BarChartIcon /> Survey Results
              </h2>
              {!results ? (
                <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
                  <p className="text-gray-500 dark:text-slate-400">Select a survey from the Manage tab to view results.</p>
                </div>
              ) : (
                <div>
                  <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 mb-6">
                    <h3 className="font-bold text-gray-900 dark:text-white">{results.survey.title}</h3>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-slate-400">
                      <span>{results.stats.responseCount}/{results.stats.totalEmployees} responses ({results.stats.responseRate}%)</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${results.survey.status === 'active' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400'}`}>
                        {results.survey.status}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {results.results.map((q, idx) => (
                      <div key={q.questionId} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
                        <p className="font-bold text-gray-900 dark:text-white mb-3">{idx + 1}. {q.text}</p>
                        {q.type === 'rating' && (
                          <div>
                            <div className="flex items-baseline gap-3 mb-3">
                              <span className="text-3xl font-bold text-violet-600 dark:text-violet-400">{q.average}</span>
                              <span className="text-sm text-gray-500 dark:text-slate-400">avg of {q.totalAnswers} ratings (median: {q.median})</span>
                            </div>
                            <div className="space-y-1.5">
                              {Object.entries(q.distribution).reverse().map(([rating, count]) => {
                                const pct = q.totalAnswers > 0 ? Math.round((count / q.totalAnswers) * 100) : 0;
                                return (
                                  <div key={rating} className="flex items-center gap-2">
                                    <span className="text-xs w-4 text-right text-gray-500 dark:text-slate-400">{rating}</span>
                                    <div className="flex-1 bg-gray-100 dark:bg-slate-700 rounded-full h-3">
                                      <div className="h-3 rounded-full bg-violet-500" style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="text-xs text-gray-500 dark:text-slate-400 w-12">{count} ({pct}%)</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {(q.type === 'multiple_choice' || q.type === 'yes_no') && (
                          <div className="space-y-2">
                            {Object.entries(q.counts).map(([opt, count]) => {
                              const pct = q.totalAnswers > 0 ? Math.round((count / q.totalAnswers) * 100) : 0;
                              return (
                                <div key={opt} className="flex items-center gap-3">
                                  <span className="text-sm text-gray-700 dark:text-slate-300 w-32 truncate">{opt}</span>
                                  <div className="flex-1 bg-gray-100 dark:bg-slate-700 rounded-full h-3">
                                    <div className="h-3 rounded-full bg-violet-500" style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="text-xs text-gray-500 dark:text-slate-400 w-16">{count} ({pct}%)</span>
                                </div>
                              );
                            })}
                            {q.topOption && <p className="text-sm font-medium text-violet-600 dark:text-violet-400 mt-1">Top choice: {q.topOption}</p>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Create Modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 w-full max-w-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Create Pulse Survey</h3>
              {formError && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">{formError}</div>}
              <form onSubmit={handleCreateSurvey} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Title *</label>
                  <input type="text" value={createForm.title} onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent" required />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Description</label>
                  <input type="text" value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-gray-700 dark:text-slate-300">Questions</label>
                    <button type="button" onClick={addQuestion} className="text-xs text-violet-600 dark:text-violet-400 hover:underline">+ Add Question</button>
                  </div>
                  {createForm.questions.map((q, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500 dark:text-slate-400">Q{idx + 1}</span>
                        {createForm.questions.length > 1 && (
                          <button type="button" onClick={() => removeQuestion(idx)} className="text-xs text-red-500 hover:underline">Remove</button>
                        )}
                      </div>
                      <input type="text" value={q.text} onChange={(e) => updateQuestion(idx, 'text', e.target.value)}
                        placeholder="Question text" className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white text-sm" />
                      <div className="flex gap-2">
                        <select value={q.type} onChange={(e) => updateQuestion(idx, 'type', e.target.value)}
                          className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white text-sm">
                          <option value="rating">Rating (1-5)</option>
                          <option value="multiple_choice">Multiple Choice</option>
                          <option value="yes_no">Yes / No</option>
                        </select>
                        {q.type === 'multiple_choice' && (
                          <input type="text" value={q.options.join(', ')}
                            onChange={(e) => updateQuestion(idx, 'options', e.target.value.split(',').map((s) => s.trim()))}
                            placeholder="Option 1, Option 2, ..." className="flex-1 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white text-sm" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="submit" className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-lg transition-colors">Create Survey</button>
                  <button type="button" onClick={() => { setShowCreate(false); setFormError(''); }} className="px-6 py-2.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-300 font-medium rounded-lg">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  const bg = { violet: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400', green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400', amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400', blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' };
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs text-gray-500 dark:text-slate-400">{label}</p>
    </div>
  );
}
