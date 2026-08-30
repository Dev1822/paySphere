import React, { useState, useEffect } from 'react';
import axios from 'axios';

const PayslipPreviewModal = ({
  isOpen,
  onClose,
  templateData,
  sampleEmployee,
  samplePayroll,
}) => {
  const [htmlPreview, setHtmlPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && templateData) {
      fetchPreview();
    }
  }, [isOpen, templateData]);

  const fetchPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post('/api/payslip-templates/preview', {
        template: templateData,
        employee: sampleEmployee,
        payroll: samplePayroll,
      });
      setHtmlPreview(response.data.html);
    } catch (err) {
      setError('Failed to fetch preview');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold">Payslip Preview</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 font-bold text-lg"
          >
            &times;
          </button>
        </div>
        <div className="p-4 flex-1 overflow-auto bg-gray-100">
          {loading && <div className="text-center p-8">Loading preview...</div>}
          {error && <div className="text-red-500 text-center p-8">{error}</div>}
          {!loading && !error && htmlPreview && (
            <div
              className="bg-white shadow-sm"
              dangerouslySetInnerHTML={{ __html: htmlPreview }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default PayslipPreviewModal;
