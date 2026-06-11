"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import EmailIntegrationSection from "@/components/settings/EmailIntegrationSection";
import GmailIntegrationSection from "@/components/settings/GmailIntegrationSection";
import HubSpotIntegrationSection from "@/components/settings/HubSpotIntegrationSection";
import LinkedInIntegrationSection from "@/components/settings/LinkedInIntegrationSection";
import WhatsAppIntegrationSection from "@/components/settings/WhatsAppIntegrationSection";
import CalendlyIntegrationSection from "@/components/settings/CalendlyIntegrationSection";
import WebhooksStatusSection from "@/components/settings/WebhooksStatusSection";
import { useUser } from "@/context/UserContext";
import IntegrationStatusBadge, {
  getCalendlyDisplayStatus,
  getEmailDisplayStatus,
  getGmailDisplayStatus,
  getHubSpotDisplayStatus,
  getLinkedInDisplayStatus,
  getWhatsAppDisplayStatus,
} from "@/components/settings/IntegrationStatusBadge";
import {
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  useDisclosure,
} from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import { FaLinkedin } from "react-icons/fa";
import { HiOutlineCalendar } from "react-icons/hi2";
import {
  HiOutlineChevronRight,
  HiOutlineEnvelope,
  HiOutlinePhone,
} from "react-icons/hi2";
import { SiGmail, SiHubspot, SiWhatsapp } from "react-icons/si";
import { toast } from "sonner";
import { ui } from "@/lib/brandUi";

const CRM_INTEGRATIONS = [
  {
    id: "hubspot",
    title: "HubSpot",
    description: "Connect your CRM so AE Assist can read deals, companies, and contacts.",
    icon: <SiHubspot className="h-4 w-4 text-[#FF7A59]" />,
    available: true,
  },
];

const EMAIL_INTEGRATIONS = [
  {
    id: "gmail",
    title: "Gmail",
    description:
      "Connect your Gmail to send AE Assist and NBA emails directly from the platform.",
    icon: <SiGmail className="h-4 w-4 text-[#EA4335]" />,
    available: true,
  },
];

const INTEGRATIONS = [
  {
    id: "linkedin",
    title: "LinkedIn",
    description: "Connect this channel.",
    icon: <FaLinkedin className="h-4 w-4 text-[#0A66C2]" />,
    available: true,
  },
  {
    id: "email",
    title: "Smartlead",
    description: "Outbound email for TOFU campaign sequences.",
    icon: <HiOutlineEnvelope className="h-4 w-4 text-brand-terracotta" />,
    available: true,
  },
  {
    id: "whatsapp",
    title: "WhatsApp",
    description: "Connect this channel.",
    icon: <SiWhatsapp className="h-4 w-4 text-[#25D366]" />,
    available: true,
  },
  {
    id: "calendly",
    title: "Calendly",
    description: "Connect this channel.",
    icon: <HiOutlineCalendar className="h-4 w-4 text-[#006BFF]" />,
    available: true,
  },
  {
    id: "ai_calling",
    title: "AI Calling",
    description: "Connect this channel.",
    icon: <HiOutlinePhone className="h-4 w-4 text-brand-stone" />,
    available: false,
  },
];

function getIntegrationStatus(id, linkedin, email, whatsapp, calendly, hubspot, gmail) {
  if (id === "hubspot") return getHubSpotDisplayStatus(hubspot);
  if (id === "gmail") return getGmailDisplayStatus(gmail);
  if (id === "linkedin") return getLinkedInDisplayStatus(linkedin);
  if (id === "email") return getEmailDisplayStatus(email);
  if (id === "whatsapp") return getWhatsAppDisplayStatus(whatsapp);
  if (id === "calendly") return getCalendlyDisplayStatus(calendly);
  return "coming_soon";
}

