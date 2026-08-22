/**
 * WorkflowBuilder.jsx - Visual Workflow Builder
 *
 * Full-featured drag-and-drop workflow editor for creating multi-stage
 * approval chains. Uses @xyflow/react for the canvas.
 *
 * Features:
 *   - Drag nodes from a palette onto the canvas
 *   - Connect nodes with animated edges
 *   - Configure node properties (role, condition, template)
 *   - Save workflow definitions to the backend
 *   - Test workflows with a built-in simulation panel
 *   - Load existing workflows for editing
 */
import { useState, useCallback, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  addEdge,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import api from '../services/api';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import WorkflowNodeCard from '../components/WorkflowNodeCard';
import WorkflowEdge from '../components/WorkflowEdge';
import WorkflowPreview from '../components/WorkflowPreview';

// ---------------------------------------------------------------------------
// Node & edge type registration
// ---------------------------------------------------------------------------

const nodeTypes = { workflowNode: WorkflowNodeCard };
const edgeTypes = { workflowEdge: WorkflowEdge };

// ---------------------------------------------------------------------------
// Palette node definitions
// ---------------------------------------------------------------------------

const PALETTE_NODES = [
  {
    nodeType: 'trigger',
    label: 'Trigger',
    icon: '⚡',
    description: 'Entry point — when a request is raised',
    color: 'from-violet-500 to-purple-600',
    defaults: { entityType: 'PayrollUpdate' },
  },
  {
    nodeType: 'approval',
    label: 'Approval',
    icon: '✅',
    description: 'Role-based sign-off step',
    color: 'from-blue-500 to-indigo-600',
    defaults: { roleName: '', escalationHours: 24 },
  },
  {
    nodeType: 'condition',
    label: 'Condition',
    icon: '🔀',
    description: 'Branch based on expression',
    color: 'from-amber-500 to-orange-600',
    defaults: { conditionExpr: '' },
  },
  {
    nodeType: 'notification',
    label: 'Notify',
    icon: '🔔',
    description: 'Send notification to stakeholders',
    color: 'from-emerald-500 to-teal-600',
    defaults: { template: '' },
  },
  {
    nodeType: 'end',
    label: 'End',
    icon: '🏁',
    description: 'Terminal node — workflow complete',
    color: 'from-gray-500 to-slate-600',
    defaults: {},
  },
];

// ---------------------------------------------------------------------------
// Available roles for approval nodes
// ---------------------------------------------------------------------------

const AVAILABLE_ROLES = [
  'HR', 'Finance', 'CFO', 'CEO', 'Manager', 'Legal', 'Compliance',
  'Department Head', 'VP Engineering', 'VP Sales', 'Admin',
];

// ---------------------------------------------------------------------------
// WorkflowBuilder inner component (needs ReactFlowProvider context)
// ---------------------------------------------------------------------------

function WorkflowBuilderInner() {
  const reactFlowWrapper = useRef(null);
  const { screenToFlowPosition } = useReactFlow();

  // ── State ──────────────────────────────────────────────────────────────
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showProperties, setShowProperties] = useState(true);
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savedWorkflows, setSavedWorkflows] = useState([]);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [darkMode, setDarkMode] = useState(
    document.documentElement.classList.contains('dark')
  );

  let nextNodeId = useRef(1);

  // ── Edge connection handler ─────────────────────────────────────────────
  const onConnect = useCallback(
    (params) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: 'workflowEdge',
            animated: true,
            style: { strokeWidth: 2 },
            data: {},
          },
          eds
        )
      );
    },
    [setEdges]
  );

  // ── Node selection ──────────────────────────────────────────────────────
  const onNodeClick = useCallback((_, node) => {
    setSelectedNode(node);
    setShowProperties(true);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // ── Delete node ─────────────────────────────────────────────────────────
  const deleteNode = useCallback(
    (nodeId) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) =>
        eds.filter((e) => e.source !== nodeId && e.target !== nodeId)
      );
      setSelectedNode(null);
    },
    [setNodes, setEdges]
  );

  // ── Update selected node properties ─────────────────────────────────────
  const updateNodeData = useCallback(
    (field, value) => {
      if (!selectedNode) return;
      const nodeId = selectedNode.id;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, [field]: value } } : n
        )
      );
      setSelectedNode((prev) =>
        prev ? { ...prev, data: { ...prev.data, [field]: value } } : prev
      );
    },
    [selectedNode, setNodes]
  );

  // ── Drag from palette ───────────────────────────────────────────────────
  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      const rawData = event.dataTransfer.getData('application/reactflow');
      if (!rawData) return;

      const paletteItem = JSON.parse(rawData);
      const id = 'node_' + (nextNodeId.current++);
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode = {
        id,
        type: 'workflowNode',
        position,
        data: {
          id,
          nodeType: paletteItem.nodeType,
          label: paletteItem.label,
          ...paletteItem.defaults,
        },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [screenToFlowPosition, setNodes]
  );

  // ── Save workflow ───────────────────────────────────────────────────────
  const saveWorkflow = async () => {
    if (!workflowName.trim()) {
      alert('Please enter a workflow name.');
      return;
    }
    if (nodes.length === 0) {
      alert('Please add at least one node.');
      return;
    }

    setSaving(true);
    try {
      const flowNodes = nodes.map((n) => ({
        id: n.id,
        type: n.data.nodeType,
        data: { ...n.data },
      }));

      const flowEdges = edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label || '',
      }));

      await api.post('/api/workflows', {
        name: workflowName,
        description: workflowDescription,
        nodes: flowNodes,
        edges: flowEdges,
      });

      alert('Workflow saved successfully!');
    } catch (err) {
      console.error('Save failed:', err);
      alert('Failed to save workflow: ' + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  // ── Load existing workflows ─────────────────────────────────────────────
  const loadWorkflows = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/workflows');
      setSavedWorkflows(res.data.workflows || res.data || []);
      setShowLoadModal(true);
    } catch (err) {
      console.error('Load failed:', err);
      alert('Failed to load workflows.');
    } finally {
      setLoading(false);
    }
  };

  const loadWorkflow = (workflow) => {
    const flowNodes = (workflow.nodes || []).map((n) => ({
      id: n.id,
      type: 'workflowNode',
      position: { x: 250, y: 100 },
      data: { id: n.id, nodeType: n.type, label: n.type, ...n.data },
    }));

    const flowEdges = (workflow.edges || []).map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label || '',
      type: 'workflowEdge',
      animated: true,
    }));

    setNodes(flowNodes);
    setEdges(flowEdges);
    setWorkflowName(workflow.name || '');
    setWorkflowDescription(workflow.description || '');
    setShowLoadModal(false);
  };

  // ── Clear canvas ────────────────────────────────────────────────────────
  const clearCanvas = () => {
    if (nodes.length > 0 && !confirm('Clear the canvas? This cannot be undone.')) return;
    setNodes([]);
    setEdges([]);
    setSelectedNode(null);
    setWorkflowName('');
    setWorkflowDescription('');
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
      <Sidebar activePage="Workflows" setActivePage={() => {}} isSidebarOpen={false} onClose={() => {}} />

      <div className="lg:ml-64">
        {/* Top Bar */}
        <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              🔧 Workflow Builder
            </h1>
            <input
              type="text"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              placeholder="Untitled Workflow"
              className="px-3 py-1.5 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-transparent dark:text-white focus:ring-2 focus:ring-blue-400 focus:outline-none w-48"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadWorkflows}
              disabled={loading}
              className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition"
            >
              📂 Load
            </button>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`px-3 py-1.5 text-sm rounded-lg transition ${
                showPreview
                  ? 'bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
              }`}
            >
              🧪 Test
            </button>
            <button
              onClick={clearCanvas}
              className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition"
            >
              🗑️ Clear
            </button>
            <button
              onClick={saveWorkflow}
              disabled={saving}
              className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition shadow-md"
            >
              {saving ? '⏳ Saving...' : '💾 Save Workflow'}
            </button>
            <ThemeToggle />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex" style={{ height: 'calc(100vh - 60px)' }}>
          {/* Left: Node Palette */}
          <div className="w-56 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 p-3 overflow-y-auto flex-shrink-0">
            <div className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              Node Palette
            </div>
            <div className="space-y-2">
              {PALETTE_NODES.map((item) => (
                <div
                  key={item.nodeType}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/reactflow', JSON.stringify(item));
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  className={`bg-gradient-to-r ${item.color} rounded-xl p-3 cursor-grab active:cursor-grabbing hover:shadow-lg transition-all duration-200 active:scale-95`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{item.icon}</span>
                    <div>
                      <div className="text-white font-bold text-sm">{item.label}</div>
                      <div className="text-white/70 text-[10px]">{item.description}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Stats */}
            <div className="mt-6 p-3 bg-gray-50 dark:bg-slate-800 rounded-xl">
              <div className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Canvas Stats
              </div>
              <div className="space-y-1 text-xs text-gray-600 dark:text-slate-300">
                <div className="flex justify-between">
                  <span>Nodes:</span>
                  <span className="font-semibold">{nodes.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Edges:</span>
                  <span className="font-semibold">{edges.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Approvals:</span>
                  <span className="font-semibold">
                    {nodes.filter((n) => n.data?.nodeType === 'approval').length}
                  </span>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="mt-4">
              <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                Description
              </label>
              <textarea
                value={workflowDescription}
                onChange={(e) => setWorkflowDescription(e.target.value)}
                placeholder="Describe this workflow..."
                rows={3}
                className="mt-1 w-full px-2 py-1.5 text-xs border border-gray-200 dark:border-slate-700 rounded-lg bg-transparent dark:text-white focus:ring-2 focus:ring-blue-400 focus:outline-none resize-none"
              />
            </div>
          </div>

          {/* Center: React Flow Canvas */}
          <div className="flex-1 relative" ref={reactFlowWrapper}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              onDrop={onDrop}
              onDragOver={onDragOver}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
              snapToGrid
              snapGrid={[15, 15]}
              deleteKeyCode="Delete"
              defaultEdgeOptions={{
                type: 'workflowEdge',
                animated: true,
                style: { strokeWidth: 2 },
              }}
              proOptions={{ hideAttribution: true }}
            >
              <Controls className="!bg-white dark:!bg-slate-800 !border-gray-200 dark:!border-slate-700 !shadow-lg" />
              <MiniMap
                className="!bg-gray-50 dark:!bg-slate-900 !border-gray-200 dark:!border-slate-700"
                nodeColor={(n) => {
                  const colors = {
                    trigger: '#8b5cf6',
                    approval: '#3b82f6',
                    condition: '#f59e0b',
                    notification: '#10b981',
                    end: '#6b7280',
                  };
                  return colors[n.data?.nodeType] || '#94a3b8';
                }}
              />
              <Background color="#94a3b8" gap={15} size={1} />

              {/* Empty state */}
              {nodes.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center text-gray-400 dark:text-slate-500">
                    <div className="text-6xl mb-4">🔧</div>
                    <p className="text-lg font-semibold">Drag nodes from the palette</p>
                    <p className="text-sm mt-1">Connect them to build your approval chain</p>
                  </div>
                </div>
              )}
            </ReactFlow>
          </div>

          {/* Right: Properties Panel */}
          {showProperties && (
            <div className="w-72 bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-800 p-4 overflow-y-auto flex-shrink-0">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-700 dark:text-slate-200 uppercase tracking-wider">
                  Properties
                </h3>
                <button
                  onClick={() => setShowProperties(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
                >
                  ✕
                </button>
              </div>

              {selectedNode ? (
                <div className="space-y-4">
                  {/* Node Type Badge */}
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">
                      {PALETTE_NODES.find((p) => p.nodeType === selectedNode.data?.nodeType)?.icon || '📄'}
                    </span>
                    <div>
                      <div className="font-bold text-gray-900 dark:text-white text-sm">
                        {selectedNode.data?.label || selectedNode.data?.nodeType}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-slate-400">
                        ID: {selectedNode.id}
                      </div>
                    </div>
                  </div>

                  <hr className="border-gray-100 dark:border-slate-800" />

                  {/* Label */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">
                      Label
                    </label>
                    <input
                      type="text"
                      value={selectedNode.data?.label || ''}
                      onChange={(e) => updateNodeData('label', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-transparent dark:text-white focus:ring-2 focus:ring-blue-400 focus:outline-none"
                    />
                  </div>

                  {/* Approval-specific fields */}
                  {selectedNode.data?.nodeType === 'approval' && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">
                          Role *
                        </label>
                        <select
                          value={selectedNode.data?.roleName || ''}
                          onChange={(e) => updateNodeData('roleName', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-400 focus:outline-none"
                        >
                          <option value="">Select role...</option>
                          {AVAILABLE_ROLES.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">
                          Escalation (hours)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={selectedNode.data?.escalationHours || 24}
                          onChange={(e) => updateNodeData('escalationHours', parseInt(e.target.value, 10))}
                          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-transparent dark:text-white focus:ring-2 focus:ring-blue-400 focus:outline-none"
                        />
                      </div>
                    </>
                  )}

                  {/* Condition-specific fields */}
                  {selectedNode.data?.nodeType === 'condition' && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">
                        Expression
                      </label>
                      <input
                        type="text"
                        value={selectedNode.data?.conditionExpr || ''}
                        onChange={(e) => updateNodeData('conditionExpr', e.target.value)}
                        placeholder="e.g. amount >= 50000"
                        className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-transparent dark:text-white font-mono focus:ring-2 focus:ring-blue-400 focus:outline-none"
                      />
                      <p className="text-[10px] text-gray-400 mt-1">
                        Available vars: amount, department, requester
                      </p>
                    </div>
                  )}

                  {/* Notification-specific fields */}
                  {selectedNode.data?.nodeType === 'notification' && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">
                        Template
                      </label>
                      <select
                        value={selectedNode.data?.template || ''}
                        onChange={(e) => updateNodeData('template', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-400 focus:outline-none"
                      >
                        <option value="">Select template...</option>
                        <option value="approval_request">Approval Request</option>
                        <option value="approval_granted">Approval Granted</option>
                        <option value="approval_rejected">Approval Rejected</option>
                        <option value="escalation_alert">Escalation Alert</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                  )}

                  {/* Delete button */}
                  <button
                    onClick={() => deleteNode(selectedNode.id)}
                    className="w-full mt-4 px-4 py-2 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-lg text-sm font-semibold hover:bg-red-100 dark:hover:bg-red-950/50 transition"
                  >
                    🗑️ Delete Node
                  </button>
                </div>
              ) : (
                <div className="text-center text-gray-400 dark:text-slate-500 mt-12">
                  <p className="text-3xl mb-3">👆</p>
                  <p className="text-sm">Click a node to edit its properties</p>
                </div>
              )}
            </div>
          )}

          {/* Right: Preview Panel */}
          {showPreview && (
            <div className="w-80 bg-gray-50 dark:bg-slate-950 border-l border-gray-200 dark:border-slate-800 p-4 overflow-y-auto flex-shrink-0">
              <WorkflowPreview
                nodes={nodes}
                edges={edges}
                onClose={() => setShowPreview(false)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Load Modal */}
      {showLoadModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Load Workflow</h2>
              <button onClick={() => setShowLoadModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 text-xl">
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {savedWorkflows.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-slate-400 py-8">No saved workflows found.</p>
              ) : (
                <div className="space-y-3">
                  {savedWorkflows.map((wf) => (
                    <button
                      key={wf._id}
                      onClick={() => loadWorkflow(wf)}
                      className="w-full text-left p-4 border border-gray-200 dark:border-slate-700 rounded-xl hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition"
                    >
                      <div className="font-bold text-gray-900 dark:text-white text-sm">{wf.name}</div>
                      <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                        {wf.nodes?.length || 0} nodes · {wf.edges?.length || 0} edges
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Export with ReactFlowProvider wrapper
// ---------------------------------------------------------------------------

export default function WorkflowBuilder() {
  return (
    <ReactFlowProvider>
      <WorkflowBuilderInner />
    </ReactFlowProvider>
  );
}
