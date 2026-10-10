"use client";
import { useState } from "react";
import { ArrowRight, LockKeyhole, ShieldCheck, Loader2 } from "lucide-react";
import { ErrorMessage } from "./ui";
export function SignIn({ configured }: { configured: boolean }) {
  const [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <main className="signin-page">
      <a className="signin-brand" href="/">
        <ShieldCheck size={30} />
        QuoteGuard
      </a>
      <section className="signin-card">
        <span className="signin-icon">
          <LockKeyhole size={26} />
        </span>
        <div className="eyebrow">YOUR MANUFACTURING WORKSPACE</div>
        <h1>
          Good work starts
          <br />
          with a clear quote.
        </h1>
        <p>
          Quote, source, plan, and make.
          <br />
          One simple workspace, wherever you are.
        </p>
        {configured ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                const res = await fetch("/api/auth", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ password }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                window.location.assign("/");
              } catch (e) {
                setError((e as Error).message);
                setBusy(false);
              }
            }}
          >
            <label className="field">
              Workspace passcode
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your passcode"
                required
              />
            </label>
            <ErrorMessage message={error} />
            <button
              className="button primary full"
              disabled={busy || !password}
            >
              {busy ? <Loader2 className="spin" size={17} /> : null}
              {busy ? "Opening workspace…" : "Open workspace"}
              <ArrowRight size={17} />
            </button>
            <p className="signin-note">
              Private prototype · request the passcode from the workspace owner.
            </p>
          </form>
        ) : (
          <div className="callout neutral">
            Workspace setup is in progress. Please check back shortly.
          </div>
        )}
      </section>
      <footer>
        <ShieldCheck size={15} />
        Your workspace stays private.
      </footer>
    </main>
  );
}
