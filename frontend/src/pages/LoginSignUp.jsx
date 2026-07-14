import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import api from "../services/api";

import { Helmet } from "react-helmet-async";
import { useGoogleLogin} from "@react-oauth/google";

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
  </svg>
);

export default function PaySphereLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("mode") === "signup" ? "signup" : "login");
  
  // Form State
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [password, setPassword] = useState("");
  
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Forgot Password State
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [successMessage, setSuccessMessage] = useState("");


  useEffect(() => {
    const mode = searchParams.get("mode");
    if (mode === "signup" || mode === "login") {
      setActiveTab(mode);
    }
  }, [searchParams]);

  useEffect(() => {
    setError("");
    setSuccessMessage("");
    setIsForgotPassword(false);
  }, [activeTab]);


  const handleAuth = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const endpoint = activeTab === "signup" ? "/signup" : "/login";
    const payload = activeTab === "signup" 
      ? { fullName, email, companyName, password }
      : { email, password };

    try {
      const response = await api.post(`/api/auth${endpoint}`, payload);
      
      const { token, companyName: savedCompanyName } = response.data;
      
      // Save to localStorage
      localStorage.setItem("token", token);
      localStorage.setItem("companyName", savedCompanyName);
      
      // Navigate to dashboard
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setLoading(true);

    try {
      const response = await api.post("/api/auth/forgot-password", { email: forgotEmail });
      setSuccessMessage(response.data.message || "Password reset link sent to your email.");
      setForgotEmail("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send reset link. Please try again.");
    } finally {
      setLoading(false);
    }
  };


  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      setError("");
      try {
        const payload = { 
          accessToken: tokenResponse.access_token 
        };
        
        if (activeTab === "signup") {
          payload.companyName = companyName;
        }

        const response = await api.post(`/api/auth/google`, payload);
        
        if (response.status === 202 && response.data.needsCompanyName) {
          setError(response.data.message);
          setActiveTab("signup");
        } else {
          const { token, companyName: savedCompanyName } = response.data;
          localStorage.setItem("token", token);
          localStorage.setItem("companyName", savedCompanyName);
          navigate("/dashboard");
        }
      } catch (err) {
        setError(err.response?.data?.message || "Google Login failed.");
      } finally {
        setLoading(false);
      }
    },
    onError: () => setError("Google Login failed.")
  });

  const onGoogleClick = () => {
    if (activeTab === "signup" && !companyName) {
      setError("Please enter your Company Name to sign up with Google.");
      return;
    }
    handleGoogleLogin();
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col font-sans">
      <Helmet>
        <title>{activeTab === "signup" ? "Create Account | PaySphere" : "Login | PaySphere"}</title>
        <meta name="description" content={activeTab === "signup" ? "Join PaySphere and automate your payroll today." : "Login to your PaySphere account to manage your employees."} />
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
                Back to <br /> simplicity.
              </h1>

              <p className="text-gray-500 text-sm max-w-xs leading-relaxed">
                Experience the digital ledger for modern Bharat.
              </p>
            </div>

            <div className="bg-white rounded-xl p-4 lg:p-5 shadow-md relative z-10">
              <p className="text-sm text-gray-500 mb-2">Last Month Payout</p>
              <h2 className="text-xl lg:text-2xl font-serif text-gray-900">
                ₹12,45,000
              </h2>
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div className="w-full md:flex-1 px-5 sm:px-8 md:px-12 py-8 sm:py-10 flex flex-col justify-center">

            {/* tabs */}
            <div className="flex bg-gray-100 rounded-xl p-1 mb-6 sm:mb-8">
              <button
                onClick={() => setActiveTab("login")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${activeTab === "login"
                    ? "bg-white shadow text-gray-900"
                    : "text-gray-500"
                  }`}
              >
                Login
              </button>

              <button
                onClick={() => setActiveTab("signup")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${activeTab === "signup"
                    ? "bg-white shadow text-gray-900"
                    : "text-gray-500"
                  }`}
              >
                Create Account
              </button>
            </div>

            {/* LOGIN */}
            {activeTab === "login" ? (
              <>
                {isForgotPassword ? (
                  <>
                    <h2 className="text-2xl font-serif mb-1">Reset Password</h2>
                    <p className="text-gray-500 text-sm mb-6">
                      Enter your registered email to receive a password reset link.
                    </p>

                    <form onSubmit={handleForgotPassword}>
                      <input
                        type="email"
                        placeholder="name@company.com"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        required
                        className="w-full mb-4 px-4 py-3 rounded-lg bg-gray-100 focus:bg-white focus:border focus:border-blue-500 outline-none"
                      />

                      {error && <p className="text-red-500 text-xs mb-4">{error}</p>}
                      {successMessage && <p className="text-green-600 text-xs mb-4">{successMessage}</p>}

                      <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition mb-5 text-center disabled:opacity-50"
                      >
                        {loading ? "Sending..." : "Send Reset Link"}
                      </button>
                    </form>

                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setIsForgotPassword(false);
                          setError("");
                          setSuccessMessage("");
                        }}
                        className="text-sm text-blue-600 hover:underline font-semibold"
                      >
                        Back to Login
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <h2 className="text-2xl font-serif mb-1">Welcome back</h2>
                    <p className="text-gray-500 text-sm mb-6">
                      Enter your credentials
                    </p>

                    <form onSubmit={handleAuth}>
                      <input
                        type="email"
                        placeholder="name@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full mb-4 px-4 py-3 rounded-lg bg-gray-100 focus:bg-white focus:border focus:border-blue-500 outline-none"
                      />

                      <input
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full mb-4 px-4 py-3 rounded-lg bg-gray-100 focus:bg-white focus:border focus:border-blue-500 outline-none"
                      />

                      <div className="flex justify-end mb-4 -mt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIsForgotPassword(true);
                            setError("");
                            setSuccessMessage("");
                          }}
                          className="text-xs text-blue-600 hover:underline font-semibold"
                        >
                          Forgot Password?
                        </button>
                      </div>

                      {error && <p className="text-red-500 text-xs mb-4">{error}</p>}

                      <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition mb-5 text-center disabled:opacity-50"
                      >
                        {loading ? "Logging in..." : "Login"}
                      </button>
                    </form>
                  </>
                )}

                <div className="flex items-center gap-3 mb-5">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400 font-semibold">
                    OR
                  </span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                <button 
                  onClick={onGoogleClick}
                  disabled={loading}
                  className="w-full border border-gray-200 py-3 rounded-lg flex items-center justify-center gap-2 hover:shadow disabled:opacity-50"
                >
                  <GoogleIcon />
                  Sign in with Google
                </button>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-serif mb-1">
                  Create your account
                </h2>

                <form onSubmit={handleAuth}>
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="w-full mb-4 px-4 py-3 rounded-lg bg-gray-100 focus:bg-white focus:border focus:border-blue-500 outline-none"
                  />

                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full mb-4 px-4 py-3 rounded-lg bg-gray-100 focus:bg-white focus:border focus:border-blue-500 outline-none"
                  />

                  <input
                    type="text"
                    placeholder="Company Name"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                    className="w-full mb-4 px-4 py-3 rounded-lg bg-gray-100 focus:bg-white focus:border focus:border-blue-500 outline-none"
                  />

                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full mb-4 px-4 py-3 rounded-lg bg-gray-100 focus:bg-white focus:border focus:border-blue-500 outline-none"
                  />

                  {error && <p className="text-red-500 text-xs mb-4">{error}</p>}

                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition mb-5 text-center disabled:opacity-50"
                  >
                    {loading ? "Creating Account..." : "Create Account"}
                  </button>
                </form>

                <div className="flex items-center gap-3 mb-5">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400 font-semibold">
                    OR
                  </span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                <button 
                  onClick={onGoogleClick}
                  disabled={loading}
                  className="w-full border border-gray-200 py-3 rounded-lg flex items-center justify-center gap-2 hover:shadow disabled:opacity-50"
                >
                  <GoogleIcon />
                  Sign Up with Google
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}