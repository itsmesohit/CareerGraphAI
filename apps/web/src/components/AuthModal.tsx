import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api, ApiError } from '../api/client.js';
import { X, Mail, Lock, User, KeyRound, AlertCircle, CheckCircle2, ArrowRight, RefreshCw, ExternalLink } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  initialMode: 'login' | 'register';
  onClose: () => void;
}

type AuthMode = 'login' | 'register' | 'otp_request' | 'verify_otp';

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, initialMode, onClose }) => {
  const { setAuth } = useAuth();
  const [mode, setMode] = useState<AuthMode>(initialMode);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpPurpose, setOtpPurpose] = useState<'VERIFY_EMAIL' | 'LOGIN'>('VERIFY_EMAIL');

  // Status & error states
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Cooldown timer state
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setErrorMessage(null);
      setSuccessNotice(null);
    }
  }, [isOpen, initialMode]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  if (!isOpen) return null;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await api.register({ name, email, password });
      setSuccessNotice(res.message);
      setOtpPurpose('VERIFY_EMAIL');
      setCooldownSeconds(res.cooldownSeconds || 60);
      setMode('verify_otp');
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await api.login({ email, password });
      if (res.requiresVerification) {
        setSuccessNotice(res.message || 'Verification required.');
        setOtpPurpose('VERIFY_EMAIL');
        setCooldownSeconds(60);
        setMode('verify_otp');
      } else if (res.user && res.accessToken) {
        setAuth(res.user, res.accessToken);
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await api.requestOtpLogin({ email });
      setSuccessNotice(res.message);
      setOtpPurpose('LOGIN');
      setCooldownSeconds(res.cooldownSeconds || 60);
      setMode('verify_otp');
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not send verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      let res;
      if (otpPurpose === 'VERIFY_EMAIL') {
        res = await api.verifyOtp({ email, code: otpCode, purpose: 'VERIFY_EMAIL' });
      } else {
        res = await api.verifyOtpLogin({ email, code: otpCode });
      }

      setAuth(res.user, res.accessToken);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (cooldownSeconds > 0) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await api.resendOtp({ email, purpose: otpPurpose });
      setSuccessNotice(res.message);
      setCooldownSeconds(res.cooldownSeconds || 60);
    } catch (err: any) {
      setErrorMessage(err.message || 'Resend failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden p-6 sm:p-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-600 mb-3">
            {mode === 'verify_otp' ? (
              <KeyRound className="w-6 h-6" />
            ) : (
              <Lock className="w-6 h-6" />
            )}
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            {mode === 'register' && 'Create Candidate Workspace'}
            {mode === 'login' && 'Sign in to CareerGraph'}
            {mode === 'otp_request' && 'Passwordless Sign In'}
            {mode === 'verify_otp' && 'Verify 6-Digit Code'}
          </h2>
          <p className="text-xs text-slate-500 mt-1.5">
            {mode === 'verify_otp'
              ? `Code sent to ${email}. Single-use & valid for 10 minutes.`
              : 'Autonomous graph-powered application SaaS platform'}
          </p>
        </div>

        {/* Alerts */}
        {errorMessage && (
          <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successNotice && (
          <div className="mb-5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
            <div className="flex-1">
              <span>{successNotice}</span>
              <div className="mt-1 flex items-center gap-1.5 text-sky-600">
                <a
                  href="http://localhost:8025"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 underline hover:text-sky-500"
                >
                  Open local Mailpit mailbox (localhost:8025) <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* 1. Register Form */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Chen"
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Password <span className="text-slate-500 text-[10px]">(8+ chars, upper, lower, digit)</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-60"
            >
              {isLoading ? 'Creating Account...' : 'Continue to Email Verification'}
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="text-center pt-2">
              <span className="text-xs text-slate-500">Already registered? </span>
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-xs text-sky-600 hover:underline font-medium"
              >
                Sign in with password
              </button>
            </div>
          </form>
        )}

        {/* 2. Password Login Form */}
        {mode === 'login' && (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-semibold text-slate-700">Password</label>
                <button
                  type="button"
                  onClick={() => setMode('otp_request')}
                  className="text-[11px] text-sky-600 hover:underline"
                >
                  Sign in with email OTP instead
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-60"
            >
              {isLoading ? 'Authenticating...' : 'Sign In'}
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="text-center pt-2">
              <span className="text-xs text-slate-500">Need an account? </span>
              <button
                type="button"
                onClick={() => setMode('register')}
                className="text-xs text-sky-600 hover:underline font-medium"
              >
                Sign up for free
              </button>
            </div>
          </form>
        )}

        {/* 3. Passwordless OTP Request Form */}
        {mode === 'otp_request' && (
          <form onSubmit={handleOtpRequest} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Account Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-60"
            >
              {isLoading ? 'Sending Code...' : 'Send 6-Digit Login Code'}
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-xs text-slate-500 hover:text-slate-900"
              >
                ← Back to password login
              </button>
            </div>
          </form>
        )}

        {/* 4. 6-Digit OTP Verification Form */}
        {mode === 'verify_otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2 text-center">
                Enter 6-Digit Verification Code
              </label>
              <input
                type="text"
                required
                maxLength={6}
                pattern="\d{6}"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                className="w-full text-center tracking-[0.5em] text-2xl font-mono py-3.5 bg-white border-2 border-sky-500/40 rounded-xl text-sky-600 focus:outline-none focus:border-sky-400"
                autoFocus
              />
              <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500 px-1">
                <span>Max 5 attempts</span>
                <span>Expires in 10 minutes</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || otpCode.length !== 6}
              className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isLoading ? 'Verifying Code...' : 'Verify & Continue'}
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Resend Cooldown Counter */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-slate-500 hover:text-slate-900"
              >
                ← Use different account
              </button>

              <button
                type="button"
                onClick={handleResendOtp}
                disabled={cooldownSeconds > 0 || isLoading}
                className="inline-flex items-center gap-1.5 text-sky-600 hover:underline disabled:text-slate-500 disabled:no-underline font-medium"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                {cooldownSeconds > 0 ? `Resend code (${cooldownSeconds}s)` : 'Resend code'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
