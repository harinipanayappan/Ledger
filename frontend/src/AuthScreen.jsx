import { useState } from "react";
import { api } from "./api";
import { useAuth } from "./AuthContext";

export function AuthScreen() {
  const { login } = useAuth();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const fn = mode === "login" ? api.login : api.register;
      const data = await fn(email, password);
      login(data.token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-4xl text-paper mb-1">Ledger</h1>
        <p className="text-stone text-sm mb-8">
          A watchlist that tells you what actually changed since you last looked.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wide text-stone mb-1.5" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-paper-dim/10 border border-stone/30 rounded px-3 py-2.5 text-paper text-sm focus:outline-none focus:border-pine focus:ring-1 focus:ring-pine"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-stone mb-1.5" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-paper-dim/10 border border-stone/30 rounded px-3 py-2.5 text-paper text-sm focus:outline-none focus:border-pine focus:ring-1 focus:ring-pine"
              placeholder="At least 6 characters"
            />
          </div>

          {error && <p className="text-rust text-sm">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-pine hover:bg-pine/90 disabled:opacity-50 text-paper rounded px-3 py-2.5 text-sm font-medium transition-colors"
          >
            {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          className="mt-5 text-sm text-stone hover:text-paper transition-colors"
        >
          {mode === "login" ? "New here? Create an account" : "Already have an account? Log in"}
        </button>
      </div>
    </div>
  );
}
