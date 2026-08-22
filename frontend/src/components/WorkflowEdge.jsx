/**
 * WorkflowEdge.jsx - Custom React Flow Edge
 *
 * Animated edge between workflow nodes with optional label and delete button.
 * Shows different colors for approve/reject paths on condition nodes.
 */
import { memo } from 'react';
import { getBezierPath, EdgeLabelRenderer } from '@xyflow/react';

function WorkflowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  label,
  markerEnd,
  selected,
  data,
}) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Condition edges: "true" path = green, "false" path = red
  const isTruePath = data?.conditionResult === true;
  const isFalsePath = data?.conditionResult === false;
  const edgeColor = isTruePath
    ? '#10b981'
    : isFalsePath
      ? '#ef4444'
      : selected
        ? '#3b82f6'
        : '#94a3b8';

  return (
    <>
      {/* Shadow/glow for selected edges */}
      {selected && (
        <path
          d={edgePath}
          className="animate-pulse"
          fill="none"
          stroke={edgeColor}
          strokeWidth={6}
          strokeOpacity={0.2}
        />
      )}

      {/* Main edge path */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={edgeColor}
        strokeWidth={selected ? 3 : 2}
        strokeDasharray={isFalsePath ? '6 3' : undefined}
        markerEnd={markerEnd}
        className="transition-all duration-200"
      />

      {/* Animated flow indicator */}
      {selected && (
        <circle r="4" fill={edgeColor} className="animate-pulse">
          <animateMotion dur="2s" repeatCount="indefinite" path={edgePath} />
        </circle>
      )}

      {/* Label */}
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-md px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-slate-300 shadow-sm"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export default memo(WorkflowEdge);
