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
  HiOutlineTrash,
} from "react-icons/hi2";
import { toast } from "sonner";
import {
  CAMPAIGN_CHANNELS,
  CHANNEL_LABELS,
  CTA_OPTIONS,
  MAX_TEMPLATE_STAGE,
  TEMPLATE_VARIABLES,
  createTemplate,
  validateTemplate,
} from "@/lib/campaignConstants";
import { parseProspectExcel } from "@/lib/parseProspectExcel";

const STEPS = ["Campaign", "Prospects", "Templates", "Review"];

const INITIAL_CAMPAIGN = {
  name: "",
  description: "",
  targetSegment: "",
  goals: "",
  startDate: "",
};

function StepIndicator({ current }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
              i <= current
                ? "bg-sky-700 text-white"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {i + 1}
          </div>
          <span
            className={`text-xs font-medium hidden sm:inline ${
              i === current ? "text-gray-900" : "text-gray-400"
            }`}
          >
            {label}
          </span>
          {i < STEPS.length - 1 && (
            <div className="w-6 h-px bg-gray-200 hidden sm:block" />
          )}
        </div>
      ))}
    </div>
  );
}

function Field({ label, required, children, hint }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function TemplateCard({ template, onChange, onRemove }) {
  const { channel } = template;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <Field label="Stage">
            <Select
              size="sm"
              w="28"
              value={template.stage}
              onChange={(e) => onChange({ stage: Number(e.target.value) })}
            >
              {Array.from({ length: MAX_TEMPLATE_STAGE }, (_, i) => i + 1).map(
                (n) => (
                  <option key={n} value={n}>
                    Stage {n}
                  </option>
                )
              )}
            </Select>
          </Field>
          <span className="text-xs text-gray-400 mt-5">
            Variables: {TEMPLATE_VARIABLES}
          </span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
          aria-label="Remove template"
        >
          <HiOutlineTrash className="h-4 w-4" />
        </button>
      </div>

      {channel === "email" && (
        <Field label="Subject" required>
          <Input
            size="sm"
            value={template.subject ?? ""}
            onChange={(e) => onChange({ subject: e.target.value })}
            placeholder="Quick idea for {{company}}"
          />
        </Field>
      )}

      {channel === "whatsapp" && (
        <Field
          label="WhatsApp template ID"
          required
          hint="Approved Meta template name / ID — not created here."
        >
          <Input
            size="sm"
            value={template.whatsappTemplateId ?? ""}
            onChange={(e) => onChange({ whatsappTemplateId: e.target.value })}
            placeholder="e.g. outreach_intro_v2"
          />
        </Field>
      )}

      <Field
        label={
          channel === "whatsapp" ? "Template message preview" : "Message body"
        }
        required
      >
        <Textarea
          size="sm"
          rows={3}
          value={template.body}
          onChange={(e) => onChange({ body: e.target.value })}
          placeholder={
            channel === "whatsapp"
              ? "Body text matching your approved WhatsApp template..."
              : "Hi {{first_name}}, I noticed {{company}}..."
          }
        />
      </Field>

      <Field label="CTA" required>
        <Select
          size="sm"
          value={template.cta}
          onChange={(e) => onChange({ cta: e.target.value })}
        >
          {CTA_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

function ChannelTemplatesSection({ channel, templates, onAdd, onUpdate, onRemove }) {
  const channelTemplates = templates
    .filter((t) => t.channel === channel)
    .sort((a, b) => a.stage - b.stage);

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">
            {CHANNEL_LABELS[channel]}
          </h4>
          <p className="text-xs text-gray-500 mt-0.5">
            Add stage templates for this channel (optional).
          </p>
        </div>
        <button
          type="button"
          onClick={() => onAdd(channel)}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 shrink-0"
        >
          <HiOutlinePlus className="h-3.5 w-3.5" />
          Add template
        </button>
      </div>

      <div className="p-4 space-y-3 bg-gray-50/30">
        {channelTemplates.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-2">
            No templates for {CHANNEL_LABELS[channel]} — skip or add when ready.
          </p>
        ) : (
          channelTemplates.map((t) => (
            <TemplateCard
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

  const removeTemplate = (id) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
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
      size="6xl"
      scrollBehavior="inside"
      closeOnOverlayClick={!submitting}
    >
      <ModalOverlay backdropFilter="blur(4px)" />
      <ModalContent mx={3} maxH="92vh" borderRadius="xl">
        <ModalHeader borderBottomWidth="1px" py={4} pr={12}>
          <p className="text-base font-semibold text-gray-900">New campaign</p>
          <p className="text-xs font-normal text-gray-500 mt-0.5">
            Configure campaign details, import prospects, and optionally add comm templates.
          </p>
        </ModalHeader>
        <ModalCloseButton isDisabled={submitting} />

        <ModalBody py={5} px={{ base: 4, md: 6 }}>
          <StepIndicator current={step} />

          {step === 0 && (
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Campaign name" required>
                <Input
                  size="sm"
                  value={campaign.name}
                  onChange={(e) => updateCampaign({ name: e.target.value })}
                  placeholder="Summer 2025"
                />
              </Field>
              <Field label="Start date">
                <Input
                  size="sm"
                  type="date"
                  value={campaign.startDate}
                  onChange={(e) => updateCampaign({ startDate: e.target.value })}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Description">
                  <Textarea
                    size="sm"
                    rows={2}
                    value={campaign.description}
                    onChange={(e) => updateCampaign({ description: e.target.value })}
                    placeholder="Campaign overview and positioning..."
                  />
                </Field>
              </div>
              <Field label="Target segment">
                <Input
                  size="sm"
                  value={campaign.targetSegment}
                  onChange={(e) => updateCampaign({ targetSegment: e.target.value })}
                  placeholder="Mid-market SaaS, US & UK"
                />
              </Field>
              <Field label="Goals">
                <Input
                  size="sm"
                  value={campaign.goals}
                  onChange={(e) => updateCampaign({ goals: e.target.value })}
                  placeholder="Book 20 demos, 50 qualified replies"
                />
              </Field>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50/50 p-6 text-center">
                <HiOutlineArrowUpTray className="mx-auto h-8 w-8 text-gray-400" />
                <p className="text-sm font-medium text-gray-900 mt-2">
                  Upload prospect list (.xlsx, .xls, .csv)
                </p>
                <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                  Columns: name, company, job title, phone, whatsapp no., email, linkedinUrl
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
                  <span className="cursor-pointer inline-flex items-center rounded-lg bg-white border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    Choose file
                  </span>
                </label>
                {fileName && (
                  <p className="text-xs text-sky-700 mt-2 font-medium">{fileName}</p>
                )}
              </div>

              {uploadErrors.length > 0 && (
                <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-800 max-h-24 overflow-y-auto">
                  {uploadErrors.slice(0, 5).map((err, i) => (
                    <p key={i}>{err}</p>
                  ))}
                  {uploadErrors.length > 5 && (
                    <p>…and {uploadErrors.length - 5} more</p>
                  )}
                </div>
              )}

              {prospects.length > 0 && (
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                    <span className="text-xs font-medium text-gray-600">
                      Preview ({prospects.length} prospects)
                    </span>
                  </div>
                  <div className="overflow-x-auto max-h-48">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-gray-500 border-b border-gray-100">
                          <th className="px-3 py-2 font-medium">Name</th>
                          <th className="px-3 py-2 font-medium">Company</th>
                          <th className="px-3 py-2 font-medium">Title</th>
                          <th className="px-3 py-2 font-medium">Email</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {prospects.slice(0, 8).map((p, i) => (
                          <tr key={i}>
                            <td className="px-3 py-1.5 text-gray-900">{p.name}</td>
                            <td className="px-3 py-1.5 text-gray-600">{p.company || "—"}</td>
                            <td className="px-3 py-1.5 text-gray-600">{p.jobTitle || "—"}</td>
                            <td className="px-3 py-1.5 text-gray-600">{p.email || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {prospects.length > 8 && (
                    <p className="text-xs text-gray-400 px-3 py-2 border-t border-gray-100">
                      +{prospects.length - 8} more rows
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500">
                Templates are optional. Use <strong>Add template</strong> per channel to
                create stage-1, stage-2, and follow-ups. AI calling is not available yet.
              </p>
              {CAMPAIGN_CHANNELS.map((channel) => (
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
              <div className="rounded-lg border border-gray-200 p-4 space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Campaign
                </h4>
                <p className="font-medium text-gray-900">{campaign.name}</p>
                {campaign.description && (
                  <p className="text-xs text-gray-600">{campaign.description}</p>
                )}
                <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                  {campaign.targetSegment && (
                    <span>Segment: {campaign.targetSegment}</span>
                  )}
                  {campaign.goals && <span>Goals: {campaign.goals}</span>}
                  {campaign.startDate && (
                    <span>Start: {campaign.startDate}</span>
                  )}
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 p-4">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                  Prospects
                </h4>
                <p className="text-gray-900 font-medium">{prospects.length} contacts</p>
              </div>
              <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Templates
                </h4>
                {templates.length === 0 ? (
                  <p className="text-xs text-gray-500">None — can add later from campaign details.</p>
                ) : (
                  [...templates]
                    .sort(
                      (a, b) =>
                        a.channel.localeCompare(b.channel) || a.stage - b.stage
                    )
                    .map((t) => (
                      <div
                        key={t.id}
                        className="text-xs border-t border-gray-100 pt-2 first:border-0 first:pt-0"
                      >
                        <p className="font-medium text-gray-800">
                          {CHANNEL_LABELS[t.channel]} · Stage {t.stage}
                        </p>
                        {t.channel === "whatsapp" && (
                          <p className="text-gray-500">ID: {t.whatsappTemplateId}</p>
                        )}
                        {t.channel === "email" && (
                          <p className="text-gray-500">Subject: {t.subject}</p>
                        )}
                        <p className="text-gray-600 line-clamp-2 mt-0.5">{t.body}</p>
                        <p className="text-gray-400 mt-0.5">
                          CTA: {CTA_OPTIONS.find((c) => c.value === t.cta)?.label}
                        </p>
                      </div>
                    ))
                )}
              </div>
            </div>
          )}
        </ModalBody>

        <ModalFooter borderTopWidth="1px" gap={2} py={4}>
          {step > 0 ? (
            <Button
              size="sm"
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
          <Button size="sm" variant="outline" onClick={handleClose} isDisabled={submitting}>
            Cancel
          </Button>
          {step < STEPS.length - 1 ? (
            <Button
              size="sm"
              colorScheme="blue"
              rightIcon={<HiOutlineArrowRight />}
              onClick={goNext}
            >
              Continue
            </Button>
          ) : (
            <Button
              size="sm"
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
