/**
 * Starter brand templates for the Collateral Hub — one per CollateralType.
 * Stored as structured doc models (Document.data) + rendered HTML so the
 * pick-template → personalize flow in AE Assist works out of the box.
 *
 * Idempotent: upserted by tenantId + slug via ensureDefaultCollateralTemplates.
 */

import { renderDocumentHtml } from "@/lib/assist/renderDocument";
import { DEFAULT_BRAND } from "@/lib/assist/collateralGen";

/** @typedef {{ slug: string, title: string, type: string, category: string, funnelStage: string, tags: string[], data: object }} DefaultTemplate */

/** @type {DefaultTemplate[]} */
export const DEFAULT_COLLATERAL_TEMPLATES = [
  {
    slug: "default-one-pager",
    title: "Sales One-Pager — Brand Template",
    type: "ONE_PAGER",
    category: "SALES",
    funnelStage: "DEAL_EARLY",
    tags: ["sales", "one-pager", "template", "discovery"],
    data: {
      title: "Sales One-Pager",
      assetType: "one_pager",
      headline: "How [YourCompany] helps [ProspectCompany] move faster",
      subhead:
        "A concise overview of the challenge, our approach, and the outcomes teams like yours achieve.",
      audience: "Economic buyer",
      sections: [
        {
          id: "context",
          title: "Why now",
          body:
            "[ProspectCompany] is navigating [PrimaryPain] while scaling [KeyInitiative]. Teams in [Industry] need a partner that reduces risk without slowing the business down.",
        },
        {
          id: "approach",
          title: "What we do",
          body:
            "**Unified platform** — one system of record for [UseCase1] and [UseCase2].\n\n" +
            "**Faster time-to-value** — typical go-live in [ImplementationWindow], not quarters.\n\n" +
            "**Enterprise-ready** — SSO, audit logs, and role-based access from day one.",
        },
        {
          id: "proof",
          title: "Proof points",
          body:
            "- [ReferenceCustomer] reduced [Metric1] by [KeyMetric] in [Timeframe]\n" +
            "- [ReferenceCustomer2] consolidated [Number] tools into one workspace\n" +
            "- Rated [Rating] on [ReviewSite] by [Persona] buyers",
        },
      ],
      metrics: [
        { label: "Typical ROI", value: "[ROI%]", detail: "within 12 months" },
        { label: "Payback", value: "[PaybackMonths] mo", detail: "based on peer benchmarks" },
        { label: "Adoption", value: "[Adoption%]", detail: "active users in 90 days" },
      ],
      cta: {
        label: "Next step: 30-minute working session",
        detail: "Walk through your workflow with [ChampionName] and map a 90-day rollout plan.",
      },
      compliance: { score: "100", note: "Starter template — personalize before sending." },
    },
  },
  {
    slug: "default-battlecard",
    title: "Competitive Battlecard — Brand Template",
    type: "BATTLECARD",
    category: "SALES",
    funnelStage: "DEAL_LATE",
    tags: ["sales", "battlecard", "competitive", "template"],
    data: {
      title: "Competitive Battlecard",
      assetType: "battlecard",
      headline: "[YourCompany] vs [Competitor]",
      subhead: "Quick reference for [ProspectCompany] — positioning, proof, and objection handling.",
      audience: "Account executive",
      competitor: "[Competitor]",
      sections: [
        {
          id: "positioning",
          title: "Positioning snapshot",
          body:
            "**We win when** the buyer cares about [Differentiator1], [Differentiator2], and a measurable path to [Outcome].\n\n" +
            "**They win when** the deal is purely about [CompetitorStrength] with no executive sponsor for change.",
        },
        {
          id: "landmines",
          title: "Landmines to set",
          body:
            "- Ask how they handle [IntegrationGap] without professional services.\n" +
            "- Request a reference in [Industry] at similar scale.\n" +
            "- Confirm total cost including [HiddenCostArea] over 36 months.",
        },
      ],
      capabilities: [
        { name: "Time to value", us: "[YourTTV] — self-serve rollout", them: "[TheirTTV] — services-heavy" },
        { name: "Integrations", us: "[IntegrationCount]+ native connectors", them: "Limited / custom only" },
        { name: "Security", us: "SOC 2 Type II, SSO, audit trail", them: "[CompetitorSecurityGap]" },
        { name: "Pricing model", us: "Transparent per-seat + usage", them: "Opaque bundles" },
      ],
      objections: [
        {
          objection: "You're more expensive than [Competitor].",
          rebuttal:
            "Compare fully loaded cost: implementation, admin time, and [CostDriver]. Customers typically see [KeyMetric] savings in year one.",
        },
        {
          objection: "We already invested in [Competitor].",
          rebuttal:
            "Run a parallel pilot on [HighValueWorkflow]. Most teams keep both for 60 days, then consolidate once ROI is proven.",
        },
        {
          objection: "Your platform is newer / unproven.",
          rebuttal:
            "Reference [ReferenceCustomer] ([Industry], [EmployeeBand]) and our [Certification] posture. Happy to arrange a peer call.",
        },
      ],
      cta: {
        label: "Internal only — do not forward",
        detail: "Use on calls with [ProspectCompany]; personalize metrics before sharing externally.",
      },
      compliance: { score: "100", note: "Starter template — verify competitor facts before use." },
    },
  },
  {
    slug: "default-case-study",
    title: "Customer Case Study — Brand Template",
    type: "CASE_STUDY",
    category: "MARKETING",
    funnelStage: "LEAD",
    tags: ["marketing", "case-study", "social-proof", "template"],
    data: {
      title: "Customer Case Study",
      assetType: "case_study",
      headline: "How [CustomerName] achieved [OutcomeShort]",
      subhead: "[Industry] · [Region] · [TeamSize] employees",
      audience: "Prospect executive",
      challenge:
        "[CustomerName]'s [TeamName] struggled with [PrimaryPain]: manual handoffs, inconsistent data, and [SecondaryPain]. " +
        "Leadership needed [DesiredOutcome] without disrupting [CriticalSystem].",
      solution:
        "[YourCompany] deployed [ProductModule] in [ImplementationWindow], integrating with [ExistingStack]. " +
        "The team standardized [Workflow] and gave [Persona] real-time visibility into [Metric].",
      sections: [
        {
          id: "results-detail",
          title: "What changed",
          body:
            "- **[Metric1]** improved by [KeyMetric] within [Timeframe]\n" +
            "- **[Metric2]** dropped from [Before] to [After]\n" +
            "- **[Metric3]** — [QualitativeWin]",
        },
      ],
      metrics: [
        { label: "Efficiency gain", value: "[Efficiency%]", detail: "on core workflow" },
        { label: "Cost avoided", value: "[CostSaved]", detail: "annualized" },
        { label: "User adoption", value: "[Adoption%]", detail: "within 90 days" },
      ],
      quote: {
        text: "[CustomerQuote]",
        attribution: "[ExecutiveName], [Title] at [CustomerName]",
      },
      cta: {
        label: "See if this fits your team",
        detail: "Book a 20-minute walkthrough tailored to [ProspectCompany].",
      },
      compliance: { score: "100", note: "Starter template — replace with approved customer facts." },
    },
  },
  {
    slug: "default-marketing-doc",
    title: "Product Overview — Brand Template",
    type: "MARKETING_DOC",
    category: "MARKETING",
    funnelStage: "ANY",
    tags: ["marketing", "product", "overview", "template"],
    data: {
      title: "Product Overview",
      assetType: "one_pager",
      headline: "[YourCompany]: [ProductTagline]",
      subhead: "The platform for [ICP] teams who need [CoreOutcome] without [CommonTradeoff].",
      audience: "Marketing & demand gen",
      sections: [
        {
          id: "problem",
          title: "The problem we solve",
          body:
            "Modern [ICP] teams are stuck between [PainA] and [PainB]. Point solutions create silos; legacy suites are slow to deploy. " +
            "[YourCompany] unifies [Capability1], [Capability2], and [Capability3] in one workspace.",
        },
        {
          id: "modules",
          title: "Core capabilities",
          body:
            "| Module | What it does |\n" +
            "| --- | --- |\n" +
            "| [Module1] | [Module1Description] |\n" +
            "| [Module2] | [Module2Description] |\n" +
            "| [Module3] | [Module3Description] |",
        },
        {
          id: "icp",
          title: "Who it's for",
          body:
            "- **[Persona1]** — [Persona1Value]\n" +
            "- **[Persona2]** — [Persona2Value]\n" +
            "- **[Persona3]** — [Persona3Value]",
        },
      ],
      metrics: [
        { label: "Customers", value: "[CustomerCount]+", detail: "globally" },
        { label: "Uptime", value: "[Uptime%]", detail: "platform SLA" },
        { label: "Integrations", value: "[IntegrationCount]+", detail: "native connectors" },
      ],
      cta: {
        label: "Explore a live demo",
        detail: "See how [YourCompany] fits your stack in under 30 minutes.",
      },
      compliance: { score: "100", note: "Starter template — align modules with current positioning." },
    },
  },
  {
    slug: "default-pitch-deck",
    title: "Pitch Deck Outline — Brand Template",
    type: "PITCH_DECK",
    category: "SALES",
    funnelStage: "DEAL_EARLY",
    tags: ["sales", "pitch-deck", "demo", "template"],
    data: {
      title: "Pitch Deck Outline",
      assetType: "one_pager",
      headline: "[YourCompany] × [ProspectCompany]",
      subhead: "Discovery → demo narrative for [PrimaryPersona]",
      audience: "Buying committee",
      sections: [
        {
          id: "slide-1",
          title: "1 · Opening — the shift in [Industry]",
          body: "[MarketTrend] is forcing [Persona] to rethink [Workflow]. Winners invest in [StrategicPriority] now.",
        },
        {
          id: "slide-2",
          title: "2 · The cost of the status quo",
          body:
            "- [PainPoint1] costs [ProspectCompany] roughly [CostEstimate] per year\n" +
            "- [PainPoint2] slows [CriticalProcess] by [DelayMetric]\n" +
            "- Teams lack a single view of [DataDomain]",
        },
        {
          id: "slide-3",
          title: "3 · Our approach",
          body: "[YourCompany] gives [TeamName] one place to [JobToBeDone1], [JobToBeDone2], and [JobToBeDone3] — integrated with [ExistingStack].",
        },
        {
          id: "slide-4",
          title: "4 · Proof & outcomes",
          body:
            "**[ReferenceCustomer]** — [Outcome1]\n\n" +
            "**[ReferenceCustomer2]** — [Outcome2]\n\n" +
            "Typical customers see [KeyMetric] within [Timeframe].",
        },
        {
          id: "slide-5",
          title: "5 · Recommended next steps",
          body:
            "1. Technical deep-dive with [TechnicalPersona]\n" +
            "2. Security / procurement review\n" +
            "3. Pilot on [HighValueUseCase] with success criteria",
        },
      ],
      metrics: [
        { label: "Deck length", value: "12–15", detail: "slides recommended" },
        { label: "Demo time", value: "25 min", detail: "core narrative" },
        { label: "Follow-up", value: "48 hr", detail: "send recap + asset" },
      ],
      cta: {
        label: "Schedule the working session",
        detail: "Align on success criteria and stakeholders before the technical demo.",
      },
      compliance: { score: "100", note: "Starter template — adapt slide count to meeting length." },
    },
  },
  {
    slug: "default-email-template",
    title: "Post-Demo Follow-Up — Brand Template",
    type: "EMAIL_TEMPLATE",
    category: "SALES",
    funnelStage: "ANY",
    tags: ["sales", "email", "follow-up", "template"],
    data: {
      title: "Post-Demo Follow-Up Email",
      assetType: "email_template",
      headline: "Following up on our conversation",
      subhead: "For [ChampionName] at [ProspectCompany]",
      audience: "Champion / economic buyer",
      sections: [
        {
          id: "opening",
          title: "Opening",
          body:
            "Hi [ChampionName],\n\n" +
            "Thank you for walking through [TopicDiscussed] today. I appreciated your candor on [PainDiscussed] — it's exactly what we help [Industry] teams solve.",
        },
        {
          id: "recap",
          title: "What we covered",
          body:
            "- **Your goal:** [StatedGoal]\n" +
            "- **What resonated:** [FeatureOrOutcome]\n" +
            "- **Open question:** [OpenQuestion]",
        },
        {
          id: "value",
          title: "Why this matters for [ProspectCompany]",
          body:
            "Based on what you shared, the fastest path to [DesiredOutcome] is [RecommendedApproach]. " +
            "Teams similar to yours typically see [KeyMetric] within [Timeframe].",
        },
        {
          id: "attachments",
          title: "Attached for your team",
          body:
            "I've attached a one-pager you can forward internally. Happy to tailor a version for [SecondaryStakeholder] if helpful.",
        },
      ],
      cta: {
        label: "Proposed next step",
        detail: "[NextMeetingType] on [ProposedDate] with [Attendees] — does [TimeOption] work?",
      },
      compliance: { score: "100", note: "Starter template — personalize every bracket before sending." },
    },
  },
  {
    slug: "default-roi-doc",
    title: "ROI Business Case — Brand Template",
    type: "OTHER",
    category: "SALES",
    funnelStage: "DEAL_LATE",
    tags: ["sales", "roi", "business-case", "template"],
    data: {
      title: "ROI Business Case",
      assetType: "roi_doc",
      headline: "Business case for [ProspectCompany]",
      subhead: "Quantified impact of [YourCompany] on [PrimaryWorkflow]",
      audience: "CFO / finance sponsor",
      sections: [
        {
          id: "assumptions",
          title: "Assumptions",
          body:
            "- Team size: [TeamSize] [Persona] users\n" +
            "- Current tooling cost: [CurrentSpend] / year\n" +
            "- Hours spent on [ManualProcess]: [HoursPerWeek] / week\n" +
            "- Fully loaded labor rate: [LaborRate] / hour",
        },
        {
          id: "benefits",
          title: "Projected benefits (annual)",
          body:
            "| Category | Estimate |\n" +
            "| --- | --- |\n" +
            "| Labor efficiency | [LaborSavings] |\n" +
            "| Tool consolidation | [ToolSavings] |\n" +
            "| Error / rework reduction | [QualitySavings] |\n" +
            "| **Total annual benefit** | **[TotalBenefit]** |",
        },
        {
          id: "investment",
          title: "Investment",
          body:
            "- Platform: [AnnualLicense] / year\n" +
            "- Implementation (one-time): [ImplementationCost]\n" +
            "- **3-year TCO:** [ThreeYearTCO]",
        },
      ],
      metrics: [
        { label: "Year-1 ROI", value: "[ROI%]", detail: "benefit ÷ investment" },
        { label: "Payback", value: "[PaybackMonths] mo", detail: "breakeven" },
        { label: "NPV (3yr)", value: "[NPV]", detail: "at [DiscountRate]% discount" },
      ],
      payback: {
        summary:
          "At conservative assumptions, [ProspectCompany] recovers the investment in [PaybackMonths] months " +
          "and nets [NetBenefit] over three years.",
      },
      cta: {
        label: "Validate assumptions together",
        detail: "30-minute working session with [FinanceContact] to pressure-test the model.",
      },
      compliance: { score: "100", note: "Starter template — all figures must be customer-specific before sharing." },
    },
  },
];

