"use client";

import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Button,
  Input,
  Textarea,
  Select,
} from "@chakra-ui/react";
import { useState } from "react";
import {
  HiOutlineArrowLeft,
  HiOutlineArrowRight,
  HiOutlineArrowUpTray,
  HiOutlinePlus,
} from "react-icons/hi2";
import { toast } from "sonner";
import TemplateEditorCard from "@/components/campaigns/TemplateEditorCard";
import WhatsAppCampaignTemplatesSection from "@/components/campaigns/WhatsAppCampaignTemplatesSection";
import { commTemplatesFromWhatsAppSelection } from "@/lib/whatsappCampaignTemplates";
import {
  CAMPAIGN_CHANNELS,
  CHANNEL_LABELS,
  CTA_OPTIONS,
  MAX_TEMPLATE_STAGE,
  PROSPECT_IMPORT_COLUMNS,
  createTemplate,
  validateTemplate,
} from "@/lib/campaignConstants";
import { TEMPLATE_VARIABLES } from "@/lib/templateVariables";
import { parseProspectExcel } from "@/lib/parseProspectExcel";

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

function ChannelTemplatesSection({ channel, templates, onAdd, onUpdate, onRemove }) {
  const channelTemplates = templates
    .filter((t) => t.channel === channel)
    .sort((a, b) => a.stage - b.stage);

  return (
    <div className="rounded-lg border border-brand-secondary/30 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-brand-bg border-b border-brand-secondary/30">
        <div>
          <h4 className="text-sm font-semibold text-brand-ink">
            {CHANNEL_LABELS[channel]}
          </h4>
          <p className="text-xs text-brand-stone mt-0.5">
            Add stage templates for this channel (optional).
          </p>
        </div>
        <button
          type="button"
          onClick={() => onAdd(channel)}
          className="inline-flex items-center gap-1 rounded-lg border border-brand-secondary/40 bg-white px-2.5 py-1.5 text-xs font-medium text-brand-stone hover:bg-brand-bg shrink-0"
        >
          <HiOutlinePlus className="h-3.5 w-3.5" />
          Add template
        </button>
      </div>

      <div className="p-4 space-y-3 bg-brand-bg/30">
        {channelTemplates.length === 0 ? (
          <p className="text-xs text-brand-steel text-center py-2">
            No templates for {CHANNEL_LABELS[channel]} — skip or add when ready.
          </p>
        ) : (
          channelTemplates.map((t) => (
            <TemplateEditorCard
              key={t.id}
              template={t}
              onChange={(patch) => onUpdate(t.id, patch)}
              onRemove={() => onRemove(t.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default function NewCampaignModal({ isOpen, onClose, onCreated }) {
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

  const addTemplate = (channel) => {
    const existingStages = templates
      .filter((t) => t.channel === channel)
      .map((t) => t.stage);
    const nextStage =
      existingStages.length > 0 ? Math.max(...existingStages) + 1 : 1;
    setTemplates((prev) => [
      ...prev,
      createTemplate(channel, Math.min(nextStage, MAX_TEMPLATE_STAGE)),
    ]);
  };

  const updateTemplate = (id, patch) => {
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch } : t))
    );
  };

  const updateWhatsAppTemplate = (id, patch) => updateTemplate(id, patch);

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
        toast.error("Upload a prospect list with at least one row.");
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
      <ModalOverlay backdropFilter="blur(4px)" />
      <ModalContent m={0} maxH="100vh" minH="100vh" borderRadius="none">
        <ModalHeader borderBottomWidth="1px" py={5} px={{ base: 5, md: 6 }} pr={12}>
          <p className="text-lg font-semibold text-brand-ink">New campaign</p>
          <p className="text-sm font-normal text-brand-stone mt-1">
            Configure campaign details, import prospects, and optionally add comm templates.
          </p>
        </ModalHeader>
        <ModalCloseButton isDisabled={submitting} />

        <ModalBody py={6} px={{ base: 5, md: 8 }}>
          <StepIndicator current={step} />

          {step === 0 && (
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Campaign name" required>
                <Input
                  size="md"
                  value={campaign.name}
                  onChange={(e) => updateCampaign({ name: e.target.value })}
                  placeholder="Summer 2025"
                />
              </Field>
              <Field label="Start date">
                <Input
                  size="md"
                  type="date"
                  value={campaign.startDate}
                  onChange={(e) => updateCampaign({ startDate: e.target.value })}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Description">
                  <Textarea
                    size="md"
                    rows={3}
                    value={campaign.description}
                    onChange={(e) => updateCampaign({ description: e.target.value })}
                    placeholder="Campaign overview and positioning..."
                  />
                </Field>
              </div>
              <Field label="Target segment">
                <Input
                  size="md"
                  value={campaign.targetSegment}
                  onChange={(e) => updateCampaign({ targetSegment: e.target.value })}
                  placeholder="Mid-market SaaS, US & UK"
                />
              </Field>
              <Field label="Goals">
                <Input
                  size="md"
                  value={campaign.goals}
                  onChange={(e) => updateCampaign({ goals: e.target.value })}
                  placeholder="Book 20 demos, 50 qualified replies"
                />
              </Field>
              <div className="sm:col-span-2">
                <Field
                  label="Calendly booking URL"
                  hint="Used in stage 2+ outreach and tracked links. Connect Calendly in Settings for auto-qualify on book."
                >
                  <Input
                    size="md"
                    type="url"
                    value={campaign.calendlyBookingUrl}
                    onChange={(e) =>
                      updateCampaign({ calendlyBookingUrl: e.target.value })
                    }
                    placeholder="https://calendly.com/your-team/30min"
                  />
                </Field>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="rounded-lg border-2 border-dashed border-brand-secondary/30 bg-brand-bg/50 p-7 text-center">
                <HiOutlineArrowUpTray className="mx-auto h-8 w-8 text-brand-steel" />
                <p className="text-base font-medium text-brand-ink mt-2">
                  Upload prospect list (.xlsx, .xls, .csv)
                </p>
                <p className="text-sm text-brand-stone mt-1 max-w-lg mx-auto">
                  Recognized columns (any casing):{" "}
                  {PROSPECT_IMPORT_COLUMNS.join(" · ")}
                </p>
                <p className="text-sm text-brand-steel mt-1">
                  Maps to template variables: {TEMPLATE_VARIABLES}
                </p>
                <label className="mt-4 inline-block">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                      handleFile(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                  <span className="cursor-pointer inline-flex items-center rounded-lg bg-white border border-brand-secondary/40 px-3.5 py-2 text-sm font-medium text-brand-stone hover:bg-brand-bg">
                    Choose file
                  </span>
                </label>
                {fileName && (
                  <p className="text-sm text-brand-terracotta mt-2 font-medium">{fileName}</p>
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

              {prospects.length > 0 && (
                <div className="rounded-lg border border-brand-secondary/30 overflow-hidden">
                  <div className="px-3 py-2 bg-brand-bg border-b border-brand-secondary/30 flex justify-between items-center">
                    <span className="text-xs font-medium text-brand-stone">
                      Preview ({prospects.length} prospects)
                    </span>
                  </div>
                  <div className="overflow-x-auto max-h-48">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-brand-stone border-b border-brand-secondary/15">
                          <th className="px-3 py-2 font-medium">Name</th>
                          <th className="px-3 py-2 font-medium">First</th>
                          <th className="px-3 py-2 font-medium">Company</th>
                          <th className="px-3 py-2 font-medium">Title</th>
                          <th className="px-3 py-2 font-medium">Industry</th>
                          <th className="px-3 py-2 font-medium">Email</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-secondary/15">
                        {prospects.slice(0, 8).map((p, i) => (
                          <tr key={i}>
                            <td className="px-3 py-1.5 text-brand-ink">{p.name}</td>
                            <td className="px-3 py-1.5 text-brand-stone">{p.firstName || "—"}</td>
                            <td className="px-3 py-1.5 text-brand-stone">{p.company || "—"}</td>
                            <td className="px-3 py-1.5 text-brand-stone">{p.jobTitle || "—"}</td>
                            <td className="px-3 py-1.5 text-brand-stone">{p.painPoint || "—"}</td>
                            <td className="px-3 py-1.5 text-brand-stone">{p.email || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {prospects.length > 8 && (
                    <p className="text-xs text-brand-steel px-3 py-2 border-t border-brand-secondary/15">
                      +{prospects.length - 8} more rows
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-xs text-brand-stone">
                Templates are optional. For WhatsApp, select from your approved provider
                templates. For email and LinkedIn, add stage templates manually. AI calling
                is not available yet.
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
                  onAdd={addTemplate}
                  onUpdate={updateTemplate}
                  onRemove={removeTemplate}
                />
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 text-sm">
              <div className="rounded-lg border border-brand-secondary/30 p-4 space-y-2">
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
              <div className="rounded-lg border border-brand-secondary/30 p-4">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-brand-stone mb-1">
                  Prospects
                </h4>
                <p className="text-brand-ink font-medium">{prospects.length} contacts</p>
              </div>
              <div className="rounded-lg border border-brand-secondary/30 p-4 space-y-3">
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

        <ModalFooter borderTopWidth="1px" gap={2} py={4} px={{ base: 5, md: 6 }}>
          {step > 0 ? (
            <Button
              size="md"
              variant="ghost"
              leftIcon={<HiOutlineArrowLeft />}
              onClick={goBack}
              isDisabled={submitting}
            >
              Back
            </Button>
          ) : (
            <div />
          )}
          <div className="flex-1" />
          <Button size="md" variant="outline" onClick={handleClose} isDisabled={submitting}>
            Cancel
          </Button>
          {step < STEPS.length - 1 ? (
            <Button
              size="md"
              colorScheme="blue"
              rightIcon={<HiOutlineArrowRight />}
              onClick={goNext}
            >
              Continue
            </Button>
          ) : (
            <Button
              size="md"
              colorScheme="blue"
              onClick={handleSubmit}
              isLoading={submitting}
              loadingText="Creating..."
            >
              Create campaign
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
