"use client";

import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
} from "@chakra-ui/react";
import { useState } from "react";
import {
  HiOutlineArrowLeft,
  HiOutlineArrowRight,
  HiOutlineArrowUpTray,
  HiOutlinePlus,
  HiOutlineTrash,
} from "react-icons/hi2";
import { toast } from "sonner";
import AddContactModal from "@/components/campaigns/AddContactModal";
import ChannelTemplatesSection from "@/components/campaigns/ChannelTemplatesSection";
import WhatsAppCampaignTemplatesSection from "@/components/campaigns/WhatsAppCampaignTemplatesSection";
import { commTemplatesFromWhatsAppSelection } from "@/lib/whatsappCampaignTemplates";
import {
  CAMPAIGN_CHANNELS,
  CHANNEL_LABELS,
  CTA_OPTIONS,
  PROSPECT_IMPORT_COLUMNS,
  validateTemplate,
} from "@/lib/campaignConstants";
import { parseProspectExcel } from "@/lib/parseProspectExcel";
import { TEMPLATE_VARIABLES } from "@/lib/templateVariables";
import { ui } from "@/lib/brandUi";

const STEPS = ["Campaign", "Prospects", "Templates", "Review"];

const INITIAL_CAMPAIGN = {
  name: "",
  description: "",
  targetSegment: "",
  goals: "",
  startDate: "",
  calendlyBookingUrl: "",
};