/**
 * Ensure every default template exists for a tenant. Upserts by slug so
 * re-visiting the Collateral Hub refreshes starter content without duplicates.
 *
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {string} tenantId
 * @returns {Promise<{ created: number, updated: number }>}
 */
export async function ensureDefaultCollateralTemplates(prisma, tenantId) {
  let created = 0;
  let updated = 0;

  for (const t of DEFAULT_COLLATERAL_TEMPLATES) {
    const html = renderDocumentHtml(t.data, DEFAULT_BRAND);
    const templateJson = JSON.stringify(t.data);

    let existing = await prisma.collateralIndex.findFirst({
      where: { tenantId, slug: t.slug, isTemplate: true },
      select: { id: true, externalId: true },
    });
    // Legacy rows (pre-slug seed) matched by title — attach slug instead of duplicating.
    if (!existing) {
      existing = await prisma.collateralIndex.findFirst({
        where: { tenantId, title: t.title, isTemplate: true, slug: null },
        select: { id: true, externalId: true },
      });
    }

    if (existing) {
      if (existing.externalId) {
        await prisma.document.update({
          where: { id: existing.externalId },
          data: {
            title: t.title,
            html,
            template: templateJson,
            data: t.data,
          },
        });
      }
      await prisma.collateralIndex.update({
        where: { id: existing.id },
        data: {
          title: t.title,
          type: t.type,
          category: t.category,
          slug: t.slug,
          funnelStage: t.funnelStage,
          tags: t.tags,
          source: "UPLOAD",
          isTemplate: true,
        },
      });
      updated += 1;
      continue;
    }

    const document = await prisma.document.create({
      data: {
        tenantId,
        title: t.title,
        html,
        template: templateJson,
        data: t.data,
      },
    });

    await prisma.collateralIndex.create({
      data: {
        tenantId,
        title: t.title,
        type: t.type,
        category: t.category,
        slug: t.slug,
        source: "UPLOAD",
        isTemplate: true,
        externalId: document.id,
        funnelStage: t.funnelStage,
        tags: t.tags,
      },
    });
    created += 1;
  }

  return { created, updated };
}
