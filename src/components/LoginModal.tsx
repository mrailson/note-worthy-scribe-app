// ─────────────────────────────────────────────
// LoginModal.tsx
// Inline bottom-sheet login — no page navigation.
// Appears over the current screen when tapping the offline toggle.
// ─────────────────────────────────────────────

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client"; // adjust path if needed

interface LoginModalProps {
  onSuccess: () => void;
  onClose: () => void;
}

export function LoginModal({ onSuccess, onClose }: LoginModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    onSuccess(); // hand control back to ConnectionToggle
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Sheet */}
      <div
        className="
          w-full max-w-lg bg-white rounded-t-2xl px-6 pt-5 pb-10
          shadow-2xl animate-in slide-in-from-bottom duration-300
        "
      >
        {/* Handle bar */}
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-gray-200" />

        <h2 className="text-xl font-semibold text-gray-900 mb-1">Sign in to sync</h2>
        <p className="text-sm text-gray-500 mb-6">
          Your offline recordings will upload automatically once you're in.
        </p>

        {/* Email */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="you@nhs.net"
            autoComplete="email"
            className="
              w-full px-4 py-3 rounded-xl border border-gray-200
              text-gray-900 text-base
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              transition
            "
          />
        </div>

        {/* Password */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="••••••••"
            autoComplete="current-password"
            className="
              w-full px-4 py-3 rounded-xl border border-gray-200
              text-gray-900 text-base
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              transition
            "
          />
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Sign in button */}
        <button
          onClick={handleLogin}
          disabled={loading}
          className="
            w-full py-3.5 rounded-xl bg-blue-600 text-white font-semibold text-base
            hover:bg-blue-700 active:scale-[0.98]
            disabled:opacity-60 disabled:cursor-not-allowed
            transition-all duration-150
          "
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              Signing in…
            </span>
          ) : (
            "Sign in & sync"
          )}
        </button>

        {/* Cancel */}
        <button
          onClick={onClose}
          className="w-full mt-3 py-3 text-sm text-gray-500 hover:text-gray-700 transition"
        >
          Stay offline
        </button>
      </div>
    </div>
  );
}