function StepIndicator({ current }) {
  return (
    <div className="flex items-center gap-2.5 mb-6">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-2.5">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
              i <= current
                ? "bg-brand-dark text-white"
                : "bg-brand-bg text-brand-stone"
            }`}
          >
            {i + 1}
          </div>
          <span
            className={`text-sm font-medium hidden sm:inline ${
              i === current ? "text-brand-ink" : "text-brand-steel"
            }`}
          >
            {label}
          </span>
          {i < STEPS.length - 1 && (
            <div className="w-6 h-px bg-brand-secondary/30 hidden sm:block" />
          )}
        </div>
      ))}
    </div>
  );
}

function Field({ label, required, children, hint }) {
  return (
    <div>
      <label className="block text-sm font-medium text-brand-stone mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-sm text-brand-steel mt-1">{hint}</p>}
    </div>
  );
}

export default function NewCampaignModal({ isOpen, onClose, onCreated }) {
  const {
    isOpen: addProspectOpen,
    onOpen: openAddProspect,
    onClose: closeAddProspect,
  } = useDisclosure();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [campaign, setCampaign] = useState(INITIAL_CAMPAIGN);
  const [prospects, setProspects] = useState([]);
  const [uploadErrors, setUploadErrors] = useState([]);
  const [fileName, setFileName] = useState("");
  const [templates, setTemplates] = useState([]);

  const reset = () => {
    setStep(0);
    setCampaign(INITIAL_CAMPAIGN);
    setProspects([]);
    setUploadErrors([]);
    setFileName("");
    setTemplates([]);
  };

  const handleClose = () => {
    if (!submitting) {
      reset();
      onClose();
    }
  };

  const updateCampaign = (patch) =>
    setCampaign((prev) => ({ ...prev, ...patch }));

  const saveChannelTemplate = async (template, mode) => {
    setTemplates((prev) => {
      if (mode === "edit") {
        return prev.map((t) => (t.id === template.id ? template : t));
      }
      return [...prev, template];
    });
  };

  const updateWhatsAppTemplate = (id, patch) => {
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch } : t))
    );
  };

  const removeTemplate = (id) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  const addWhatsAppTemplates = (waTemplates) => {
    const rows = commTemplatesFromWhatsAppSelection(waTemplates, templates);
    setTemplates((prev) => [...prev, ...rows]);
  };

  const templatesForSubmit = () =>
    templates.map(({ id, ...rest }) => rest);

  const handleFile = async (file) => {
    if (!file) return;
    try {
      const result = await parseProspectExcel(file);
      setProspects(result.prospects);
      setUploadErrors(result.errors);
      setFileName(file.name);
      if (result.errors.length) {
        toast.warning(`${result.errors.length} row(s) skipped during import.`);
      } else {
        toast.success(`Imported ${result.prospects.length} prospects.`);
      }
    } catch (err) {
      toast.error(err.message);
      setProspects([]);
      setFileName("");
      setUploadErrors([]);
    }
  };

  const validateStep = () => {
    if (step === 0) {
      if (!campaign.name.trim()) {
        toast.error("Campaign name is required.");
        return false;
      }
      return true;
    }
    if (step === 1) {
      if (!prospects.length) {
        toast.error("Add at least one prospect.");
        return false;
      }
      return true;
    }
    if (step === 2) {
      for (const t of templates) {
        const err = validateTemplate(t);
        if (err) {
          toast.error(err);
          return false;
        }
      }
      return true;
    }
    return true;
  };

  const goNext = () => {
    if (!validateStep()) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const handleSubmit = async () => {
    if (!validateStep()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...campaign,
          prospects,
          templates: templatesForSubmit(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create campaign");
      }
      toast.success("Campaign created.");
      reset();
      onClose();
      onCreated?.(data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="full"
      scrollBehavior="inside"
      closeOnOverlayClick={!submitting}
    >
      <ModalOverlay backdropFilter="blur(4px)" className="!bg-black/40" />
      <ModalContent
        m={0}
        maxH="100vh"
        minH="100vh"
        borderRadius="none"
        display="flex"
        flexDirection="column"
        className="!bg-brand-surface"
      >
        <ModalHeader
          flexShrink={0}
          borderBottomWidth="1px"
          py={5}
          px={{ base: 5, md: 6 }}
          pr={12}
          className="!bg-brand-surface !border-brand-secondary/25"
        >
          <p className="text-lg font-semibold text-brand-ink">New campaign</p>
          <p className="text-sm font-normal text-brand-stone mt-1">
            Configure campaign details, import prospects, and optionally add comm templates.
          </p>
        </ModalHeader>
        <ModalCloseButton
          isDisabled={submitting}
          className="!text-brand-stone hover:!bg-brand-bg"
        />

        <ModalBody
          flex="1"
          overflowY="auto"
          py={6}
          px={{ base: 5, md: 8 }}
          className="!bg-brand-surface"
        >
          <StepIndicator current={step} />

          {step === 0 && (
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Campaign name" required>
                <input
                  type="text"
                  value={campaign.name}
                  onChange={(e) => updateCampaign({ name: e.target.value })}
                  placeholder="Summer 2025"
                  className={ui.inputSurface}
                  autoFocus
                />
              </Field>
              <Field label="Start date">
                <input
                  type="date"
                  value={campaign.startDate}
                  onChange={(e) => updateCampaign({ startDate: e.target.value })}
                  className={ui.inputSurface}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Description">
                  <textarea
                    rows={3}
                    value={campaign.description}
                    onChange={(e) => updateCampaign({ description: e.target.value })}
                    placeholder="Campaign overview and positioning..."
                    className={`${ui.inputSurface} resize-y`}
                  />
                </Field>
              </div>
              <Field label="Target segment">
                <input
                  type="text"
                  value={campaign.targetSegment}
                  onChange={(e) => updateCampaign({ targetSegment: e.target.value })}
                  placeholder="Mid-market SaaS, US & UK"
                  className={ui.inputSurface}
                />
              </Field>
              <Field label="Goals">
                <input
                  type="text"
                  value={campaign.goals}
                  onChange={(e) => updateCampaign({ goals: e.target.value })}
                  placeholder="Book 20 demos, 50 qualified replies"
                  className={ui.inputSurface}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field
                  label="Calendly booking URL"
                  hint="Used in stage 2+ outreach and tracked links. Connect Calendly in Integrations for auto-qualify on book."
                >
                  <input
                    type="url"
                    value={campaign.calendlyBookingUrl}
                    onChange={(e) =>
                      updateCampaign({ calendlyBookingUrl: e.target.value })
                    }
                    placeholder="https://calendly.com/your-team/30min"
                    className={ui.inputSurface}
                  />
                </Field>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-brand-ink">
                    Prospects ({prospects.length})
                  </h3>
                  <p className="text-xs text-brand-stone mt-0.5">
                    Add contacts manually or import from a file.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openAddProspect}
                  className={`inline-flex items-center gap-1.5 ${ui.btnSecondarySurface} shrink-0`}
                >
                  <HiOutlinePlus className="h-4 w-4" />
                  Add contact
                </button>
              </div>

              <div className="rounded-lg border-2 border-dashed border-brand-secondary/30 bg-brand-bg/50 p-5 text-center">
                <HiOutlineArrowUpTray className="mx-auto h-6 w-6 text-brand-steel" />
                <p className="text-sm font-medium text-brand-ink mt-2">
                  Import from file (.xlsx, .xls, .csv)
                </p>
                <p className="text-xs text-brand-stone mt-1">
                  {PROSPECT_IMPORT_COLUMNS.join(" · ")}
                </p>
                <label className="mt-3 inline-block">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                      handleFile(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                  <span className={`cursor-pointer ${ui.btnGhost} text-xs`}>
                    Choose file
                  </span>
                </label>
                {fileName && (
                  <p className="text-xs text-brand-terracotta mt-2 font-medium">{fileName}</p>
                )}
              </div>

              {uploadErrors.length > 0 && (
                <div className="rounded-lg bg-brand-terracotta/15 border border-brand-terracotta/30 px-3 py-2 text-xs text-brand-ink max-h-24 overflow-y-auto">
                  {uploadErrors.slice(0, 5).map((err, i) => (
                    <p key={i}>{err}</p>
                  ))}
                  {uploadErrors.length > 5 && (
                    <p>…and {uploadErrors.length - 5} more</p>
                  )}
                </div>
              )}

              {prospects.length > 0 ? (
                <div className={ui.tableWrap}>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-sm">
                      <thead>
                        <tr className={ui.tableHead}>
                          <th className={`${ui.tableHeadCell} py-2.5`}>Name</th>
                          <th className={`${ui.tableHeadCell} py-2.5`}>Company</th>
                          <th className={`${ui.tableHeadCell} py-2.5`}>Job title</th>
                          <th className={`${ui.tableHeadCell} py-2.5`}>Email</th>
                          <th className={`${ui.tableHeadCell} py-2.5`}>WhatsApp</th>
                          <th className={`${ui.tableHeadCell} py-2.5`}>Phone</th>
                          <th className={`${ui.tableHeadCell} py-2.5`}>LinkedIn</th>
                          <th className="w-10 px-2 py-2.5" aria-hidden />
                        </tr>
                      </thead>
                      <tbody className={ui.divider}>
                        {prospects.map((p, i) => (
                          <tr key={i} className={ui.tableRowHover}>
                            <td className="px-4 py-2.5 font-medium text-brand-ink whitespace-nowrap">
                              {p.name}
                            </td>
                            <td className="px-4 py-2.5 text-brand-stone">
                              {p.company || "—"}
                            </td>
                            <td className="px-4 py-2.5 text-brand-stone">
                              {p.jobTitle || "—"}
                            </td>
                            <td className="px-4 py-2.5 text-brand-stone">
                              {p.email || "—"}
                            </td>
                            <td className="px-4 py-2.5 text-brand-stone">
                              {p.whatsapp || "—"}
                            </td>
                            <td className="px-4 py-2.5 text-brand-stone">
                              {p.phone || "—"}
                            </td>
                            <td className="px-4 py-2.5 text-brand-stone max-w-[160px] truncate">
                              {p.linkedinUrl ? (
                                <span title={p.linkedinUrl}>{p.linkedinUrl}</span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-2 py-2.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setProspects((prev) => prev.filter((_, idx) => idx !== i))
                                }
                                className="p-1 text-brand-steel hover:text-red-700 rounded"
                                aria-label={`Remove ${p.name}`}
                              >
                                <HiOutlineTrash className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-brand-secondary/30 bg-brand-bg/30 px-4 py-8 text-center">
                  <p className="text-sm text-brand-stone">
                    No prospects yet. Add a contact or import a file to continue.
                  </p>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-xs text-brand-stone">
                Templates are optional. WhatsApp: select approved provider templates.
                Email and LinkedIn: add stage templates with variables {TEMPLATE_VARIABLES}.
              </p>
              <WhatsAppCampaignTemplatesSection
                templates={templates}
                onAddTemplates={addWhatsAppTemplates}
                onUpdateTemplate={updateWhatsAppTemplate}
                onRemove={removeTemplate}
              />
              {CAMPAIGN_CHANNELS.filter((ch) => ch !== "whatsapp").map((channel) => (
                <ChannelTemplatesSection
                  key={channel}
                  channel={channel}
                  templates={templates}
                  onSaveTemplate={saveChannelTemplate}
                  onRemove={removeTemplate}
                />
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 text-sm">
              <div className="rounded-lg border border-brand-secondary/30 bg-brand-surface p-4 space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-brand-stone">
                  Campaign
                </h4>
                <p className="font-medium text-brand-ink">{campaign.name}</p>
                {campaign.description && (
                  <p className="text-xs text-brand-stone">{campaign.description}</p>
                )}
                <div className="flex flex-wrap gap-3 text-xs text-brand-stone">
                  {campaign.targetSegment && (
                    <span>Segment: {campaign.targetSegment}</span>
                  )}
                  {campaign.goals && <span>Goals: {campaign.goals}</span>}
                  {campaign.startDate && (
                    <span>Start: {campaign.startDate}</span>
                  )}
                </div>
              </div>
              <div className="rounded-lg border border-brand-secondary/30 bg-brand-surface p-4">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-brand-stone mb-1">
                  Prospects
                </h4>
                <p className="text-brand-ink font-medium">{prospects.length} contacts</p>
              </div>
              <div className="rounded-lg border border-brand-secondary/30 bg-brand-surface p-4 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-brand-stone">
                  Templates
                </h4>
                {templates.length === 0 ? (
                  <p className="text-xs text-brand-stone">None — can add later from campaign details.</p>
                ) : (
                  [...templates]
                    .sort(
                      (a, b) =>
                        a.channel.localeCompare(b.channel) || a.stage - b.stage
                    )
                    .map((t) => (
                      <div
                        key={t.id}
                        className="text-xs border-t border-brand-secondary/15 pt-2 first:border-0 first:pt-0"
                      >
                        <p className="font-medium text-brand-ink">
                          {CHANNEL_LABELS[t.channel]} · Stage {t.stage}
                        </p>
                        {t.channel === "whatsapp" && (
                          <p className="text-brand-stone">
                            Template: {t.whatsappTemplateId}
                          </p>
                        )}
                        {t.channel === "email" && (
                          <p className="text-brand-stone">Subject: {t.subject}</p>
                        )}
                        <p className="text-brand-stone line-clamp-2 mt-0.5">{t.body}</p>
                        <p className="text-brand-steel mt-0.5">
                          CTA: {CTA_OPTIONS.find((c) => c.value === t.cta)?.label}
                        </p>
                      </div>
                    ))
                )}
              </div>
            </div>
          )}
        </ModalBody>

        <ModalFooter
          flexShrink={0}
          borderTopWidth="1px"
          gap={2}
          py={4}
          px={{ base: 5, md: 6 }}
          className="!bg-brand-surface !border-brand-secondary/25"
        >
          {step > 0 ? (
            <button
              type="button"
              onClick={goBack}
              disabled={submitting}
              className={`inline-flex items-center gap-1.5 ${ui.btnGhost} disabled:opacity-50`}
            >
              <HiOutlineArrowLeft className="h-4 w-4" />
              Back
            </button>
          ) : (
            <div />
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className={ui.btnSecondarySurface}
          >
            Cancel
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={goNext}
              className={`${ui.btnPrimary} inline-flex items-center gap-1.5`}
            >
              Continue
              <HiOutlineArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className={ui.btnPrimary}
            >
              {submitting ? "Creating…" : "Create campaign"}
            </button>
          )}
        </ModalFooter>
      </ModalContent>

      <AddContactModal
        isOpen={addProspectOpen}
        onClose={closeAddProspect}
        variant="compact"
        onAdd={(contact) => setProspects((prev) => [...prev, contact])}
      />
    </Modal>
  );
}
