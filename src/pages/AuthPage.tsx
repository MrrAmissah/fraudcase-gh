import React, { useState } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../lib/firebase/client";
import { Lock, Mail, Eye, EyeOff, Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { motion } from "motion/react";
import BrandLogo from "../components/BrandLogo";

export default function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Please fill out all required fields.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      let errMsg = "Authentication failed. Please verify your credentials.";
      if (err.code === "auth/email-already-in-use") {
        errMsg = "This email address is already in use.";
      } else if (err.code === "auth/invalid-email") {
        errMsg = "Please enter a valid email address.";
      } else if (err.code === "auth/weak-password") {
        errMsg = "Password is too weak. Choose a stronger password.";
      } else if (err.code === "auth/wrong-password" || err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
        errMsg = "Invalid email or password. Please try again.";
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] py-12 px-4 sm:px-6 lg:px-8" id="auth-page">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl border border-slate-200 shadow-xl"
        id="auth-card"
      >
        {/* Brand Logo & Heading */}
        <div className="text-center space-y-4">
          <BrandLogo variant="full" height={40} className="mx-auto" />
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 font-sans mt-2">
              {isSignUp ? "Create your investigation workspace" : "Sign in to your workspace"}
            </h2>
            <p className="text-xs text-slate-500 max-w-sm mx-auto font-sans">
              Organize digital scam transcripts, capture link metadata, and construct standard incident dossiers securely.
            </p>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200" id="auth-toggle">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(false);
              setError(null);
            }}
            className={`w-1/2 py-2 text-xs font-semibold rounded-lg transition-all ${
              !isSignUp ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSignUp(true);
              setError(null);
            }}
            className={`w-1/2 py-2 text-xs font-semibold rounded-lg transition-all ${
              isSignUp ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Error Notification */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3.5 bg-red-50 border border-red-250 text-red-800 rounded-xl text-xs font-sans leading-normal"
            id="auth-error-alert"
          >
            {error}
          </motion.div>
        )}

        {/* Auth Form */}
        <form className="mt-8 space-y-4" onSubmit={handleSubmit} id="auth-form">
          <div className="space-y-4 rounded-md">
            {/* Email Field */}
            <div className="space-y-1">
              <label htmlFor="email-address" className="text-xs font-semibold text-slate-700 font-sans">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail size={15} />
                </div>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13.5px] text-slate-900 placeholder-slate-400 font-sans focus:outline-none focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label htmlFor="password-field" className="text-xs font-semibold text-slate-700 font-sans">
                  Password
                </label>
                <span className="text-[10px] text-slate-400 font-sans">Min. 6 characters</span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock size={15} />
                </div>
                <input
                  id="password-field"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13.5px] text-slate-900 placeholder-slate-400 font-sans focus:outline-none focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-500 focus:bg-white transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className={`group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-xs font-semibold rounded-xl text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 transition-all cursor-pointer ${
                loading ? "opacity-70 cursor-not-allowed" : ""
              }`}
              id="auth-submit-btn"
            >
              {loading ? (
                <Loader2 className="animate-spin -ml-1 mr-2" size={15} />
              ) : null}
              {isSignUp ? "Create Workspace Key" : "Access Case Files"}
            </button>
          </div>
        </form>

        {/* Feature Benefits Strip */}
        <div className="border-t border-slate-100 mt-6 pt-5 grid grid-cols-2 gap-4 text-left" id="auth-benefits">
          <div className="flex items-start gap-2">
            <CheckCircle2 size={13} className="text-cyan-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <h5 className="font-sans font-semibold text-[11px] text-slate-800 leading-none">Row-Level Safety</h5>
              <p className="font-sans text-[10px] text-slate-400 leading-normal">Isolated owner vaults.</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 size={13} className="text-cyan-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <h5 className="font-sans font-semibold text-[11px] text-slate-800 leading-none">Durable Storage</h5>
              <p className="font-sans text-[10px] text-slate-400 leading-normal">No local memory loss.</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
