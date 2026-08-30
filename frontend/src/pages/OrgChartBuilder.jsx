/**
 * @fileoverview Drag-and-Drop Organization Chart builder
 * @description Lets an admin drag a connection from one employee to another
 * to change who they report to. Node positions are computed automatically
 * with the same tree-layout algorithm used by the read-only canvas org chart
 * (`utils/orgChartLayout.js`); dragging a *connection* onto a new manager is
 * what actually persists a change — dragging a card around only repositions
 * it on screen for that session.
 *
 * Issue: #1287
 */

import { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  addEdge,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { buildTree, layoutTree, LAYOUT_CONFIG } from '../utils/orgChartLayout';
import AccountTreeIcon from '@mui/icons-material/AccountTree';

/**
 * A single employee card rendered on the canvas. `target` (top) accepts a
 * new manager connection, `source` (bottom) is what a report drags from.
 */
function EmployeeNode({ data }) {
  return (
    <div className="px-4 py-3 rounded-xl border shadow-sm bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 w-[200px]">
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-brand-500 !w-3 !h-3"
      />
      <p
        className="text-sm font-bold text-gray-900 dark:text-white truncate"
        title={data.fullName}
      >
        {data.fullName}
      </p>
      <p
        className="text-xs text-gray-500 dark:text-slate-400 truncate"
        title={data.role}
      >
        {data.role || 'Employee'}
      </p>
      {data.department && (
        <p className="text-[10px] text-gray-400 dark:text-slate-500 truncate">
          {data.department}
        </p>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-brand-500 !w-3 !h-3"
      />
    </div>
  );
}

const NODE_TYPES = { employeeNode: EmployeeNode };

const EDGE_OPTIONS = {
  type: 'smoothstep',
  markerEnd: { type: MarkerType.ArrowClosed },
};

/**
 * Turns the flat employee list into positioned react-flow nodes + edges,
 * reusing the existing tree-layout algorithm rather than re-deriving one.
 */
function toFlowElements(employees) {
  const { root, nodeMap } = buildTree(employees);
  if (root) {
    layoutTree(root, LAYOUT_CONFIG.PADDING, LAYOUT_CONFIG.PADDING);
  }

  const nodes = [];
  nodeMap.forEach((treeNode, id) => {
    nodes.push({
      id,
      type: 'employeeNode',
      position: { x: treeNode.x, y: treeNode.y },
      data: {
        fullName: treeNode.name,
        role: treeNode.role,
        department: treeNode.department,
      },
    });
  });

  const edges = employees
    .filter((emp) => emp.managerId && nodeMap.has(String(emp.managerId)))
    .map((emp) => ({
      id: `e-${emp.managerId}-${emp._id}`,
      source: String(emp.managerId),
      target: String(emp._id),
      ...EDGE_OPTIONS,
    }));

  return { nodes, edges };
}

export default function OrgChartBuilder() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { toast } = useToast();

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/employees/org-chart');
      setEmployees(res.data.employees || []);
    } catch {
      toast.error('Could not load the org chart.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // Recompute positions whenever the underlying employee list changes,
  // either from the initial fetch or after a rollback.
  useEffect(() => {
    const { nodes: nextNodes, edges: nextEdges } = toFlowElements(employees);
    setNodes(nextNodes);
    setEdges(nextEdges);
  }, [employees]);

  const onConnect = useCallback(
    (params) => {
      if (!params.source || !params.target || params.source === params.target) {
        return;
      }

      // An employee reports to exactly one manager, so a new connection
      // replaces whichever edge previously pointed at this employee.
      setEdges((eds) =>
        addEdge(
          { ...params, ...EDGE_OPTIONS },
          eds.filter((e) => e.target !== params.target),
        ),
      );

      api
        .patch(`/api/employees/${params.target}/manager`, {
          managerId: params.source,
        })
        .then(() => toast.success('Reporting line updated.'))
        .catch((err) => {
          toast.error(
            err.response?.data?.message ||
              'Could not update the reporting line.',
          );
          fetchEmployees(); // roll back to the last known-good state
        });
    },
    [setEdges, toast, fetchEmployees],
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
      <Helmet>
        <title>Org Chart Builder</title>
      </Helmet>
      <Sidebar
        activePage="OrgChartBuilder"
        setActivePage={() => {}}
        isSidebarOpen={false}
        onClose={() => {}}
      />
      <div className="lg:ml-64">
        <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <AccountTreeIcon /> Organization Chart Builder
          </h1>
          <ThemeToggle />
        </div>

        <div className="p-4 lg:p-8">
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
            Drag from the dot below an employee to the dot above their new
            manager to change who they report to.
          </p>

          <div className="h-[700px] bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-full text-gray-400 dark:text-slate-500 text-sm">
                Loading org chart...
              </div>
            ) : (
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={NODE_TYPES}
                fitView
              >
                <Background />
                <Controls />
                <MiniMap pannable zoomable />
              </ReactFlow>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
