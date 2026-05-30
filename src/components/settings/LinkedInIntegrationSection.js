"use client";

import { useState } from "react";
import { toast } from "sonner";
import IntegrationStatusBadge from "@/components/settings/IntegrationStatusBadge";

const PROXY_COUNTRIES = [
  { code: "US", label: "United States" },
  { code: "UK", label: "United Kingdom" },
  { code: "FR", label: "France" },
  { code: "DE", label: "Germany" },
  { code: "NL", label: "Netherlands" },
  { code: "IT", label: "Italy" },
  { code: "IL", label: "Israel" },
  { code: "CA", label: "Canada" },
  { code: "BR", label: "Brazil" },
  { code: "ES", label: "Spain" },
  { code: "IN", label: "India" },
];

export default function LinkedInIntegrationSection({ integration, onRefresh }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [country, setCountry] = useState("US");
  const [code, setCode] = useState("");
  const [checkpointMessage, setCheckpointMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const isConnected = integration?.status === "connected";
  const needsCheckpoint = integration?.status === "checkpoint_required";
  const isAppChallenge = integration?.challengeType === "app_challenge";

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/integrations/linkedin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, country }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");

      setPassword("");
      if (data.integration?.status === "checkpoint_required") {
        setCheckpointMessage(data.message || "");
        toast.info(data.message || "Verification required — enter your code below.");
      } else {
        setCheckpointMessage("");
        toast.success("LinkedIn account connected.");
      }
      onRefresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckpoint = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/integrations/linkedin/checkpoint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isAppChallenge ? {} : { code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");

      setCode("");
      setCheckpointMessage("");
      toast.success("LinkedIn account connected.");
      onRefresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/integrations/linkedin", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to disconnect");
      }
      setEmail("");
      setPassword("");
      setCode("");
      setCheckpointMessage("");
      toast.success("LinkedIn disconnected.");
      onRefresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDisconnecting(false);
    }
  };

  if (isConnected) {
    return (
      <div className="space-y-5">
        <section className="rounded-lg border border-brand-secondary/30 bg-brand-bg/50 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-brand-steel">
            Account
          </h3>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <IntegrationStatusBadge status="connected" />
            <span className="text-sm text-brand-stone">
              {integration.accountName || integration.email}
            </span>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs text-brand-steel">Proxy region</dt>
              <dd className="mt-0.5 font-medium text-brand-ink">{integration.country}</dd>
            </div>
            {integration.connectedAt ? (
              <div>
                <dt className="text-xs text-brand-steel">Connected</dt>
                <dd className="mt-0.5 font-medium text-brand-ink">
                  {new Date(integration.connectedAt).toLocaleString()}
                </dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section className="rounded-lg border border-red-100 bg-red-50/30 p-4">
          <h3 className="text-sm font-medium text-brand-ink">Disconnect</h3>
          <p className="mt-1 text-sm text-brand-stone">
            Remove this LinkedIn account from your workspace. Campaign steps using LinkedIn will
            stop until you reconnect.
          </p>
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="mt-3 rounded-md border border-red-200 bg-brand-surface px-3.5 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {disconnecting ? "Disconnecting…" : "Disconnect account"}
          </button>
        </section>
      </div>
    );
  }

  if (needsCheckpoint) {
    return (
      <div className="space-y-4">
        <section className="rounded-lg border border-brand-terracotta/40 bg-brand-terracotta/15 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <IntegrationStatusBadge status="checkpoint_required" />
            <span className="text-sm text-brand-stone">{integration.email}</span>
          </div>
          <p className="mt-3 text-sm text-brand-stone leading-relaxed">
            {checkpointMessage ||
              (isAppChallenge
                ? "Approve the sign-in request in your LinkedIn mobile app, then confirm below."
                : "Enter the verification code from your email, SMS, or authenticator app.")}
          </p>
        </section>

        <form onSubmit={handleCheckpoint} className="space-y-4">
          {!isAppChallenge ? (
            <div>
              <label className="block text-xs font-medium text-brand-stone mb-1">
                Verification code
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                className="w-full max-w-xs rounded-md border border-brand-secondary/30 px-3 py-2 text-sm text-brand-ink placeholder:text-brand-steel focus:border-brand-sage focus:outline-none focus:ring-1 focus:ring-brand-sage"
              />
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={loading || (!isAppChallenge && !code.trim())}
              className="rounded-md bg-brand-dark px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-ink disabled:opacity-50"
            >
              {loading ? "Verifying…" : isAppChallenge ? "I've approved in the app" : "Verify & connect"}
            </button>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="rounded-md border border-brand-secondary/30 px-3.5 py-2 text-sm font-medium text-brand-stone hover:bg-brand-bg disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-brand-stone leading-relaxed">
        Sign in with your LinkedIn credentials. Clarwiz uses LinkupAPI for profile visits,
        messages, and connection requests. We store only the account ID and connection status.
      </p>

      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-brand-stone mb-1">
              LinkedIn email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full rounded-md border border-brand-secondary/30 px-3 py-2 text-sm text-brand-ink placeholder:text-brand-steel focus:border-brand-sage focus:outline-none focus:ring-1 focus:ring-brand-sage"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-brand-stone mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-brand-secondary/30 px-3 py-2 text-sm text-brand-ink focus:border-brand-sage focus:outline-none focus:ring-1 focus:ring-brand-sage"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-brand-stone mb-1">Proxy region</label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full rounded-md border border-brand-secondary/30 px-3 py-2 text-sm text-brand-ink focus:border-brand-sage focus:outline-none focus:ring-1 focus:ring-brand-sage"
            >
              {PROXY_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-[#0A66C2] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#004182] disabled:opacity-50"
        >
          {loading ? "Connecting…" : "Connect LinkedIn"}
        </button>
      </form>
    </div>
  );
}
