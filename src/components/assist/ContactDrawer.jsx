"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
} from "@chakra-ui/react";
import { toast } from "sonner";
import ContactCommThread from "@/components/campaigns/ContactCommThread";
import { DEFAULT_ENABLED_CHANNELS } from "@/lib/campaignChannels";
import ContactProfileSection from "./ContactProfileSection";
import TofuCampaignPanel from "./TofuCampaignPanel";
import AssistBadge from "./ui/AssistBadge";
import { AssistEmpty } from "./ui/AssistPanel";
import { KvGrid, SectionTitle, InsightRow } from "./ui/AssistPrimitives";
import { ui } from "@/lib/brandUi";

const PERSONA_LABEL = {
  DECISION_MAKER: "Decision Maker",
  CHAMPION: "Champion",
  INFLUENCER: "Influencer",
  BLOCKER: "Blocker",
  END_USER: "End User",
  OTHER: "Contact",
};

function s(v) {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export default function ContactDrawer({ contactId, dealId = null, isOpen, onClose }) {
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState(null);
  const [activeTofuId, setActiveTofuId] = useState(null);

  const loadView = useCallback(async (id) => {
    setLoading(true);
    setView(null);
    try {
      const qs = dealId ? `?dealId=${encodeURIComponent(dealId)}` : "";
      const res = await fetch(`/api/assist/contact/${id}/view${qs}`);
      if (!res.ok) {
        toast.error("Could not load contact");
        return;
      }
      const data = await res.json();
      setView(data.view);
      const defaultTofu =
        data.view?.tofuProspectView?.campaignContactId ??
        data.view?.tofuProspectViews?.[0]?.campaignContactId ??
        null;
      setActiveTofuId(defaultTofu);
    } catch {
      toast.error("Could not load contact");
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    if (isOpen && contactId) loadView(contactId);
  }, [isOpen, contactId, loadView]);

  const contact = view?.contact ?? null;
  const businessUser = view?.businessUser ?? contact?.businessUser ?? null;
  const company = view?.company ?? businessUser?.company ?? null;
  const nbas = Array.isArray(view?.nbas) ? view.nbas : [];
  const dealContact = view?.dealContact ?? null;
  const campaignContexts = Array.isArray(view?.campaignContexts) ? view.campaignContexts : [];
  const tofuProspectViews = Array.isArray(view?.tofuProspectViews) ? view.tofuProspectViews : [];
  const hasTofu = tofuProspectViews.length > 0;

  const activeTofu = useMemo(
    () =>
      tofuProspectViews.find((v) => v.campaignContactId === activeTofuId) ??
      view?.tofuProspectView ??
      null,
    [tofuProspectViews, activeTofuId, view?.tofuProspectView]
  );

  const persona = PERSONA_LABEL[contact?.persona] ?? "Contact";

  const name =
    businessUser?.name ||
    [businessUser?.firstName, businessUser?.lastName].filter(Boolean).join(" ") ||
    businessUser?.email ||
    "Contact";

  const handleSent = async (data) => {
    if (data?.campaign && activeTofu?.campaignContactId) {
      const rows = data.campaign.contacts ?? data.campaign.prospects ?? [];
      const updated = rows.find((p) => p.id === activeTofu.campaignContactId);
      if (updated) {
        setView((prev) => {
          if (!prev) return prev;
          const nextViews = (prev.tofuProspectViews ?? []).map((v) =>
            v.campaignContactId === updated.id
              ? { ...v, prospect: updated }
              : v
          );
          return { ...prev, tofuProspectViews: nextViews, tofuProspectView: nextViews[0] ?? null };
        });
      }
    }
    if (contactId) await loadView(contactId);
  };

  return (
    <Drawer placement="right" size="xl" isOpen={isOpen} onClose={onClose}>
      <DrawerOverlay />
      <DrawerContent className="!max-w-[720px] !bg-brand-surface">
        <DrawerCloseButton />
        <DrawerHeader className={`${ui.titleSm} text-base !bg-brand-surface`}>
          <p className={`${ui.label} mb-1 normal-case tracking-wide font-sans`}>
            Contact{businessUser?.jobTitle ? ` · ${businessUser.jobTitle}` : ""}
            {hasTofu ? " · Clarwiz outreach linked" : ""}
          </p>
          <span className="font-serif">{name}</span>
        </DrawerHeader>

        <DrawerBody className="px-4 pb-6 !bg-brand-surface">
          {loading ? (
            <p className={`${ui.body} py-12 text-center`}>Loading contact…</p>
          ) : !view ? (
            <AssistEmpty>Nothing to show.</AssistEmpty>
          ) : (
            <div className="space-y-5">
              <ContactProfileSection
                contact={contact}
                businessUser={businessUser}
                company={company}
                persona={contact?.persona}
              />

              {hasTofu ? (
                <>
                  {tofuProspectViews.length > 1 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {tofuProspectViews.map((v) => (
                        <button
                          key={v.campaignContactId}
                          type="button"
                          onClick={() => setActiveTofuId(v.campaignContactId)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
                            activeTofuId === v.campaignContactId
                              ? "bg-brand-dark text-white border-brand-dark"
                              : "bg-brand-surface text-brand-stone border-brand-secondary/30 hover:text-brand-ink"
                          }`}
                        >
                          {v.campaign?.name || "Campaign"}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <TofuCampaignPanel
                    contexts={
                      activeTofu
                        ? campaignContexts.filter((ctx) => ctx.id === activeTofu.campaignContactId)
                        : campaignContexts
                    }
                  />
                </>
              ) : (
                <div className={`${ui.cardMuted} px-4 py-3`}>
                  <p className="text-sm text-brand-stone">
                    No Clarwiz campaign link on this contact — CRM-only record.
                  </p>
                </div>
              )}

              {company ? (
                <div className={`${ui.cardMuted} px-4 py-3`}>
                  <p className={ui.label}>Company</p>
                  <p className="text-sm font-medium text-brand-ink mt-1">{company.name}</p>
                  <p className="text-xs text-brand-stone mt-0.5">
                    {[company.industry, company.domain].filter(Boolean).join(" · ")}
                  </p>
                </div>
              ) : null}

              <div className={`${ui.cardSurface} p-4 space-y-3`}>
                <SectionTitle>CRM profile</SectionTitle>
                <KvGrid
                  items={[
                    { label: "Persona", value: persona },
                    { label: "Role on deal", value: s(dealContact?.role) },
                    { label: "Lifecycle stage", value: s(contact?.lifecycleStage) },
                    { label: "HubSpot contact ID", value: s(contact?.hubspotContactId) },
                    {
                      label: "Outreach score",
                      value: typeof contact?.tofuScore === "number" ? contact.tofuScore : null,
                    },
                  ]}
                />
              </div>

              {nbas.length > 0 ? (
                <div className={ui.cardSurface}>
                  <div className={`px-4 py-3 ${ui.tableToolbar}`}>
                    <h3 className={`${ui.titleSm} text-sm`}>Recommended actions</h3>
                  </div>
                  <ul className={ui.divider}>
                    {nbas.slice(0, 5).map((n) => (
                      <li key={n.id} className="px-4 py-3">
                        <InsightRow
                          name={n.title || n.actionType || "Recommended action"}
                          badge={<AssistBadge variant="accent">{n.status || "Suggested"}</AssistBadge>}
                        >
                          {n.rationale}
                        </InsightRow>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {activeTofu ? (
                <div className="space-y-2 flex flex-col min-h-[420px]">
                  <p className={ui.label}>Conversations</p>
                  <p className="text-xs text-brand-stone">
                    Send on any channel — same as the campaign contact drawer.
                  </p>
                  <div className="flex-1 min-h-0">
                    <ContactCommThread
                      communications={activeTofu.prospect?.communications ?? []}
                      campaign={activeTofu.campaign}
                      prospect={activeTofu.prospect}
                      campaignId={activeTofu.campaign?.id}
                      campaignContactId={activeTofu.campaignContactId}
                      templates={activeTofu.campaign?.templates ?? []}
                      enabledChannels={
                        activeTofu.campaign?.enabledChannels ?? DEFAULT_ENABLED_CHANNELS
                      }
                      onSent={handleSent}
                    />
                  </div>
                </div>
              ) : null}

              {contact?.id ? (
                <Link href={`/assist/lead/${contact.id}`} className={`${ui.link} text-xs`}>
                  Open full lead workroom →
                </Link>
              ) : null}
            </div>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
