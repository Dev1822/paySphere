import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSearchParams } from 'react-router-dom';

const PayslipVerificationPage = () => {
  const [searchParams] = useSearchParams();
  const [verificationResult, setVerificationResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const hash = searchParams.get('hash');
    if (hash) {
      verifyHash(hash);
    } else {
      setLoading(false);
      setError('No verification hash provided in the URL.');
    }
  }, [searchParams]);

  const verifyHash = async (hash) => {
    try {
      const response = await axios.post('/api/public/verification/verify', {
        hash,
      });
      setVerificationResult(response.data);
    } catch (err) {
      console.error(err);
      if (err.response && err.response.status === 404) {
        setVerificationResult({ verified: false });
      } else {
        setError('An error occurred during verification.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md text-center">
        <h1 className="text-2xl font-bold mb-6 text-gray-800">
          Document Verification
        </h1>

        {loading && (
          <div className="text-blue-600 animate-pulse">
            <svg
              className="w-12 h-12 mx-auto mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <p>Verifying digital seal...</p>
          </div>
        )}

        {error && (
          <div className="text-red-500">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <p className="font-semibold">{error}</p>
          </div>
        )}

        {!loading && !error && verificationResult && (
          <div>
            {verificationResult.verified ? (
              <div className="text-green-600">
                <svg
                  className="w-20 h-20 mx-auto mb-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <h2 className="text-xl font-bold mb-2">
                  Verification Successful
                </h2>
                <p className="text-gray-600 mb-6">
                  This document has a valid cryptographic seal and has not been
                  altered.
                </p>
                <div className="text-left bg-gray-50 p-4 rounded text-sm text-gray-700">
                  <p className="mb-1">
                    <span className="font-semibold">Document Type:</span>{' '}
                    {verificationResult.documentType}
                  </p>
                  <p className="mb-1">
                    <span className="font-semibold">Employee:</span>{' '}
                    {verificationResult.employeeName}
                  </p>
                  <p className="mb-1">
                    <span className="font-semibold">Company:</span>{' '}
                    {verificationResult.tenantName}
                  </p>
                  <p className="mb-1">
                    <span className="font-semibold">Issued On:</span>{' '}
                    {new Date(
                      verificationResult.createdAt,
                    ).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-red-600">
                <svg
                  className="w-20 h-20 mx-auto mb-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <h2 className="text-xl font-bold mb-2">Verification Failed</h2>
                <p className="text-gray-600">
                  The digital seal is invalid or the document has been altered
                  since it was issued.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PayslipVerificationPage;
