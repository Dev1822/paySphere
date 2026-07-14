import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import api from "../services/api";

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();

  // Form State
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (password !== confirmPassword) {
      return setError("Passwords do not match.");
    }

    if (password.length < 6) {
      return setError("Password must be at least 6 characters long.");
    }

    setLoading(true);

    try {
      await api.post(`/api/auth/reset-password/${token}`, { password });
      setSuccess(true);
      setPassword("");
      setConfirmPassword("");
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate("/auth");
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to reset password. The link may have expired.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col font-sans">
      <Helmet>
        <title>Reset Password | PaySphere</title>
        <meta name="description" content="Set a new password for your PaySphere account." />
      </Helmet>
      <div className="flex-1 flex items-center justify-center px-4 py-6 sm:py-8">
        <div className="w-full max-w-6xl bg-white rounded-2xl sm:rounded-3xl shadow-xl flex flex-col md:flex-row overflow-hidden">
          
          {/* LEFT PANEL (hidden on mobile) */}
          <div className="hidden md:flex md:w-[42%] bg-linear-to-br from-indigo-50 via-red-50 to-yellow-100 p-8 lg:p-10 flex-col justify-between relative overflow-hidden">
            <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-blue-500/10" />
            <div className="absolute bottom-24 -left-10 w-40 h-40 rounded-full bg-yellow-400/20" />

            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-12 lg:mb-16">
                <div className="w-8 h-8 bg-blue-600 rounded-lg" />
                <span className="font-bold text-lg text-gray-900">PaySphere</span>
              </div>

              <h1 className="text-3xl lg:text-4xl font-serif mb-4 leading-tight">
                Secure your <br /> account.
              </h1>

              <p className="text-gray-500 text-sm max-w-xs leading-relaxed">
                Choose a strong password to protect your company's payroll data.
              </p>
            </div>

            <div className="bg-white rounded-xl p-4 lg:p-5 shadow-md relative z-10">
              <p className="text-sm text-gray-500 mb-2">Digital Ledger</p>
              <h2 className="text-lg font-serif text-gray-900">
                Payroll made simple.
              </h2>
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div className="w-full md:flex-1 px-5 sm:px-8 md:px-12 py-8 sm:py-10 flex flex-col justify-center">
            {success ? (
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h2 className="text-2xl font-serif mb-2 text-gray-900">Password Reset Successful!</h2>
                <p className="text-gray-500 text-sm mb-6">
                  Your password has been successfully updated. You will be redirected to the login page shortly.
                </p>
                <button
                  onClick={() => navigate("/auth")}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition"
                >
                  Go to Login Now
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-serif mb-1">Set New Password</h2>
                <p className="text-gray-500 text-sm mb-6">
                  Please enter your new password below.
                </p>

                <form onSubmit={handleSubmit}>
                  <div className="mb-4">
                    <input
                      type="password"
                      placeholder="New Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full px-4 py-3 rounded-lg bg-gray-100 focus:bg-white focus:border focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div className="mb-4">
                    <input
                      type="password"
                      placeholder="Confirm New Password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="w-full px-4 py-3 rounded-lg bg-gray-100 focus:bg-white focus:border focus:border-blue-500 outline-none"
                    />
                  </div>

                  {error && <p className="text-red-500 text-xs mb-4">{error}</p>}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition mb-5 text-center disabled:opacity-50"
                  >
                    {loading ? "Resetting..." : "Reset Password"}
                  </button>
                </form>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => navigate("/auth")}
                    className="text-sm text-blue-600 hover:underline font-semibold"
                  >
                    Back to Login
                  </button>
                </div>
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
