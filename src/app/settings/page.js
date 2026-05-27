"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import EmailIntegrationSection from "@/components/settings/EmailIntegrationSection";
import LinkedInIntegrationSection from "@/components/settings/LinkedInIntegrationSection";
import WhatsAppIntegrationSection from "@/components/settings/WhatsAppIntegrationSection";
import CalendlyIntegrationSection from "@/components/settings/CalendlyIntegrationSection";
import IcpContextSection from "@/components/settings/IcpContextSection";
import IntegrationStatusBadge, {
  getCalendlyDisplayStatus,
  getEmailDisplayStatus,
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
import { SiWhatsapp } from "react-icons/si";
import { toast } from "sonner";

const INTEGRATIONS = [
  {
    id: "linkedin",
    title: "LinkedIn",
    description: "Profile visits, messages, and connection requests via LinkupAPI.",
    icon: <FaLinkedin className="h-4 w-4 text-[#0A66C2]" />,
    available: true,
  },
  {
    id: "email",
    title: "Email",
    description: "Smartlead for warmup, outreach, and tracking.",
    icon: <HiOutlineEnvelope className="h-4 w-4 text-sky-700" />,
    available: true,
  },
  {
    id: "whatsapp",
    title: "WhatsApp",
    description: "Meta Cloud API or Interakt for templates and outreach.",
    icon: <SiWhatsapp className="h-4 w-4 text-[#25D366]" />,
    available: true,
  },
  {
    id: "calendly",
    title: "Calendly",
    description: "OAuth + webhooks to qualify leads when meetings are booked.",
    icon: <HiOutlineCalendar className="h-4 w-4 text-[#006BFF]" />,
    available: true,
  },
  {
    id: "ai_calling",
    title: "AI Calling",
    description: "Voice outreach and call follow-ups.",
    icon: <HiOutlinePhone className="h-4 w-4 text-gray-600" />,
    available: false,
  },
];

function getIntegrationStatus(id, linkedin, email, whatsapp, calendly) {
  if (id === "linkedin") return getLinkedInDisplayStatus(linkedin);
  if (id === "email") return getEmailDisplayStatus(email);
  if (id === "whatsapp") return getWhatsAppDisplayStatus(whatsapp);
  if (id === "calendly") return getCalendlyDisplayStatus(calendly);
  return "coming_soon";
}

function getIntegrationSubtitle(id, linkedin, email, whatsapp, calendly) {
  if (id === "linkedin" && linkedin?.status === "connected") {
    return linkedin.accountName || linkedin.email;
  }
  if (id === "linkedin" && linkedin?.email) {
    return linkedin.email;
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

  return (
    <button
      type="button"
      onClick={clickable ? onConfigure : undefined}
      disabled={!clickable}
      className={`flex w-full items-center gap-4 rounded-lg border bg-white p-4 text-left shadow-sm transition-colors ${
        clickable
          ? "border-gray-200 hover:border-sky-200 hover:bg-sky-50/30 cursor-pointer"
          : "border-gray-100 opacity-80 cursor-default"
      }`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-600">
        {item.icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">{item.title}</h3>
          <IntegrationStatusBadge status={status} />
        </div>
        <p className="mt-0.5 text-sm text-gray-500 leading-snug">{item.description}</p>
        {subtitle ? (
          <p className="mt-1 text-xs text-gray-400 truncate">{subtitle}</p>
        ) : null}
      </div>
      {clickable ? (
        <HiOutlineChevronRight className="h-5 w-5 shrink-0 text-gray-400" aria-hidden />
      ) : null}
    </button>
  );
}

function ComingSoonPanel({ title, description }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center">
      <p className="text-sm font-medium text-gray-700">{title}</p>
      <p className="mt-2 text-sm text-gray-500">{description}</p>
      <p className="mt-4 text-xs text-gray-400">This integration is not available yet.</p>
    </div>
  );
}

const SettingsPage = () => {
  const [linkedinIntegration, setLinkedinIntegration] = useState(null);
  const [emailIntegration, setEmailIntegration] = useState(null);
  const [whatsappIntegration, setWhatsappIntegration] = useState(null);
  const [calendlyIntegration, setCalendlyIntegration] = useState(null);
  const [loadingLinkedin, setLoadingLinkedin] = useState(true);
  const [loadingEmail, setLoadingEmail] = useState(true);
  const [loadingWhatsapp, setLoadingWhatsapp] = useState(true);
  const [loadingCalendly, setLoadingCalendly] = useState(true);
  const [activeIntegrationId, setActiveIntegrationId] = useState(null);

  const drawer = useDisclosure();

  const fetchLinkedin = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/linkedin");
      if (!res.ok) throw new Error("Failed to load LinkedIn integration");
      const data = await res.json();
      setLinkedinIntegration(data.integration);
    } catch (err) {
      toast.error(err.message);
      setLinkedinIntegration(null);
    } finally {
      setLoadingLinkedin(false);
    }
  }, []);

  const fetchEmail = useCallback(async (refresh = false) => {
    try {
      const res = await fetch(
        `/api/integrations/email${refresh ? "?refresh=true" : ""}`
      );
      if (!res.ok) throw new Error("Failed to load email integration");
      const data = await res.json();
      setEmailIntegration(data.integration);
    } catch (err) {
      toast.error(err.message);
      setEmailIntegration(null);
    } finally {
      setLoadingEmail(false);
    }
  }, []);

  const fetchWhatsapp = useCallback(async (refresh = false) => {
    try {
      const res = await fetch(
        `/api/integrations/whatsapp${refresh ? "?refresh=true" : ""}`
      );
      if (!res.ok) throw new Error("Failed to load WhatsApp integration");
      const data = await res.json();
      setWhatsappIntegration(data.integration);
    } catch (err) {
      toast.error(err.message);
      setWhatsappIntegration(null);
    } finally {
      setLoadingWhatsapp(false);
    }
  }, []);

  const fetchCalendly = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/calendly");
      if (!res.ok) throw new Error("Failed to load Calendly integration");
      const data = await res.json();
      setCalendlyIntegration(data.integration);
    } catch (err) {
      toast.error(err.message);
      setCalendlyIntegration(null);
    } finally {
      setLoadingCalendly(false);
    }
  }, []);

  useEffect(() => {
    fetchLinkedin();
    fetchEmail();
    fetchWhatsapp();
    fetchCalendly();
  }, [fetchLinkedin, fetchEmail, fetchWhatsapp, fetchCalendly]);

  const openIntegration = (id) => {
    setActiveIntegrationId(id);
    drawer.onOpen();
  };

  const closeDrawer = () => {
    drawer.onClose();
    setActiveIntegrationId(null);
  };

  const activeItem = INTEGRATIONS.find((i) => i.id === activeIntegrationId);

  const renderDrawerContent = () => {
    if (!activeItem) return null;

    if (activeItem.id === "linkedin") {
      if (loadingLinkedin) {
        return <p className="text-sm text-gray-500">Loading LinkedIn configuration…</p>;
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
        return <p className="text-sm text-gray-500">Loading Calendly configuration…</p>;
      }
      return (
        <CalendlyIntegrationSection
          integration={calendlyIntegration}
          onRefresh={fetchCalendly}
        />
      );
    }

    return (
      <ComingSoonPanel title={activeItem.title} description={activeItem.description} />
    );
  };

  return (
    <div className="p-5 lg:p-7 w-full space-y-8">
      <header>
        <h1 className="text-lg font-semibold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Connect channels and tools used by your outreach campaigns.
        </p>
      </header>

      <section className="max-w-3xl">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Integrations
          </h2>
          <p className="text-xs text-gray-400">Click an integration to configure</p>
        </div>
        <ul className="space-y-2">
          {INTEGRATIONS.map((item) => (
            <li key={item.id}>
              <IntegrationListRow
                item={item}
                status={getIntegrationStatus(
                  item.id,
                  linkedinIntegration,
                  emailIntegration,
                  whatsappIntegration,
                  calendlyIntegration
                )}
                subtitle={getIntegrationSubtitle(
                  item.id,
                  linkedinIntegration,
                  emailIntegration,
                  whatsappIntegration,
                  calendlyIntegration
                )}
                onConfigure={() => openIntegration(item.id)}
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="max-w-3xl">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
          Workspace
        </h2>
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <IcpContextSection />
        </div>
      </section>

      <Drawer isOpen={drawer.isOpen} placement="right" onClose={closeDrawer} size="md">
        <DrawerOverlay />
        <DrawerContent>
          <DrawerHeader borderBottomWidth="1px" className="pr-12">
            {activeItem ? (
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-50">
                  {activeItem.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-base font-semibold text-gray-900">{activeItem.title}</p>
                  <p className="mt-0.5 text-sm font-normal text-gray-500 leading-snug">
                    {activeItem.description}
                  </p>
                  {activeItem.available ? (
                    <div className="mt-2">
                      <IntegrationStatusBadge
                        status={getIntegrationStatus(
                          activeItem.id,
                          linkedinIntegration,
                          emailIntegration,
                          whatsappIntegration,
                          calendlyIntegration
                        )}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </DrawerHeader>
          <DrawerCloseButton />
          <DrawerBody py={6}>{renderDrawerContent()}</DrawerBody>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default DashboardLayout()(SettingsPage);
