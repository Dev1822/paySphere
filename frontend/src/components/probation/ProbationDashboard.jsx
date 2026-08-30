import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ShieldAlert, Clock, UserCheck, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function ProbationDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data } = await axios.get('/api/probation/dashboard');
      setStats(data);
    } catch (error) {
      toast.error('Failed to load probation dashboard stats');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center animate-pulse">
        Loading probation data...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">Probation Overview</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <UserCheck className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">
              Active Probations
            </p>
            <p className="text-3xl font-bold text-gray-900">
              {stats?.activeCount || 0}
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="p-3 bg-red-50 text-red-600 rounded-xl">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Overdue Reviews</p>
            <p className="text-3xl font-bold text-red-600">
              {stats?.overdueCount || 0}
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Clock className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">
              Expiring in 30 Days
            </p>
            <p className="text-3xl font-bold text-amber-600">
              {stats?.upcomingExpiriesCount || 0}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center">
            <AlertCircle className="w-5 h-5 mr-2 text-red-500" /> Action
            Required: Overdue
          </h2>
        </div>
        <div className="divide-y divide-gray-100">
          {stats?.overdueReviews?.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No overdue reviews!
            </div>
          ) : (
            stats?.overdueReviews?.map((tracker) => (
              <div
                key={tracker._id}
                className="p-6 flex justify-between items-center hover:bg-gray-50 transition-colors"
              >
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {tracker.employeeId?.fullName}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {tracker.employeeId?.role} •{' '}
                    {tracker.employeeId?.department}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-red-600">
                    Expired {new Date(tracker.endDate).toLocaleDateString()}
                  </p>
                  <button className="mt-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                    Review Now &rarr;
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
