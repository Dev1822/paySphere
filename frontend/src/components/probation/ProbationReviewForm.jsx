import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

export default function ProbationReviewForm({ trackerId, onComplete }) {
  const [recommendation, setRecommendation] = useState('confirm');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await axios.post(`/api/probation/${trackerId}/review`, {
        recommendation,
        notes,
      });
      toast.success('Review submitted successfully');
      if (onComplete) onComplete();
    } catch (error) {
      toast.error('Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6"
    >
      <h3 className="text-xl font-semibold text-gray-800">Manager Review</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Recommendation
          </label>
          <div className="grid grid-cols-3 gap-4">
            {['confirm', 'extend', 'terminate'].map((rec) => (
              <label
                key={rec}
                className={`border rounded-xl p-4 cursor-pointer transition flex justify-center items-center font-medium capitalize
                  ${
                    recommendation === rec
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
              >
                <input
                  type="radio"
                  name="recommendation"
                  value={rec}
                  checked={recommendation === rec}
                  onChange={() => setRecommendation(rec)}
                  className="hidden"
                />
                {rec}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Evaluation Notes
          </label>
          <textarea
            required
            rows={4}
            className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="Detailed assessment of performance, attitude, and suitability..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-gray-100">
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium transition disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'Submit Review'}
        </button>
      </div>
    </form>
  );
}
