"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
} from "@chakra-ui/react";
import { HiOutlineSparkles } from "react-icons/hi2";
import { toast } from "sonner";
import { TYPE_LABELS } from "./constants";
import { modalShell, modalUi, ui } from "@/lib/brandUi";

export const OTHER_TEMPLATE_VALUE = "__other__";

function buildEmptyForm(templates = []) {
  return {
    templateSelection: templates[0]?.id ?? "",
    customType: "",
    dealId: "",
    prospectCompany: "",
    prospectIndustry: "",
    championName: "",
    championTitle: "",
    instructions: "",
  };
}

export default function CollateralCreateModal({
  isOpen,
  onClose,
  deals = [],
  templates = [],
  onCreated,
  onOpenEditor,
}) {
  const [form, setForm] = useState(() => buildEmptyForm(templates));
  const [loading, setLoading] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const isOther = form.templateSelection === OTHER_TEMPLATE_VALUE;

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === form.templateSelection) ?? null,
    [templates, form.templateSelection],
  );

  const close = () => {
    setForm(buildEmptyForm(templates));
    onClose();
  };

  useEffect(() => {
    if (!isOpen) {
      setForm(buildEmptyForm(templates));
      return;
    }
    setForm((prev) => {
      const next = buildEmptyForm(templates);
      if (prev.templateSelection && templates.some((t) => t.id === prev.templateSelection)) {
        next.templateSelection = prev.templateSelection;
      } else if (prev.templateSelection === OTHER_TEMPLATE_VALUE) {
        next.templateSelection = OTHER_TEMPLATE_VALUE;
        next.customType = prev.customType;
      }
      return next;
    });
  }, [isOpen, templates]);

  const useDeal = Boolean(form.dealId);

  const create = async () => {
    if (!form.templateSelection) {
      toast.error("Select a registered template or Other");
      return;
    }
    if (isOther && !form.customType.trim()) {
      toast.error("Describe the new collateral type you want to create");
      return;
    }
    if (!form.instructions.trim()) {
      toast.error("Describe what collateral you want to create");
      return;
    }
    if (!useDeal && !form.prospectCompany.trim()) {
      toast.error("Select a deal or enter a prospect company");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        instructions: form.instructions.trim(),
        dealId: useDeal ? form.dealId : undefined,
        prospectCompany: useDeal ? undefined : form.prospectCompany.trim(),
        prospectIndustry: useDeal ? undefined : form.prospectIndustry.trim() || undefined,
        championName: useDeal ? undefined : form.championName.trim() || undefined,
        championTitle: useDeal ? undefined : form.championTitle.trim() || undefined,
      };

      if (isOther) {
        payload.customType = form.customType.trim();
      } else {
        payload.templateId = form.templateSelection;
      }

      const res = await fetch("/api/assist/collateral/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          data.error === "anthropic_not_configured"
            ? "Collateral creation needs an Anthropic API key"
            : data.error === "instructions_required"
              ? "Add instructions for what to create"
              : data.error === "template_or_custom_type_required"
                ? "Select a template or enter a custom type"
                : data.error === "template_not_found"
                  ? "That template is no longer available"
                  : data.error === "prospect_or_deal_required"
                    ? "Select a deal or enter a prospect company"
                    : data.error === "personalize_failed"
                      ? "Could not personalize collateral — try again"
                      : data.error || "Creation failed";
        toast.error(msg);
        return;
      }

      onCreated?.(data.item);
      close();
      onOpenEditor?.({ documentId: data.documentId, title: data.title });
      toast.success("Collateral created and saved");
    } catch {
      toast.error("Creation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={close} size="4xl" scrollBehavior="inside">
      <ModalOverlay className={modalUi.overlayClass} />
      <ModalContent className={modalUi.contentClass}>
        <ModalHeader className={modalUi.headerClass}>
          <p className={`${ui.label} mb-0.5 normal-case tracking-wide font-sans`}>New collateral</p>
          <span className="font-serif text-lg">Create hyper-personalized collateral</span>
        </ModalHeader>
        <ModalCloseButton className={modalUi.closeButtonClass} />
        <ModalBody className={`${modalUi.bodyClass} space-y-5`}>
          <p className={`${ui.body} text-sm`}>
            Pick a registered template or define a new type, then describe what to create — like an
            NBA suggestion in AE Assist. We personalize it for your tenant and prospect, then save it
            to your library.
          </p>

          <div className="grid lg:grid-cols-2 gap-5">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-brand-stone uppercase tracking-wide mb-2">
                  Collateral type
                </label>
                <select
                  className={ui.input}
                  value={form.templateSelection}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      templateSelection: e.target.value,
                      customType: e.target.value === OTHER_TEMPLATE_VALUE ? f.customType : "",
                    }))
                  }
                >
                  <option value="" disabled>
                    Select a template…
                  </option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                      {t.type ? ` (${TYPE_LABELS[t.type] ?? t.type})` : ""}
                      {t.isPredefined ? " · System" : ""}
                    </option>
                  ))}
                  <option value={OTHER_TEMPLATE_VALUE}>Other</option>
                </select>
                {selectedTemplate ? (
                  <p className="text-xs text-brand-stone mt-2">
                    {TYPE_LABELS[selectedTemplate.type] ?? selectedTemplate.type}
                    {selectedTemplate.category ? ` · ${selectedTemplate.category}` : ""}
                  </p>
                ) : null}
              </div>

              {isOther ? (
                <div>
                  <label className="block text-xs font-semibold text-brand-stone uppercase tracking-wide mb-2">
                    New collateral type
                  </label>
                  <input
                    className={ui.input}
                    value={form.customType}
                    onChange={set("customType")}
                    placeholder="e.g. ROI one-pager, executive brief, customer case study"
                  />
                  <p className="text-xs text-brand-stone mt-2">
                    Describe the format you want. We will shape layout and copy around your instructions.
                  </p>
                </div>
              ) : null}

              <div>
                <label className="block text-xs font-semibold text-brand-stone uppercase tracking-wide mb-2">
                  For whom
                </label>
                <select className={ui.input} value={form.dealId} onChange={set("dealId")}>
                  <option value="">Manual prospect (no deal)</option>
                  {deals.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                      {d.companyName ? ` · ${d.companyName}` : ""}
                      {d.stageLabel ? ` · ${d.stageLabel}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {!useDeal ? (
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-brand-stone mb-1">Prospect company *</label>
                    <input
                      className={ui.input}
                      value={form.prospectCompany}
                      onChange={set("prospectCompany")}
                      placeholder="Acme Robotics"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-brand-stone mb-1">Industry</label>
                    <input
                      className={ui.input}
                      value={form.prospectIndustry}
                      onChange={set("prospectIndustry")}
                      placeholder="Industrial automation"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-brand-stone mb-1">Champion name</label>
                    <input
                      className={ui.input}
                      value={form.championName}
                      onChange={set("championName")}
                      placeholder="Jordan Lee"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-brand-stone mb-1">Champion title</label>
                    <input
                      className={ui.input}
                      value={form.championTitle}
                      onChange={set("championTitle")}
                      placeholder="VP Sales"
                    />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-brand-stone bg-brand-bg rounded-lg p-3">
                  Deal context — company, contacts, stage, and insights — will be pulled from AE Assist
                  automatically.
                </p>
              )}
            </div>

            <div className="space-y-3 flex flex-col">
              <label className="block text-xs font-semibold text-brand-stone uppercase tracking-wide">
                Your instructions
              </label>
              <textarea
                className={`${ui.inputSurface} flex-1 min-h-[200px] resize-y text-sm`}
                value={form.instructions}
                onChange={set("instructions")}
                placeholder={`e.g. "Create a discovery-stage battlecard for the VP Sales champion. Emphasize how we reduce tool sprawl vs ZoomInfo + Outreach. Include a section on signal-driven account lists and NBA-guided follow-up. Keep tone executive and proof-led."`}
              />
              <p className="text-xs text-brand-stone">
                Be specific: collateral purpose, audience, key messages, competitors to address, and
                sections to include or avoid.
              </p>
            </div>
          </div>
        </ModalBody>
        <ModalFooter className={modalShell.footerClass}>
          <button type="button" className={ui.btnSecondary} onClick={close} disabled={loading}>
            Cancel
          </button>
          <button type="button" className={ui.btnPrimary} onClick={create} disabled={loading}>
            <HiOutlineSparkles className="h-4 w-4" />
            {loading ? "Creating…" : "Create collateral"}
          </button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
