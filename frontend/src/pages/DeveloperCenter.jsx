import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import LanguageSwitcher from '../components/LanguageSwitcher';
import api from '../services/api';
import { formatCurrency, formatDate } from '../utils/formatLocale';
import toast from 'react-hot-toast';

export default function DeveloperCenter() {
  const { t } = useTranslation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('API Keys');
  const companyName = localStorage.getItem('companyName') || 'PaySphere';

  const [apiKeys, setApiKeys] = useState([]);
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);

  // New API Key form state
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState(['employee:read']);
  const [generatedKey, setGeneratedKey] = useState(null);

  // New Webhook form state
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookEvents, setWebhookEvents] = useState(['EMPLOYEE_CREATE']);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [keysRes, hooksRes] = await Promise.all([
        api.get('/api/api-keys'),
        api.get('/api/webhooks'),
      ]);
      setApiKeys(keysRes.data || []);
      setWebhooks(hooksRes.data || []);
    } catch (error) {
      console.error('Failed to fetch developer data:', error);
      toast.error('Failed to load developer center data');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateKey = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/api/api-keys', {
        name: newKeyName,
        scopes: newKeyScopes,
      });
      setGeneratedKey(res.data.rawKey);
      setNewKeyName('');
      fetchData();
    } catch (error) {
      toast.error('Failed to generate API Key');
    }
  };

  const handleRevokeKey = async (id) => {
    if (
      !window.confirm(
        'Are you sure you want to revoke this API key? This will break any integrations using it.',
      )
    )
      return;
    try {
      await api.delete(`/api/api-keys/${id}`);
      toast.success('API Key revoked');
      fetchData();
    } catch (error) {
      toast.error('Failed to revoke API Key');
    }
  };

  const handleCreateWebhook = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/webhooks', {
        url: webhookUrl,
        subscribedEvents: webhookEvents,
        description: 'Created from UI',
      });
      toast.success('Webhook created');
      setShowWebhookModal(false);
      setWebhookUrl('');
      fetchData();
    } catch (error) {
      toast.error('Failed to create webhook');
    }
  };

  const handleRegenerateSecret = async (id) => {
    if (
      !window.confirm(
        'Are you sure you want to regenerate the signing secret? You will need to update the receiving system.',
      )
    )
      return;
    try {
      const res = await api.post(`/api/webhooks/${id}/regenerate-secret`);
      toast.success('Secret regenerated');
      // Show secret in alert once
      alert(
        `New Webhook Secret:\n\n${res.data.signingSecret || res.data.secret}\n\nPlease copy this now, you will not see it again.`,
      );
      fetchData();
    } catch (error) {
      toast.error('Failed to regenerate secret');
    }
  };

  const handleDeleteWebhook = async (id) => {
    if (!window.confirm('Are you sure you want to delete this webhook?'))
      return;
    try {
      await api.delete(`/api/webhooks/${id}`);
      toast.success('Webhook deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete webhook');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      <Helmet>
        <title>Developer Center | PaySphere</title>
      </Helmet>

      <Sidebar
        companyName={companyName}
        activePage="Developer"
        setActivePage={() => {}}
        isSidebarOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <header className="h-16 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 sm:px-6 md:ml-56 flex items-center justify-between sticky top-0 z-30 transition-colors">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="md:hidden p-2 -ml-2 text-gray-600 dark:text-slate-300 rounded-lg"
          >
            ☰
          </button>
          <span className="font-bold text-xl text-blue-600 dark:text-blue-400">
            Developer Center
          </span>
        </div>
        <div className="flex items-center gap-4">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 w-full md:w-[calc(100%-14rem)] md:ml-56 p-4 sm:p-8 space-y-8">
        {/* Tabs */}
        <div className="flex space-x-1 border-b border-gray-200 dark:border-slate-800 mb-6 overflow-x-auto">
          {['API Keys', 'Webhooks'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-bold whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'API Keys' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">API Keys</h2>
              <button
                onClick={() => setShowKeyModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition"
              >
                + Generate New Key
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-800 text-gray-400 dark:text-slate-400 uppercase text-xs">
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Prefix</th>
                    <th className="py-3 px-4">Created</th>
                    <th className="py-3 px-4">Last Used</th>
                    <th className="py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                  {apiKeys.map((key) => (
                    <tr
                      key={key._id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
                    >
                      <td className="py-4 px-4 font-semibold">{key.name}</td>
                      <td className="py-4 px-4 font-mono text-gray-500">
                        {key.prefix}••••••••
                      </td>
                      <td className="py-4 px-4">{formatDate(key.createdAt)}</td>
                      <td className="py-4 px-4">
                        {key.lastUsedAt ? formatDate(key.lastUsedAt) : 'Never'}
                      </td>
                      <td className="py-4 px-4">
                        <button
                          onClick={() => handleRevokeKey(key._id)}
                          className="text-red-500 hover:text-red-700 font-semibold text-xs uppercase"
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                  {apiKeys.length === 0 && (
                    <tr>
                      <td
                        colSpan="5"
                        className="py-8 text-center text-gray-500"
                      >
                        No active API keys found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <h3 className="font-bold mb-2">How to use your API key</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Include your API key in the Authorization header of your
                requests. Keep your key secure and never expose it in
                client-side code.
              </p>
              <pre className="bg-slate-900 text-slate-100 p-3 rounded text-sm overflow-x-auto">
                curl -H "Authorization: Bearer ps_your_api_key_here"
                https://api.paysphere.com/api/employees
              </pre>
            </div>
          </div>
        )}

        {activeTab === 'Webhooks' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Webhooks</h2>
              <button
                onClick={() => setShowWebhookModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition"
              >
                + Add Endpoint
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-800 text-gray-400 dark:text-slate-400 uppercase text-xs">
                    <th className="py-3 px-4">URL</th>
                    <th className="py-3 px-4">Events</th>
                    <th className="py-3 px-4">Signing Secret</th>
                    <th className="py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                  {webhooks.map((hook) => (
                    <tr
                      key={hook._id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
                    >
                      <td
                        className="py-4 px-4 font-semibold max-w-[200px] truncate"
                        title={hook.url}
                      >
                        {hook.url}
                      </td>
                      <td className="py-4 px-4">
                        <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs">
                          {hook.subscribedEvents.length} events
                        </span>
                      </td>
                      <td className="py-4 px-4 font-mono text-gray-500">
                        {hook.signingSecret || hook.secret}
                      </td>
                      <td className="py-4 px-4 flex gap-3">
                        <button
                          onClick={() => handleRegenerateSecret(hook._id)}
                          className="text-blue-600 hover:text-blue-800 font-semibold text-xs uppercase"
                        >
                          Rotate Secret
                        </button>
                        <button
                          onClick={() => handleDeleteWebhook(hook._id)}
                          className="text-red-500 hover:text-red-700 font-semibold text-xs uppercase"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {webhooks.length === 0 && (
                    <tr>
                      <td
                        colSpan="4"
                        className="py-8 text-center text-gray-500"
                      >
                        No webhooks configured.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <h3 className="font-bold mb-2">Verifying Webhook Signatures</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                PaySphere signs webhook events using HMAC SHA-256 with your
                signing secret. Verify the signature in the{' '}
                <code>X-PaySphere-Signature</code> header.
              </p>
              <pre className="bg-slate-900 text-slate-100 p-3 rounded text-sm overflow-x-auto">
                {`const crypto = require('crypto');
const signature = crypto
  .createHmac('sha256', process.env.PAYSPHERE_SIGNING_SECRET)
  .update(JSON.stringify(request.body))
  .digest('hex');

if (\`sha256=\${signature}\` === request.headers['x-paysphere-signature']) {
  // Payload is valid
}`}
              </pre>
            </div>
          </div>
        )}
      </main>

      {/* API Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Generate API Key</h3>
            {generatedKey ? (
              <div className="space-y-4">
                <div className="p-4 bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded border border-green-200 dark:border-green-800">
                  <p className="font-bold mb-2">Key Generated Successfully</p>
                  <p className="text-sm mb-4">
                    Please copy this key now. You will not be able to see it
                    again.
                  </p>
                  <code className="block p-3 bg-white dark:bg-slate-950 rounded border border-green-200 dark:border-green-800 break-all select-all">
                    {generatedKey}
                  </code>
                </div>
                <button
                  onClick={() => {
                    setShowKeyModal(false);
                    setGeneratedKey(null);
                  }}
                  className="w-full py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white rounded-lg font-semibold"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleGenerateKey}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold mb-1">
                      Key Name
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="e.g., ERP Integration"
                    />
                  </div>
                  <div className="flex gap-2 justify-end mt-6">
                    <button
                      type="button"
                      onClick={() => setShowKeyModal(false)}
                      className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-400"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
                    >
                      Generate
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Webhook Modal */}
      {showWebhookModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Add Webhook Endpoint</h3>
            <form onSubmit={handleCreateWebhook}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">
                    Endpoint URL
                  </label>
                  <input
                    type="url"
                    required
                    className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://api.yourcompany.com/webhooks"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">
                    Events
                  </label>
                  <select
                    multiple
                    required
                    className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 h-32"
                    value={webhookEvents}
                    onChange={(e) =>
                      setWebhookEvents(
                        Array.from(
                          e.target.selectedOptions,
                          (option) => option.value,
                        ),
                      )
                    }
                  >
                    <option value="EMPLOYEE_CREATE">EMPLOYEE_CREATE</option>
                    <option value="EMPLOYEE_UPDATE">EMPLOYEE_UPDATE</option>
                    <option value="EMPLOYEE_DELETE">EMPLOYEE_DELETE</option>
                    <option value="PAYROLL_FINALIZE">PAYROLL_FINALIZE</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    Hold Ctrl/Cmd to select multiple
                  </p>
                </div>
                <div className="flex gap-2 justify-end mt-6">
                  <button
                    type="button"
                    onClick={() => setShowWebhookModal(false)}
                    className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
                  >
                    Create Webhook
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
