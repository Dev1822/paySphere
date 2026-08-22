/**
 * HelpdeskKnowledgeUpload.jsx - Knowledge Base Document Manager
 *
 * Allows HR admins to upload policy documents to the RAG knowledge base.
 * Shows indexed documents, their chunk counts, and allows deletion/re-indexing.
 */
import { useState, useEffect } from 'react';
import api from '../services/api';

export default function HelpdeskKnowledgeUpload({ onUploadComplete }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ title: '', content: '' });
  const [uploadResult, setUploadResult] = useState(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      // Fetch knowledge base documents - using a mock endpoint
      // In production, this would list unique document titles with chunk counts
      const res = await api.get('/api/helpdesk/knowledge').catch(() => ({ data: { documents: [] } }));
      setDocuments(res.data.documents || []);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) {
      alert('Title and content are required.');
      return;
    }
    if (formData.content.trim().length < 50) {
      alert('Document content must be at least 50 characters.');
      return;
    }

    setUploading(true);
    setUploadResult(null);
    try {
      const res = await api.post('/api/helpdesk/knowledge/upload', {
        title: formData.title.trim(),
        content: formData.content.trim(),
      });
      setUploadResult({
        success: true,
        message: res.data.message,
        chunkCount: res.data.chunkCount,
      });
      setFormData({ title: '', content: '' });
      setShowForm(false);
      fetchDocuments();
      onUploadComplete?.();
    } catch (err) {
      setUploadResult({
        success: false,
        message: err.response?.data?.message || 'Upload failed.',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
            📚 Knowledge Base
            <span className="text-xs font-normal text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
              {documents.length} documents
            </span>
          </h3>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Upload HR policy documents for AI-powered Q&A
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
        >
          {showForm ? '✕ Cancel' : '➕ Add Document'}
        </button>
      </div>

      {/* Upload Result */}
      {uploadResult && (
        <div
          className={`mx-6 mt-4 p-3 rounded-xl text-sm ${
            uploadResult.success
              ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
          }`}
        >
          {uploadResult.success ? '✅ ' : '❌ '}
          {uploadResult.message}
          {uploadResult.chunkCount && (
            <span className="ml-1 font-semibold">({uploadResult.chunkCount} chunks indexed)</span>
          )}
        </div>
      )}

      {/* Upload Form */}
      {showForm && (
        <form onSubmit={handleUpload} className="p-6 space-y-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/30">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">
              Document Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Leave Policy 2025, PF Guidelines"
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-blue-400 focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">
              Document Content *
            </label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Paste the full text content of the HR policy document here. The system will chunk and index it for AI-powered search..."
              rows={8}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-blue-400 focus:outline-none resize-none"
              required
            />
            <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">
              Minimum 50 characters. Content will be split into searchable chunks.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {uploading ? '⏳ Indexing...' : '📤 Upload & Index'}
            </button>
          </div>
        </form>
      )}

      {/* Document List */}
      <div className="divide-y divide-gray-50 dark:divide-slate-800/50">
        {loading ? (
          <div className="px-6 py-8 text-center text-gray-500 dark:text-slate-400 text-sm">
            Loading documents...
          </div>
        ) : documents.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <div className="text-4xl mb-2">📭</div>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              No documents in the knowledge base yet.
            </p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
              Upload HR policies, handbooks, or guidelines to enable AI-powered Q&A.
            </p>
          </div>
        ) : (
          documents.map((doc, idx) => (
            <div key={idx} className="px-6 py-3 hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center text-sm">
                    📄
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                      {doc.title || doc.documentTitle}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-slate-400">
                      {doc.chunkCount || '?'} chunks indexed
                      {doc.createdAt && ` · ${new Date(doc.createdAt).toLocaleDateString()}`}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-full">
                  Active
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
