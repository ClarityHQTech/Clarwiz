"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
} from "@chakra-ui/react";
import { ui } from "@/lib/brandUi";
import {
  HiOutlineArrowRight,
  HiOutlineBriefcase,
  HiOutlineBuildingOffice2,
  HiOutlineChatBubbleLeftRight,
  HiOutlineDocumentText,
  HiOutlineLightBulb,
  HiOutlineMegaphone,
  HiOutlineSparkles,
  HiOutlineUsers,
} from "react-icons/hi2";

const TABS = [
  { id: "getting-started", label: "Getting Started" },
  { id: "next-best-action", label: "Next Best Action" },
  { id: "team", label: "Team" },
  { id: "integrations", label: "Integrations" },
  { id: "campaigns", label: "Campaigns" },
  { id: "ae-assist", label: "AE Assist" },
];

function SectionTitle({ children }) {
  return <h3 className={`${ui.sectionTitle} mb-2`}>{children}</h3>;
}

function BodyText({ children }) {
  return <p className={`${ui.body} leading-relaxed`}>{children}</p>;
}

function StackConnector() {
  return (
    <div className="flex justify-center py-1" aria-hidden>
      <div className="h-5 w-px bg-brand-secondary/40" />
    </div>
  );
}

function StackLayerBlock({ icon: Icon, title, description, accent, size = "md" }) {
  const sizeStyles = {
    sm: "w-[58%] min-w-[11rem] px-3 py-2.5 self-center",
    md: "w-[78%] min-w-[13rem] px-4 py-3.5 self-center",
    lg: "w-full px-4 py-4 self-stretch",
  };

  return (
    <div
      className={`relative rounded-lg border flex items-start gap-3 ${sizeStyles[size]} ${accent}`}
    >
      <div
        className={`flex shrink-0 items-center justify-center rounded-md bg-white/80 mt-0.5 ${
          size === "sm" ? "h-8 w-8" : "h-10 w-10"
        }`}
      >
        <Icon className={`text-brand-ink ${size === "sm" ? "h-4 w-4" : "h-5 w-5"}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`font-semibold text-brand-ink leading-snug ${size === "sm" ? "text-xs" : "text-sm"}`}>
          {title}
        </p>
        {description ? (
          <p className="text-xs text-brand-stone mt-1 leading-relaxed">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

function FunnelPill({ label, sub, href, icon: Icon, variant }) {
  const styles = {
    tofu: "border-brand-terracotta/30 bg-brand-terracotta/10",
    mofu: "border-brand-sage/40 bg-brand-sage/15",
  };
  return (
    <div className={`rounded-xl border p-4 ${styles[variant]}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/70">
          <Icon className="h-5 w-5 text-brand-ink" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-brand-ink">{label}</p>
          <p className="text-xs text-brand-stone mt-1 leading-relaxed">{sub}</p>
          {href ? (
            <Link href={href} className={`mt-2 inline-flex items-center gap-1 text-xs font-medium ${ui.link}`}>
              Open in app
              <HiOutlineArrowRight className="h-3 w-3" />
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StepItem({ n, title, children }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-dark text-xs font-semibold text-white">
        {n}
      </span>
      <div className="min-w-0 pb-4">
        <p className="text-sm font-medium text-brand-ink">{title}</p>
        <p className="text-sm text-brand-stone mt-1 leading-relaxed">{children}</p>
      </div>
    </li>
  );
}

function IntegrationGroup({ title, sub, items, variant }) {
  const wrap =
    variant === "tofu"
      ? "border-brand-terracotta/25 bg-brand-terracotta/5"
      : "border-brand-sage/30 bg-brand-sage/10";
  return (
    <div className={`rounded-xl border p-4 ${wrap}`}>
      <p className="text-sm font-semibold text-brand-ink">{title}</p>
      <p className="text-xs text-brand-stone mt-0.5 mb-3">{sub}</p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item}
            className="flex items-center gap-2 rounded-lg border border-brand-secondary/20 bg-white/80 px-3 py-2 text-sm text-brand-ink"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-brand-sage shrink-0" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PermissionChip({ label }) {
  return (
    <span className="inline-flex rounded-lg border border-brand-secondary/30 bg-brand-bg px-2.5 py-1 text-xs font-medium text-brand-ink">
      {label}
    </span>
  );
}

function GettingStartedContent() {
  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>What is Clarwiz?</SectionTitle>
        <BodyText>
          Clarwiz is your growth execution platform — it connects cold outreach at the top of the
          funnel with intelligent deal management in the middle of the funnel. Your firm&apos;s context
          flows through every touchpoint so communication stays on-brand and actions stay relevant.
        </BodyText>
      </div>

      <div>
        <SectionTitle>Three layers to get started</SectionTitle>
        <p className={`${ui.body} mb-4`}>
          Every workflow in Clarwiz builds on these foundations — from firm setup to closed deals.
        </p>
        <div className="flex flex-col items-center w-full max-w-md mx-auto">
          <StackLayerBlock
            size="sm"
            icon={HiOutlineBuildingOffice2}
            title="Tenant"
            description="Your firm — workspace for campaigns, team, and context."
            accent="border-brand-secondary/30 bg-brand-surface"
          />
          <StackConnector />
          <StackLayerBlock
            size="md"
            icon={HiOutlineUsers}
            title="Prospects / Deal"
            description="Contacts you upload externally — the people you reach and the deals they become as they engage and qualify."
            accent="border-brand-secondary/30 bg-brand-surface"
          />
          <StackConnector />
          <StackLayerBlock
            size="lg"
            icon={HiOutlineChatBubbleLeftRight}
            title="Communication / Action"
            description="Outreach and next-best actions with those prospects — campaigns at the top of the funnel, AE Assist as deals mature."
            accent="border-brand-sage/30 bg-brand-sage/10"
          />
        </div>
      </div>

      <div>
        <SectionTitle>Top of funnel &amp; mid of funnel</SectionTitle>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <FunnelPill
            variant="tofu"
            icon={HiOutlineMegaphone}
            label="Top of the Funnel (TOFU)"
            sub="Campaigns and cold outreach through Email, WhatsApp, and LinkedIn. AI Calling is coming soon."
            href="/campaigns"
          />
          <FunnelPill
            variant="mofu"
            icon={HiOutlineBriefcase}
            label="Mid of the Funnel (MOFU)"
            sub="AE Assist helps you work active deals — insights, next-best actions, and nurture workflows."
            href="/assist"
          />
        </div>
      </div>

      <div className={`${ui.panelSurface} space-y-2`}>
        <div className="flex items-center gap-2">
          <HiOutlineSparkles className="h-5 w-5 text-brand-sage" />
          <SectionTitle>Context</SectionTitle>
        </div>
        <BodyText>
          Run and maintain your firm&apos;s context in the Context section. This is your brand voice,
          positioning, and knowledge base. Clarwiz uses it in campaigns for personalised outreach and
          in AE Assist for sharper deal communication.
        </BodyText>
        <Link href="/context" className={`inline-flex items-center gap-1 text-sm font-medium ${ui.link}`}>
          Go to Context
          <HiOutlineArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

function NextBestActionContent() {
  return (
    <div className="space-y-5">
      <div className={`rounded-xl border border-brand-gold/35 bg-brand-gold/10 p-4`}>
        <div className="flex items-center gap-2 mb-2">
          <HiOutlineLightBulb className="h-5 w-5 text-brand-gold" />
          <p className="text-sm font-semibold text-brand-ink">Clarwiz&apos;s unique edge</p>
        </div>
        <BodyText>
          Clarwiz doesn&apos;t just send messages — it decides the <strong className="font-medium text-brand-ink">next best action</strong> based
          on your tenant context, prior communication, engagement signals, and deal history.
        </BodyText>
      </div>

      <div>
        <SectionTitle>What powers next best action?</SectionTitle>
        <ul className="mt-3 space-y-2">
          {[
            "Your tenant context and brand positioning",
            "Previous communication with each prospect or contact",
            "Engagement signals — opens, replies, and buying intent",
            "Campaign history and deal stage when applicable",
          ].map((item) => (
            <li key={item} className="flex gap-2 text-sm text-brand-stone">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-sage" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <FunnelPill
          variant="tofu"
          icon={HiOutlineMegaphone}
          label="In Campaigns"
          sub="Outreach adapts based on prospect engagement — follow-ups, channel switches, and qualification paths are suggested intelligently."
          href="/campaigns"
        />
        <FunnelPill
          variant="mofu"
          icon={HiOutlineBriefcase}
          label="In AE Assist"
          sub="Deal workrooms surface NBA recommendations — draft emails, schedule meetings, send collateral, and more."
          href="/assist"
        />
      </div>
    </div>
  );
}

function TeamContent() {
  return (
    <div className="space-y-5">
      <BodyText>
        As a tenant admin, you manage the whole firm workspace — campaigns, integrations, team
        members, and tenant details. Invite colleagues from the Team section and control exactly
        what each member can do.
      </BodyText>

      <div>
        <SectionTitle>Admin capabilities</SectionTitle>
        <ul className="mt-3 space-y-2">
          {[
            "Manage all campaigns across the workspace",
            "Configure channel and CRM integrations",
            "Invite members and assign permissions",
            "Edit tenant and firm details",
          ].map((item) => (
            <li key={item} className="flex gap-2 text-sm text-brand-stone">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-dark" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <SectionTitle>Assignable scopes for members</SectionTitle>
        <p className={`${ui.body} mb-3`}>
          Members can be given limited or full access. Admins always have full permissions.
        </p>
        <div className="flex flex-wrap gap-2">
          <PermissionChip label="Managing campaigns" />
          <PermissionChip label="Adding integrations" />
          <PermissionChip label="Adding team members" />
          <PermissionChip label="Editing tenant details" />
          <PermissionChip label="Running AE Assist" />
        </div>
      </div>

      <Link href="/teams" className={`inline-flex items-center gap-1 text-sm font-medium ${ui.link}`}>
        Manage team
        <HiOutlineArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function IntegrationsContent() {
  return (
    <div className="space-y-5">
      <BodyText>
        Integrations connect Clarwiz to your outreach channels and CRM. Top-of-funnel channels power
        campaigns; mid-of-funnel integrations power AE Assist and deal workflows.
      </BodyText>

      <IntegrationGroup
        variant="tofu"
        title="Channel & webhook integrations (TOFU)"
        sub="Used for cold outreach in campaigns"
        items={[
          "Email — outbound campaign delivery",
          "LinkedIn — social outreach",
          "WhatsApp — messaging outreach",
          "Webhooks — event-driven automation",
        ]}
      />

      <IntegrationGroup
        variant="mofu"
        title="CRM & email integrations (MOFU)"
        sub="Used in AE Assist for deals, contacts, and nurture"
        items={[
          "HubSpot — CRM sync for deals, contacts, and companies",
          "Gmail — send AE Assist and NBA emails from the platform",
          "Calendly — scheduling links in campaign follow-ups",
        ]}
      />

      <Link href="/integrations" className={`inline-flex items-center gap-1 text-sm font-medium ${ui.link}`}>
        Open Integrations
        <HiOutlineArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function CampaignsContent() {
  return (
    <div className="space-y-5">
      <BodyText>
        Campaigns are your top-of-funnel engine. Create a campaign, add prospects, and let Clarwiz
        run intelligent multi-channel outreach that scores engagement and qualifies leads into your CRM.
      </BodyText>

      <ol className="space-y-0">
        <StepItem n="1" title="Create a campaign">
          Set a name, dates, and campaign details. Define what this outreach is about.
        </StepItem>
        <StepItem n="2" title="Upload your prospect list">
          Import the contacts you want to reach. They become enrolled prospects in the campaign.
        </StepItem>
        <StepItem n="3" title="Optional templates">
          Add templates if you have them — Clarwiz also creates personalised communication using your
          tenant context.
        </StepItem>
        <StepItem n="4" title="Configure & go live">
          Select channels (Email, WhatsApp, LinkedIn), add your Calendly link for later-stage
          scheduling, and turn the campaign live.
        </StepItem>
        <StepItem n="5" title="Intelligent outreach runs">
          Outreach starts at the scheduled time. Based on engagement and replies, Clarwiz adapts —
          increasing prospect scores and suggesting next steps.
        </StepItem>
        <StepItem n="6" title="Qualification → CRM">
          When a prospect qualifies, Clarwiz marks the lead and pushes it to your connected CRM as a
          deal-ready opportunity.
        </StepItem>
      </ol>

      <Link href="/campaigns" className={`inline-flex items-center gap-1 text-sm font-medium ${ui.link}`}>
        Go to Campaigns
        <HiOutlineArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function AeAssistContent() {
  return (
    <div className="space-y-5">
      <BodyText>
        AE Assist is your mid-of-funnel cockpit. It pulls deals from your CRM, computes full deal
        intelligence, and recommends the best next actions to move each opportunity forward.
      </BodyText>

      <div className={`${ui.panelSurface} space-y-3`}>
        <SectionTitle>Deal context — automatically assembled</SectionTitle>
        <ul className="space-y-2">
          {[
            "CRM deal data synced from HubSpot",
            "Full campaign history if the deal originated from outreach",
            "All prior communications with deal contacts",
            "Call notes and meeting recordings",
            "Buying signals and engagement scores",
            "Collateral templates and tenant context",
          ].map((item) => (
            <li key={item} className="flex gap-2 text-sm text-brand-stone">
              <HiOutlineDocumentText className="h-4 w-4 shrink-0 text-brand-sage mt-0.5" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <SectionTitle>What AE Assist does</SectionTitle>
        <ul className="mt-3 space-y-2">
          {[
            "Generates next-best actions for each deal — emails, collateral, tasks, and more",
            "Drafts appropriate communication to deal contacts using full context",
            "Incorporates call recording notes and collateral into outreach",
            "Regularly nurtures deals based on signals and stage",
            "Lets you chat internally about the deal with all context at hand",
          ].map((item) => (
            <li key={item} className="flex gap-2 text-sm text-brand-stone">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-sage" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <Link href="/assist" className={`inline-flex items-center gap-1 text-sm font-medium ${ui.link}`}>
        Open AE Assist
        <HiOutlineArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

const TAB_CONTENT = {
  "getting-started": GettingStartedContent,
  "next-best-action": NextBestActionContent,
  team: TeamContent,
  integrations: IntegrationsContent,
  campaigns: CampaignsContent,
  "ae-assist": AeAssistContent,
};

export default function HelpDrawer({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState("getting-started");
  const ActiveContent = TAB_CONTENT[activeTab] ?? GettingStartedContent;

  return (
    <Drawer placement="right" size="md" isOpen={isOpen} onClose={onClose}>
      <DrawerOverlay className="!bg-black/40" />
      <DrawerContent className="!max-w-[520px] !bg-brand-surface flex flex-col">
        <DrawerCloseButton className="!text-brand-stone" />
        <DrawerHeader
          className="!bg-brand-surface border-b border-brand-secondary/25 shrink-0"
          pt={6}
          pb={4}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-brand-stone">
            Help
          </p>
          <h2 className={`${ui.titleSm} text-lg mt-1`}>How Clarwiz works</h2>
          <p className="text-sm text-brand-stone mt-1 font-normal font-sans">
            Quick tour of the step-by-step workflow and where to find things.
          </p>
        </DrawerHeader>

        <DrawerBody className="!bg-brand-surface flex flex-col gap-0 !p-0 overflow-hidden">
          <div className="shrink-0 border-b border-brand-secondary/25 bg-brand-bg/50">
            <div className="flex gap-2 overflow-x-auto px-4 py-3 no-scrollbar">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? "bg-brand-dark text-white"
                      : "bg-white border border-brand-secondary/30 text-brand-stone hover:text-brand-ink hover:bg-brand-bg"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            <ActiveContent />
          </div>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
