import { useEffect, useState } from "react";
import { Leaf, ShieldCheck } from "lucide-react";
import Dashboard from "../App";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  last_synced_at: string | null;
}
export default function AuthenticatedApp() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [demo, setDemo] = useState(false);
  const [error, setError] = useState(() => {
    const problem = new URLSearchParams(location.search).get(
      "google_auth_error",
    );
    if (problem) history.replaceState(null, "", location.pathname);
    return problem ? "Google sign-in wasn’t completed. Please try again." : "";
  });
  async function checkSession() {
    try {
      const response = await fetch("/api/v1/auth/me", { cache: "no-store" });
      if (response.ok) {
        setUser(await response.json());
        setError("");
      } else if (response.status === 401) setUser(null);
      else throw new Error();
    } catch {
      setError("We couldn’t check your session. Please try again.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    // Retire the old frontend bearer token, which is no longer accepted.
    try {
      localStorage.removeItem("fin_user_session");
    } catch {
      /* Storage may be blocked. */
    }
    void checkSession();
    fetch("/api/v1/auth/google/status")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => setConfigured(data.configured))
      .catch(() => setConfigured(null));
    const expired = () => {
      setUser(null);
      setDemo(false);
      setError("Your session ended. Sign in again to continue.");
    };
    const onFocus = () => void checkSession();
    window.addEventListener("finstream:unauthorized", expired);
    window.addEventListener("focus", onFocus);
    const timer = setInterval(onFocus, 60000);
    return () => {
      window.removeEventListener("finstream:unauthorized", expired);
      window.removeEventListener("focus", onFocus);
      clearInterval(timer);
    };
  }, []);
  async function logout() {
    try {
      const response = await fetch("/api/v1/auth/logout", { method: "POST" });
      if (!response.ok && response.status !== 401) throw new Error();
      setUser(null);
      setDemo(false);
      setError("");
    } catch {
      setError("Sign-out failed. Please try again.");
    }
  }
  if (loading)
    return (
      <div className="auth-shell">
        <p role="status">Checking your session…</p>
      </div>
    );
  if (user || demo)
    return (
      <>
        {error && (
          <div className="auth-notice" role="alert">
            {error}
          </div>
        )}
        <Dashboard
          key={user?.id || "guest-demo"}
          user={user}
          onLogout={logout}
          onExitDemo={() => setDemo(false)}
        />
      </>
    );
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand">
          <span className="brand-mark">
            <Leaf size={23} />
          </span>
          finstream.
        </div>
        <h1>
          Your money.
          <br />
          Your own space.
        </h1>
        <p>
          Sign in to see your spending across accounts and bring your banking
          notifications together.
        </p>
        <a
          className="google-signin"
          href="/api/v1/auth/google/login"
          aria-disabled={configured === false}
          onClick={(e) => {
            if (configured === false) e.preventDefault();
          }}
        >
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.3 3-7.4Z"
            />
            <path
              fill="#34A853"
              d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z"
            />
            <path
              fill="#FBBC05"
              d="M6.4 14a6 6 0 0 1 0-4V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14Z"
            />
            <path
              fill="#EA4335"
              d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.9 5.4L6.4 10c.8-2.3 3-4.1 5.6-4.1Z"
            />
          </svg>
          Sign in with Google
        </a>
        <p className="auth-disclosure">
          With your permission, FinStream reads Gmail banking notifications to
          import transactions. It cannot send or delete your emails.
        </p>
        {configured === false && (
          <p role="alert">
            Google sign-in needs to be configured by the administrator.
          </p>
        )}
        {error && (
          <div role="alert">
            <p>{error}</p>
            <button className="button" onClick={() => void checkSession()}>
              Try again
            </button>
          </div>
        )}
        <button className="text-button" onClick={() => setDemo(true)}>
          Explore a demo
        </button>
        <div className="auth-footnote">
          <ShieldCheck size={18} />
          Your financial activity is only available in your signed-in account.
        </div>
      </section>
    </main>
  );
}
