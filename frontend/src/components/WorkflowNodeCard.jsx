/**
 * WorkflowNodeCard.jsx - Visual Workflow Builder
 *
 * Custom React Flow node component for the workflow builder.
 * Renders each workflow node (trigger, approval, condition, notification, end)
 * with appropriate styling, icon, and action buttons.
 */
import { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';

const NODE_CONFIGS = {
  trigger: {
    label: 'Trigger',
    icon: '⚡',
    gradient: 'from-violet-500 to-purple-600',
    bg: 'bg-violet-50 dark:bg-violet-950/30',
    border: 'border-violet-300 dark:border-violet-700',
    textColor: 'text-violet-700 dark:text-violet-300',
    handleColor: '#8b5cf6',
  },
  approval: {
    label: 'Approval',
    icon: '✅',
    gradient: 'from-blue-500 to-indigo-600',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-300 dark:border-blue-700',
    textColor: 'text-blue-700 dark:text-blue-300',
    handleColor: '#3b82f6',
  },
  condition: {
    label: 'Condition',
    icon: '🔀',
    gradient: 'from-amber-500 to-orange-600',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-300 dark:border-amber-700',
    textColor: 'text-amber-700 dark:text-amber-300',
    handleColor: '#f59e0b',
  },
  notification: {
    label: 'Notify',
    icon: '🔔',
    gradient: 'from-emerald-500 to-teal-600',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-300 dark:border-emerald-700',
    textColor: 'text-emerald-700 dark:text-emerald-300',
    handleColor: '#10b981',
  },
  end: {
    label: 'End',
    icon: '🏁',
    gradient: 'from-gray-500 to-slate-600',
    bg: 'bg-gray-50 dark:bg-gray-900/30',
    border: 'border-gray-300 dark:border-gray-600',
    textColor: 'text-gray-700 dark:text-gray-300',
    handleColor: '#6b7280',
  },
};

function WorkflowNodeCard({ data, selected, onDelete }) {
  const [showMenu, setShowMenu] = useState(false);
  const config = NODE_CONFIGS[data.nodeType] || NODE_CONFIGS.approval;

  return (
    <div
      className={`
        relative rounded-xl border-2 shadow-lg transition-all duration-200
        ${config.bg} ${config.border}
        ${selected ? 'ring-2 ring-blue-400 dark:ring-blue-500 scale-105' : 'hover:shadow-xl'}
        min-w-[200px] max-w-[280px]
      `}
      onMouseLeave={() => setShowMenu(false)}
    >
      {/* Header */}
      <div className={`bg-gradient-to-r ${config.gradient} px-4 py-2.5 rounded-t-[10px] flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <span className="text-lg">{config.icon}</span>
          <span className="text-white font-bold text-sm">{config.label}</span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className="text-white/70 hover:text-white text-lg leading-none px-1"
        >
          ⋮
        </button>
      </div>

      {/* Context Menu */}
      {showMenu && (
        <div className="absolute top-12 right-2 z-50 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-xl py-1 min-w-[140px]">
          <button
            onClick={() => { onDelete?.(data.id); setShowMenu(false); }}
            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            🗑️ Delete Node
          </button>
        </div>
      )}

      {/* Body */}
      <div className="px-4 py-3">
        <div className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1">
          {data.label || data.nodeType}
        </div>

        {data.nodeType === 'approval' && (
          <div className="space-y-1.5">
            <div className="text-sm text-gray-700 dark:text-slate-300">
              <span className="font-medium">Role:</span>{' '}
              {data.roleName || (
                <span className="text-gray-400 italic">Select role...</span>
              )}
            </div>
            {data.assignee && (
              <div className="text-xs text-gray-500 dark:text-slate-400">
                Assigned to: {data.assignee}
              </div>
            )}
            {data.escalationHours && (
              <div className="text-xs text-amber-600 dark:text-amber-400">
                ⏱ Escalation: {data.escalationHours}h
              </div>
            )}
          </div>
        )}

        {data.nodeType === 'condition' && (
          <div className="text-sm text-gray-700 dark:text-slate-300">
            <span className="font-medium">Expression:</span>{' '}
            {data.conditionExpr ? (
              <code className="text-xs bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded font-mono">
                {data.conditionExpr}
              </code>
            ) : (
              <span className="text-gray-400 italic">Define condition...</span>
            )}
          </div>
        )}

        {data.nodeType === 'notification' && (
          <div className="text-sm text-gray-700 dark:text-slate-300">
            <span className="font-medium">Template:</span>{' '}
            {data.template || (
              <span className="text-gray-400 italic">Select template...</span>
            )}
          </div>
        )}

        {data.nodeType === 'trigger' && (
          <div className="text-sm text-gray-700 dark:text-slate-300">
            <span className="font-medium">Entity:</span>{' '}
            {data.entityType || 'PayrollUpdate'}
          </div>
        )}
      </div>

      {/* Handles */}
      {data.nodeType !== 'trigger' && (
        <Handle
          type="target"
          position={Position.Top}
          className="w-3 h-3 !bg-white border-2"
          style={{ borderColor: config.handleColor }}
        />
      )}
      {data.nodeType !== 'end' && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="w-3 h-3 !bg-white border-2"
          style={{ borderColor: config.handleColor }}
          id="bottom"
        />
      )}
      {data.nodeType === 'condition' && (
        <>
          <Handle
            type="source"
            position={Position.Left}
            className="w-3 h-3 !bg-white border-2"
            style={{ borderColor: config.handleColor }}
            id="true"
          />
          <Handle
            type="source"
            position={Position.Right}
            className="w-3 h-3 !bg-white border-2"
            style={{ borderColor: config.handleColor }}
            id="false"
          />
        </>
      )}
    </div>
  );
}

export default memo(WorkflowNodeCard);
