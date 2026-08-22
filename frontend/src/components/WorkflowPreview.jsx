/**
 * WorkflowPreview.jsx - Workflow Test & Preview Panel
 *
 * Simulates a workflow execution by stepping through the node graph.
 * Shows which node is active, highlights the path taken, and displays
 * the approval/rejection decisions at each step.
 */
import { useState, useMemo } from 'react';

const STEP_COLORS = {
  pending: 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400',
  active: 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 ring-2 ring-blue-400',
  completed: 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
  rejected: 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300',
  skipped: 'bg-gray-50 dark:bg-slate-900 text-gray-400 dark:text-slate-500 line-through',
};

export default function WorkflowPreview({ nodes, edges, onClose }) {
  const [simSteps, setSimSteps] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(-1);

  // Build adjacency list from edges
  const adjacency = useMemo(() => {
    const map = {};
    for (const edge of edges) {
      if (!map[edge.source]) map[edge.source] = [];
      map[edge.source].push({ target: edge.target, label: edge.label || edge.id });
    }
    return map;
  }, [edges]);

  // Find trigger node (entry point)
  const triggerNode = useMemo(
    () => nodes.find((n) => n.data?.nodeType === 'trigger'),
    [nodes]
  );

  // Build simulation path
  const simulate = () => {
    if (!triggerNode) return;
    const path = [];
    let currentId = triggerNode.id;
    const visited = new Set();

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const node = nodes.find((n) => n.id === currentId);
      if (!node) break;

      path.push({
        nodeId: currentId,
        label: node.data?.label || node.data?.nodeType || 'Unknown',
        nodeType: node.data?.nodeType,
        status: 'pending',
      });

      const nextEdges = adjacency[currentId] || [];
      if (nextEdges.length === 0) break;

      // For condition nodes, default to first branch (true path)
      currentId = nextEdges[0].target;
    }

    setSimSteps(path);
    setCurrentIdx(0);
    if (path.length > 0) {
      setSimSteps((prev) =>
        prev.map((step, i) => (i === 0 ? { ...step, status: 'active' } : step))
      );
    }
  };

  // Step forward in simulation
  const stepForward = (decision = 'approved') => {
    if (currentIdx < 0 || currentIdx >= simSteps.length) return;

    const newSteps = [...simSteps];
    newSteps[currentIdx] = { ...newSteps[currentIdx], status: decision };

    const nextIdx = currentIdx + 1;
    if (nextIdx < newSteps.length) {
      newSteps[nextIdx] = { ...newSteps[nextIdx], status: 'active' };
    }

    setSimSteps(newSteps);
    setCurrentIdx(nextIdx);
  };

  const reset = () => {
    setSimSteps([]);
    setCurrentIdx(-1);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-3 flex items-center justify-between">
        <h3 className="text-white font-bold text-sm flex items-center gap-2">
          🧪 Workflow Test Simulator
        </h3>
        <button onClick={onClose} className="text-white/70 hover:text-white text-lg">
          ✕
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Controls */}
        <div className="flex gap-2">
          {simSteps.length === 0 ? (
            <button
              onClick={simulate}
              disabled={!triggerNode}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              ▶ Start Simulation
            </button>
          ) : (
            <>
              <button
                onClick={() => stepForward('approved')}
                disabled={currentIdx >= simSteps.length}
                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition"
              >
                ✓ Approve
              </button>
              <button
                onClick={() => stepForward('rejected')}
                disabled={currentIdx >= simSteps.length}
                className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 disabled:opacity-50 transition"
              >
                ✕ Reject
              </button>
              <button
                onClick={reset}
                className="px-3 py-1.5 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-lg text-xs font-semibold hover:bg-gray-300 dark:hover:bg-slate-600 transition"
              >
                ↺ Reset
              </button>
            </>
          )}
        </div>

        {/* Simulation Steps */}
        {simSteps.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
              Execution Path
            </div>
            {simSteps.map((step, idx) => (
              <div
                key={step.nodeId}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-300 ${STEP_COLORS[step.status]}`}
              >
                <div className="w-6 h-6 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-xs font-bold border border-current">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{step.label}</div>
                  <div className="text-xs opacity-70">{step.nodeType}</div>
                </div>
                <div className="text-xs font-semibold uppercase">
                  {step.status}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        {simSteps.length > 0 && currentIdx >= simSteps.length && (
          <div className={`p-3 rounded-lg text-sm font-medium ${
            simSteps.every((s) => s.status === 'completed' || s.status === 'approved')
              ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300'
          }`}>
            {simSteps.every((s) => s.status !== 'rejected')
              ? '✅ Workflow completed successfully — all stages approved.'
              : '❌ Workflow rejected at stage: ' + simSteps.find((s) => s.status === 'rejected')?.label}
          </div>
        )}

        {!triggerNode && nodes.length > 0 && (
          <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-lg">
            ⚠️ No trigger node found. Add a Trigger node to enable simulation.
          </div>
        )}
      </div>
    </div>
  );
}
