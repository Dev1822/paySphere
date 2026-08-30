import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import Handlebars from 'handlebars';
import DescriptionIcon from '@mui/icons-material/Description';

export default function LetterTemplateManager() {
  const [templates, setTemplates] = useState([]);
  const [activeTemplate, setActiveTemplate] = useState(null);
  const [editorHtml, setEditorHtml] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [error, setError] = useState(null);

  // Dummy data for preview
  const previewContext = {
    employee: {
      fullName: 'John Doe',
      role: 'Software Engineer',
      pan: 'ABCDE1234F',
      grossSalary: 1200000,
    },
    meta: { effectiveDate: '2026-09-01', signingBonus: 50000 },
    company: { name: 'PaySphere Inc.' },
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await api.get('/api/templates');
      setTemplates(res.data);
      if (res.data.length > 0 && !activeTemplate) {
        handleSelectTemplate(res.data[0]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectTemplate = (template) => {
    setActiveTemplate(template);
    setEditorHtml(template.bodyHtml);
    updatePreview(template.bodyHtml);
    setError(null);
  };

  const updatePreview = (html) => {
    try {
      const template = Handlebars.compile(html, { strict: false });
      setPreviewHtml(template(previewContext));
      setError(null);
    } catch (err) {
      setError('Invalid Handlebars Syntax: ' + err.message);
    }
  };

  const handleEditorChange = (e) => {
    setEditorHtml(e.target.value);
    updatePreview(e.target.value);
  };

  const handleSave = async () => {
    if (error) return alert('Cannot save with invalid syntax');
    if (!activeTemplate) return;

    try {
      const res = await api.put(`/api/templates/${activeTemplate._id}`, {
        bodyHtml: editorHtml,
      });
      alert('Saved successfully!');
      fetchTemplates();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const handleCreateNew = async () => {
    const name = prompt('Template Name:');
    if (!name) return;
    try {
      const res = await api.post('/api/templates', {
        name,
        type: 'Other',
        bodyHtml: '<h1>New Template</h1>\n<p>Dear {{employee.fullName}},</p>',
      });
      fetchTemplates();
      handleSelectTemplate(res.data);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
      <Sidebar
        activePage="Letter Templates"
        setActivePage={() => {}}
        isSidebarOpen={false}
        onClose={() => {}}
      />
      <div className="lg:ml-64">
        <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <DescriptionIcon /> Document Templates
          </h1>
          <ThemeToggle />
        </div>

        <div className="flex flex-col md:flex-row h-[calc(100vh-80px)]">
          {/* Sidebar / List */}
          <div className="w-full md:w-1/4 bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 overflow-y-auto">
            <div className="p-4 border-b border-gray-200 dark:border-slate-700">
              <button
                onClick={handleCreateNew}
                className="w-full bg-brand-600 text-white rounded py-2 font-bold hover:bg-brand-700"
              >
                + New Template
              </button>
            </div>
            {templates.map((t) => (
              <div
                key={t._id}
                onClick={() => handleSelectTemplate(t)}
                className={`p-4 cursor-pointer border-b border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 ${activeTemplate?._id === t._id ? 'bg-gray-100 dark:bg-slate-700 font-bold' : ''}`}
              >
                <div className="text-sm dark:text-white">{t.name}</div>
                <div className="text-xs text-gray-500">{t.type}</div>
              </div>
            ))}

            <div className="p-4 mt-8 border-t border-gray-200 dark:border-slate-700">
              <h3 className="font-bold text-sm mb-2 dark:text-white">
                Variable Palette
              </h3>
              <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 font-mono">
                <li>{`{{employee.fullName}}`}</li>
                <li>{`{{employee.role}}`}</li>
                <li>{`{{employee.grossSalary}}`}</li>
                <li>{`{{meta.effectiveDate}}`}</li>
                <li>{`{{meta.signingBonus}}`}</li>
                <li>{`{{company.name}}`}</li>
              </ul>
            </div>
          </div>

          {/* Editor */}
          <div className="w-full md:w-1/2 flex flex-col">
            <div className="flex-1 p-4 flex flex-col">
              <div className="flex justify-between mb-2 items-center">
                <span className="font-bold text-sm dark:text-white">
                  HTML Editor
                </span>
                {error && (
                  <span className="text-red-500 text-xs font-bold">
                    {error}
                  </span>
                )}
              </div>
              <textarea
                className="flex-1 w-full p-4 font-mono text-sm border rounded bg-gray-50 dark:bg-slate-900 dark:text-white dark:border-slate-700 resize-none"
                value={editorHtml}
                onChange={handleEditorChange}
              />
            </div>
            <div className="p-4 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700">
              <button
                onClick={handleSave}
                className="bg-brand-600 text-white px-4 py-2 rounded font-bold hover:bg-brand-700"
              >
                Save Template
              </button>
            </div>
          </div>

          {/* Preview */}
          <div className="w-full md:w-1/4 bg-gray-100 dark:bg-slate-900 border-l border-gray-200 dark:border-slate-700 p-4 overflow-y-auto">
            <div className="font-bold text-sm mb-4 dark:text-white">
              Live Preview
            </div>
            <div
              className="bg-white text-black p-4 shadow-sm min-h-[500px] prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
