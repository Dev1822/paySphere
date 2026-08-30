import React, { useState, useEffect } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout/legacy';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

const MOCK_FORECAST_DATA = [
  { date: '2026-08-10', actual: 4000, forecast: 4200 },
  { date: '2026-08-11', actual: 4500, forecast: 4600 },
  { date: '2026-08-12', actual: 5000, forecast: 4900 },
  { date: '2026-08-13', actual: 3000, forecast: 3200 },
  { date: '2026-08-14', actual: null, forecast: 4000 },
  { date: '2026-08-15', actual: null, forecast: 5500 },
  { date: '2026-08-16', actual: null, forecast: 6000 },
];

const MOCK_ROSTER = [
  {
    i: 'shift1',
    x: 0,
    y: 0,
    w: 2,
    h: 2,
    employee: 'Dr. Jane Smith',
    risk: 'LOW',
    hours: '08:00 - 16:00',
  },
  {
    i: 'shift2',
    x: 2,
    y: 0,
    w: 2,
    h: 2,
    employee: 'Nurse Bob Jones',
    risk: 'CRITICAL',
    hours: '08:00 - 20:00',
  },
  {
    i: 'shift3',
    x: 4,
    y: 0,
    w: 2,
    h: 2,
    employee: 'Dr. Alice Cooper',
    risk: 'MODERATE',
    hours: '12:00 - 20:00',
  },
  {
    i: 'shift4',
    x: 0,
    y: 2,
    w: 2,
    h: 2,
    employee: 'Tech Dave Gray',
    risk: 'HIGH',
    hours: '20:00 - 08:00',
  },
];

const PredictiveOvertimeDashboard = () => {
  const [layout, setLayout] = useState(MOCK_ROSTER);
  const [selectedShift, setSelectedShift] = useState(null);

  const getRiskColor = (risk) => {
    switch (risk) {
      case 'CRITICAL':
        return '#ef4444'; // red-500
      case 'HIGH':
        return '#f97316'; // orange-500
      case 'MODERATE':
        return '#eab308'; // yellow-500
      case 'LOW':
        return '#22c55e'; // green-500
      default:
        return '#6b7280'; // gray-500
    }
  };

  const handleReallocate = (shiftId) => {
    alert(
      `AI Suggested Reallocation for shift ${shiftId}: Assigning to Dr. Alice Cooper (Low Risk).`,
    );
    setLayout(
      layout.map((l) =>
        l.i === shiftId
          ? { ...l, risk: 'LOW', employee: 'Dr. Alice Cooper' }
          : l,
      ),
    );
    setSelectedShift(null);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">
          Predictive Overtime & Burnout Dashboard
        </h1>
        <p className="text-gray-600 mt-2">
          Monitor clinical telemetry, forecast overtime spend, and preemptively
          block high-risk shift assignments.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Forecast Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">
            30-Day Overtime Forecast
          </h2>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={MOCK_FORECAST_DATA}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="actual"
                  stroke="#3b82f6"
                  fill="#93c5fd"
                  name="Actual Spend ($)"
                />
                <Area
                  type="monotone"
                  dataKey="forecast"
                  stroke="#8b5cf6"
                  fill="#c4b5fd"
                  strokeDasharray="5 5"
                  name="Forecasted Spend ($)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Action Panel */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">
            Compliance & Alerts
          </h2>
          {selectedShift ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <h3 className="font-semibold text-red-800 text-lg">
                ⚠️ High Risk Shift Assignment Detected
              </h3>
              <p className="text-red-700 mt-2">
                Shift: {selectedShift.hours} <br />
                Assigned to: <strong>{selectedShift.employee}</strong> <br />
                Risk Level: <strong>{selectedShift.risk}</strong>
              </p>
              <p className="text-sm text-red-600 mt-2">
                Assigning this shift pushes the employee over their 48-hour
                legal limit and critical burnout threshold.
              </p>
              <div className="mt-4 flex space-x-3">
                <button
                  onClick={() => handleReallocate(selectedShift.i)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  ✨ AI Suggested Reallocation
                </button>
                <button
                  onClick={() => setSelectedShift(null)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="text-gray-500 flex items-center justify-center h-48 border-2 border-dashed border-gray-200 rounded-lg">
              Select a high-risk shift from the roster to view alerts and
              reallocate.
            </div>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">
          Upcoming Shift Roster (Grid View)
        </h2>
        <ResponsiveGridLayout
          className="layout"
          layouts={{ lg: layout }}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={80}
          isResizable={true}
          isDraggable={true}
        >
          {layout.map((item) => (
            <div
              key={item.i}
              data-grid={item}
              className="rounded-lg shadow flex flex-col p-3 cursor-pointer hover:shadow-md transition-shadow"
              style={{
                backgroundColor: getRiskColor(item.risk),
                color: 'white',
              }}
              onClick={() => setSelectedShift(item)}
            >
              <span className="font-bold">{item.employee}</span>
              <span className="text-sm mt-1">{item.hours}</span>
              <div className="mt-auto flex justify-between items-center">
                <span className="text-xs font-semibold bg-white/20 px-2 py-1 rounded">
                  Risk: {item.risk}
                </span>
              </div>
            </div>
          ))}
        </ResponsiveGridLayout>
      </div>
    </div>
  );
};

export default PredictiveOvertimeDashboard;
