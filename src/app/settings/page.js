"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { useCallback, useEffect, useState } from "react";
import { FaLinkedin } from "react-icons/fa";
import {
  HiOutlineEnvelope,
  HiOutlinePhone,
  HiOutlineSparkles,
} from "react-icons/hi2";
import { SiWhatsapp } from "react-icons/si";
import { toast } from "sonner";

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

function StatusBadge({ status }) {
  const styles = {
    connected: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    checkpoint_required: "bg-amber-50 text-amber-700 ring-amber-600/20",
    pending: "bg-gray-50 text-gray-600 ring-gray-500/20",
  };
  const labels = {
    connected: "Connected",
    checkpoint_required: "Verification required",
    pending: "Pending",
  };
  const key = status in styles ? status : "pending";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${styles[key]}`}
    >
      {labels[key]}
    </span>
  );
}

function IntegrationCard({ icon, title, description, status = "coming_soon", children }) {
  const isSoon = status === "coming_soon";
  return (
    <div
      className={`rounded-lg border bg-white p-4 shadow-sm ${
        isSoon ? "border-gray-100 opacity-75" : "border-gray-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gray-50 text-gray-600">
            {icon}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            <p className="mt-0.5 text-sm leading-snug text-gray-500">{description}</p>
          </div>
        </div>
        {isSoon ? (
          <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
            Soon
          </span>
        ) : null}
      </div>
      {children ? <div className="mt-3 border-t border-gray-100 pt-3">{children}</div> : null}
    </div>
  );
}

function LinkedInSection({ integration, onRefresh }) {
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
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status="connected" />
          <span className="text-sm text-gray-500">
            {integration.accountName || integration.email}
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
          <div>
            <dt className="text-gray-400">Proxy region</dt>
            <dd className="text-gray-700">{integration.country}</dd>
          </div>
          {integration.connectedAt ? (
            <div>
              <dt className="text-gray-400">Connected</dt>
              <dd className="text-gray-700">
                {new Date(integration.connectedAt).toLocaleString()}
              </dd>
            </div>
          ) : null}
        </dl>
        <button
          type="button"
          onClick={handleDisconnect}
          disabled={disconnecting}
          className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
        >
          {disconnecting ? "Disconnecting…" : "Disconnect account"}
        </button>
      </div>
    );
  }

  if (needsCheckpoint) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status="checkpoint_required" />
          <span className="text-sm text-gray-500">{integration.email}</span>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">
          {checkpointMessage ||
            (isAppChallenge
              ? "Approve the sign-in request in your LinkedIn mobile app, then confirm below."
              : "Enter the verification code from your email, SMS, or authenticator app.")}
        </p>
        <form onSubmit={handleCheckpoint} className="space-y-3">
          {!isAppChallenge ? (
            <div className="max-w-xs">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Verification code
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={loading || (!isAppChallenge && !code.trim())}
              className="rounded-md bg-sky-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-50"
            >
              {loading ? "Verifying…" : isAppChallenge ? "I've approved in the app" : "Verify & connect"}
            </button>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="rounded-md border border-gray-200 px-3.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <form onSubmit={handleLogin} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            LinkedIn email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Password
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Proxy region
          </label>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            {PROXY_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-xs text-gray-400 leading-relaxed max-w-2xl">
        Credentials are sent securely to LinkupAPI for connection. We store only the account ID and status.
      </p>
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-[#0A66C2] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#004182] disabled:opacity-50"
      >
        {loading ? "Connecting…" : "Connect LinkedIn"}
      </button>
    </form>
  );
}

const SettingsPage = () => {
  const [integration, setIntegration] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchIntegration = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/linkedin");
      if (!res.ok) throw new Error("Failed to load integrations");
      const data = await res.json();
      setIntegration(data.integration);
    } catch (err) {
      toast.error(err.message);
      setIntegration(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIntegration();
  }, [fetchIntegration]);

  return (
    <div className="p-5 lg:p-7 w-full space-y-8">
      <header>
        <h1 className="text-lg font-semibold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Connect channels and tools used by your outreach campaigns.
        </p>
      </header>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
          Integrations
        </h2>
        <div className="space-y-3">
          <IntegrationCard
            icon={<FaLinkedin className="h-4 w-4 text-[#0A66C2]" />}
            title="LinkedIn"
            description="Connect via LinkupAPI for profile visits, messages, and connection requests."
            status="active"
          >
            {loading ? (
              <p className="text-sm text-gray-500">Loading…</p>
            ) : (
              <LinkedInSection integration={integration} onRefresh={fetchIntegration} />
            )}
          </IntegrationCard>

          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <IntegrationCard
              icon={<SiWhatsapp className="h-4 w-4 text-[#25D366]" />}
              title="WhatsApp"
              description="Business messaging for multi-channel sequences."
            />

            <IntegrationCard
              icon={<HiOutlineEnvelope className="h-4 w-4" />}
              title="Email"
              description="Smartlead and Maildoso for cold email delivery."
            />

            <IntegrationCard
              icon={<HiOutlinePhone className="h-4 w-4" />}
              title="AI Calling"
              description="Voice outreach and call follow-ups."
            />
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
          Workspace
        </h2>
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-4">
          <div className="flex items-center gap-2 text-gray-400">
            <HiOutlineSparkles className="h-4 w-4" />
            <p className="text-sm">More workspace settings coming soon.</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default DashboardLayout()(SettingsPage);
