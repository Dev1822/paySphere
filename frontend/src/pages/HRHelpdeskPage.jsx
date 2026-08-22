/**
 * HRHelpdeskPage.jsx - HR Helpdesk & Knowledge Base
 *
 * Main page for the HR Helpdesk feature. Integrates:
 *   - AI-powered chat for employee Q&A (RAG search)
 *   - Knowledge base document management (HR admins)
 *   - Escalated ticket management
 *
 * Registered in navigation.js under 'workplace' group at /helpdesk.
 */
import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import HRHelpdeskChat from '../components/HRHelpdeskChat';
import HelpdeskKnowledgeUpload from '../components/HelpdeskKnowledgeUpload';
import HelpdeskTicketList from '../components/HelpdeskTicketList';

const TABS = [
  { id: 'chat', label: 'Ask HR', icon: '💬' },
  { id: 'knowledge', label: 'Knowledge Base', icon: '📚', adminOnly: true },
  { id: 'tickets', label: 'Tickets', icon: '🎫' },
];

export default function HRHelpdeskPage() {
  const [activeTab, setActiveTab] = useState('chat');
  const [ticketRefresh, setTicketRefresh] = useState(0);

  const handleEscalate = () => {
    setTicketRefresh((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
      <Helmet>
        <title>HR Helpdesk — PaySphere</title>
      </Helmet>
      <Sidebar activePage="Helpdesk" setActivePage={() => {}} isSidebarOpen={false} onClose={() => {}} />

      <div className="lg:ml-64">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              🎓 HR Helpdesk
            </h1>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              AI-powered HR knowledge base & support tickets
            </p>
          </div>
          <ThemeToggle />
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 lg:px-8">
          <div className="flex gap-1 -mb-px overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                    : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:border-gray-300'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 lg:p-8">
          {/* Chat Tab */}
          {activeTab === 'chat' && (
            <div className="max-w-3xl mx-auto" style={{ height: 'calc(100vh - 180px)' }}>
              <HRHelpdeskChat onEscalate={handleEscalate} />
            </div>
          )}

          {/* Knowledge Base Tab (Admin) */}
          {activeTab === 'knowledge' && (
            <div className="max-w-3xl mx-auto">
              <HelpdeskKnowledgeUpload onUploadComplete={() => setTicketRefresh((p) => p + 1)} />
            </div>
          )}

          {/* Tickets Tab */}
          {activeTab === 'tickets' && (
            <div className="max-w-4xl mx-auto">
              <HelpdeskTicketList refreshTrigger={ticketRefresh} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