function getIntegrationSubtitle(id, linkedin, email, whatsapp, calendly, hubspot, gmail) {
  if (id === "hubspot" && hubspot?.configured) {
    return [
      hubspot.hubspotPortalId ? `Portal ${hubspot.hubspotPortalId}` : null,
      hubspot.scopeCount > 0 ? `${hubspot.scopeCount} scopes` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (id === "linkedin" && linkedin?.status === "connected") {
    return linkedin.accountName || linkedin.email;
  }
  if (id === "linkedin" && linkedin?.email) {
    return linkedin.email;
  }
  if (id === "gmail" && gmail?.connected) {
    return gmail.email;
  }
  if (id === "email" && email?.fromEmail) {
    return `${email.fromName ? `${email.fromName} · ` : ""}${email.fromEmail}`;
  }
  if (id === "whatsapp" && whatsapp?.status === "connected") {
    const label = whatsapp.mode === "meta" ? "Meta" : "Interakt";
    const detail = whatsapp.businessPhone || whatsapp.businessName;
    const templates =
      whatsapp.templateCount > 0 ? `${whatsapp.templateCount} templates` : null;
    return [label, detail, templates].filter(Boolean).join(" · ");
  }
  if (id === "calendly" && calendly?.status === "connected") {
    return [calendly.ownerEmail, calendly.webhooksActive ? "Webhooks active" : null]
      .filter(Boolean)
      .join(" · ");
  }
  return null;
}

function IntegrationListRow({ item, status, subtitle, onConfigure }) {
  const clickable = item.available;
  const isConnected = status === "connected";

  return (
    <button
      type="button"
      onClick={clickable ? onConfigure : undefined}
      disabled={!clickable}
      className={`flex w-full items-center gap-4 rounded-lg border bg-brand-surface p-4 text-left shadow-sm transition-colors ${
        isConnected
          ? "border-green-200 hover:border-green-300 hover:bg-green-50/50 cursor-pointer"
          : clickable
            ? "border-brand-secondary/30 hover:border-brand-sage/30 hover:bg-brand-sage/10 cursor-pointer"
            : "border-brand-secondary/15 opacity-80 cursor-default"
      }`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-bg text-brand-stone">
        {item.icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {isConnected ? (
            <span
              className="h-2 w-2 shrink-0 rounded-full bg-green-500"
              aria-hidden
            />
          ) : null}
          <h3 className="text-sm font-semibold text-brand-ink">{item.title}</h3>
          <IntegrationStatusBadge status={status} />
        </div>
        {!isConnected ? (
          <p className="mt-0.5 text-sm text-brand-stone leading-snug">{item.description}</p>
        ) : null}
        {subtitle ? (
          <p className="mt-1 text-xs text-brand-steel truncate">{subtitle}</p>
        ) : null}
      </div>
      {clickable ? (
        <HiOutlineChevronRight className="h-5 w-5 shrink-0 text-brand-steel" aria-hidden />
      ) : null}
    </button>
  );
}

function ComingSoonPanel({ title, description }) {
  return (
    <div className="rounded-lg border border-dashed border-brand-secondary/30 bg-brand-bg/50 p-6 text-center">
      <p className="text-sm font-medium text-brand-stone">{title}</p>
      <p className="mt-2 text-sm text-brand-stone">{description}</p>
      <p className="mt-4 text-xs text-brand-steel">This integration is not available yet.</p>
    </div>
  );
}

const IntegrationsPage = () => {
  const user = useUser();
  const [linkedinIntegration, setLinkedinIntegration] = useState(null);
  const [emailIntegration, setEmailIntegration] = useState(null);
  const [whatsappIntegration, setWhatsappIntegration] = useState(null);
  const [calendlyIntegration, setCalendlyIntegration] = useState(null);
  const [calendlyOAuthSetup, setCalendlyOAuthSetup] = useState(null);
  const [hubspotIntegration, setHubspotIntegration] = useState(null);
  const [gmailIntegration, setGmailIntegration] = useState({ connected: false });
  const [loadingHubspot, setLoadingHubspot] = useState(true);
  const [loadingGmail, setLoadingGmail] = useState(true);
  const [loadingLinkedin, setLoadingLinkedin] = useState(true);
  const [loadingEmail, setLoadingEmail] = useState(true);
  const [loadingWhatsapp, setLoadingWhatsapp] = useState(true);
  const [loadingCalendly, setLoadingCalendly] = useState(true);
  const [activeIntegrationId, setActiveIntegrationId] = useState(null);
  const [webhooksRefreshSignal, setWebhooksRefreshSignal] = useState(0);

  const bumpWebhooks = useCallback(() => {
    setWebhooksRefreshSignal((n) => n + 1);
  }, []);

  const drawer = useDisclosure();

  const fetchLinkedin = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/linkedin");
      if (!res.ok) throw new Error("Failed to load LinkedIn integration");
      const data = await res.json();
      setLinkedinIntegration(data.integration);
      bumpWebhooks();
    } catch (err) {
      toast.error(err.message);
      setLinkedinIntegration(null);
    } finally {
      setLoadingLinkedin(false);
    }
  }, [bumpWebhooks]);

  const fetchEmail = useCallback(async (refresh = false) => {
    try {
      const res = await fetch(
        `/api/integrations/email${refresh ? "?refresh=true" : ""}`
      );
      if (!res.ok) throw new Error("Failed to load email integration");
      const data = await res.json();
      setEmailIntegration(data.integration);
      bumpWebhooks();
    } catch (err) {
      toast.error(err.message);
      setEmailIntegration(null);
    } finally {
      setLoadingEmail(false);
    }
  }, [bumpWebhooks]);

  const fetchWhatsapp = useCallback(async (refresh = false) => {
    try {
      const res = await fetch(
        `/api/integrations/whatsapp${refresh ? "?refresh=true" : ""}`
      );
      if (!res.ok) throw new Error("Failed to load WhatsApp integration");
      const data = await res.json();
      setWhatsappIntegration(data.integration);
      bumpWebhooks();
    } catch (err) {
      toast.error(err.message);
      setWhatsappIntegration(null);
    } finally {
      setLoadingWhatsapp(false);
    }
  }, [bumpWebhooks]);

  const fetchCalendly = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/calendly");
      if (!res.ok) throw new Error("Failed to load Calendly integration");
      const data = await res.json();
      setCalendlyIntegration(data.integration);
      setCalendlyOAuthSetup(data.oauthSetup ?? null);
      bumpWebhooks();
    } catch (err) {
      toast.error(err.message);
      setCalendlyIntegration(null);
    } finally {
      setLoadingCalendly(false);
    }
  }, [bumpWebhooks]);

  const fetchHubspot = useCallback(async () => {
    try {
      const res = await fetch("/api/assist/settings");
      if (!res.ok) throw new Error("Failed to load HubSpot integration");
      const data = await res.json();
      setHubspotIntegration(data.integration ?? { configured: false });
    } catch (err) {
      toast.error(err.message);
      setHubspotIntegration({ configured: false });
    } finally {
      setLoadingHubspot(false);
    }
  }, []);

  const fetchGmail = useCallback(async () => {
    try {
      const res = await fetch("/api/assist/gmail");
      if (!res.ok) throw new Error("Failed to load Gmail connection");
      const data = await res.json();
      setGmailIntegration(data.gmail ?? { connected: false });
    } catch (err) {
      toast.error(err.message);
      setGmailIntegration({ connected: false });
    } finally {
      setLoadingGmail(false);
    }
  }, []);

  useEffect(() => {
    fetchLinkedin();
    fetchEmail();
    fetchWhatsapp();
    fetchCalendly();
    fetchHubspot();
    fetchGmail();
  }, [fetchLinkedin, fetchEmail, fetchWhatsapp, fetchCalendly, fetchHubspot, fetchGmail]);

  const openIntegration = (id) => {
    setActiveIntegrationId(id);
    drawer.onOpen();
  };

  const closeDrawer = () => {
    drawer.onClose();
    setActiveIntegrationId(null);
  };

  const activeItem =
    INTEGRATIONS.find((i) => i.id === activeIntegrationId) ??
    EMAIL_INTEGRATIONS.find((i) => i.id === activeIntegrationId) ??
    CRM_INTEGRATIONS.find((i) => i.id === activeIntegrationId);
  const activeIntegrationStatus = activeItem
    ? getIntegrationStatus(
        activeItem.id,
        linkedinIntegration,
        emailIntegration,
        whatsappIntegration,
        calendlyIntegration,
        hubspotIntegration,
        gmailIntegration
      )
    : null;

  const renderDrawerContent = () => {
    if (!activeItem) return null;

    if (activeItem.id === "linkedin") {
      if (loadingLinkedin) {
        return <p className="text-sm text-brand-stone">Loading LinkedIn configuration…</p>;
      }
      return (
        <LinkedInIntegrationSection
          integration={linkedinIntegration}
          onRefresh={fetchLinkedin}
        />
      );
    }

    if (activeItem.id === "email") {
      return (
        <EmailIntegrationSection
          integration={emailIntegration}
          loading={loadingEmail}
          onRefresh={fetchEmail}
        />
      );
    }

    if (activeItem.id === "whatsapp") {
      return (
        <WhatsAppIntegrationSection
          integration={whatsappIntegration}
          loading={loadingWhatsapp}
          onRefresh={fetchWhatsapp}
        />
      );
    }

    if (activeItem.id === "calendly") {
      if (loadingCalendly) {
        return <p className="text-sm text-brand-stone">Loading Calendly configuration…</p>;
      }
      return (
        <CalendlyIntegrationSection
          integration={calendlyIntegration}
          oauthSetup={calendlyOAuthSetup}
          onRefresh={fetchCalendly}
        />
      );
    }

    if (activeItem.id === "hubspot") {
      return (
        <HubSpotIntegrationSection
          integration={hubspotIntegration}
          loading={loadingHubspot}
          onRefresh={fetchHubspot}
        />
      );
    }

    if (activeItem.id === "gmail") {
      return (
        <GmailIntegrationSection
          gmail={gmailIntegration}
          loading={loadingGmail}
          onRefresh={fetchGmail}
          returnTo="integrations"
        />
      );
    }

    return (
      <ComingSoonPanel title={activeItem.title} description={activeItem.description} />
    );
  };

  return (
    <div className={`${ui.page} p-5 lg:p-7 w-full space-y-8`}>
      <header>
        <h1 className={ui.title}>Integrations</h1>
        <p className={ui.subtitle}>
          Connect channels and tools used by your outreach campaigns.
        </p>
      </header>

      <section className="w-full">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-brand-steel">
            Connect CRM
          </h2>
          <p className="text-xs text-brand-steel">Click an integration to configure</p>
        </div>
        <ul className="space-y-2">
          {CRM_INTEGRATIONS.map((item) => (
            <li key={item.id}>
              <IntegrationListRow
                item={item}
                status={getIntegrationStatus(
                  item.id,
                  linkedinIntegration,
                  emailIntegration,
                  whatsappIntegration,
                  calendlyIntegration,
                  hubspotIntegration,
                  gmailIntegration
                )}
                subtitle={getIntegrationSubtitle(
                  item.id,
                  linkedinIntegration,
                  emailIntegration,
                  whatsappIntegration,
                  calendlyIntegration,
                  hubspotIntegration,
                  gmailIntegration
                )}
                onConfigure={() => openIntegration(item.id)}
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="w-full">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-brand-steel">
            Email
          </h2>
          <p className="text-xs text-brand-steel">Click an integration to configure</p>
        </div>
        <ul className="space-y-2">
          {EMAIL_INTEGRATIONS.map((item) => (
            <li key={item.id}>
              <IntegrationListRow
                item={item}
                status={getIntegrationStatus(
                  item.id,
                  linkedinIntegration,
                  emailIntegration,
                  whatsappIntegration,
                  calendlyIntegration,
                  hubspotIntegration,
                  gmailIntegration
                )}
                subtitle={getIntegrationSubtitle(
                  item.id,
                  linkedinIntegration,
                  emailIntegration,
                  whatsappIntegration,
                  calendlyIntegration,
                  hubspotIntegration,
                  gmailIntegration
                )}
                onConfigure={() => openIntegration(item.id)}
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="w-full">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-brand-steel">
            Channels
          </h2>
          <p className="text-xs text-brand-steel">Click an integration to configure</p>
        </div>
        <ul className="space-y-2">
          {INTEGRATIONS.filter((item) => {
            if (item.id === "linkedin" || item.id === "email" || item.id === "whatsapp" || item.id === "calendly") {
              return user?.canAccessChannelIntegration !== false;
            }
            return true;
          }).map((item) => (
            <li key={item.id}>
              <IntegrationListRow
                item={item}
                status={getIntegrationStatus(
                  item.id,
                  linkedinIntegration,
                  emailIntegration,
                  whatsappIntegration,
                  calendlyIntegration,
                  hubspotIntegration,
                  gmailIntegration
                )}
                subtitle={getIntegrationSubtitle(
                  item.id,
                  linkedinIntegration,
                  emailIntegration,
                  whatsappIntegration,
                  calendlyIntegration,
                  hubspotIntegration,
                  gmailIntegration
                )}
                onConfigure={() => openIntegration(item.id)}
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="w-full">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-brand-steel mb-3">
          Webhooks
        </h2>
        <div className={ui.panelSurface}>
          <WebhooksStatusSection refreshSignal={webhooksRefreshSignal} />
        </div>
      </section>

      <Drawer isOpen={drawer.isOpen} placement="right" onClose={closeDrawer} size="md">
        <DrawerOverlay />
        <DrawerContent className="!bg-brand-surface">
          <DrawerHeader borderBottomWidth="1px" className="pr-12 !bg-brand-surface">
            {activeItem ? (
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-bg">
                  {activeItem.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-base font-semibold text-brand-ink">{activeItem.title}</p>
                  {activeIntegrationStatus !== "connected" ? (
                    <p className="mt-0.5 text-sm font-normal text-brand-stone leading-snug">
                      {activeItem.description}
                    </p>
                  ) : null}
                  {activeItem.available ? (
                    <div className="mt-2">
                      <IntegrationStatusBadge status={activeIntegrationStatus} />
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </DrawerHeader>
          <DrawerCloseButton />
          <DrawerBody py={6} className="!bg-brand-surface">{renderDrawerContent()}</DrawerBody>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default DashboardLayout()(IntegrationsPage);
