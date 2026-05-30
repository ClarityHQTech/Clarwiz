"use client";

import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ui } from "@/lib/brandUi";

const EMPTY_FORM = {
  name: "",
  firstName: "",
  company: "",
  jobTitle: "",
  painPoint: "",
  email: "",
  phone: "",
  whatsapp: "",
  linkedinUrl: "",
};

function Field({ label, required, children, hint }) {
  return (
    <div>
      <label className="block text-sm font-medium text-brand-stone mb-1.5">
        {label}
        {required && <span className="text-red-600 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-brand-steel mt-1">{hint}</p>}
    </div>
  );
}

export default function AddProspectModal({
  isOpen,
  onClose,
  campaignId,
  onAdded,
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) setForm(EMPTY_FORM);
  }, [isOpen]);

  const update = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleClose = () => {
    if (!saving) onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Name is required.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/prospects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add prospect");
      toast.success("Prospect added.");
      onAdded?.(data);
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const formId = "add-prospect-form";

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="lg"
      isCentered
      scrollBehavior="inside"
      closeOnOverlayClick={!saving}
      blockScrollOnMount
    >
      <ModalOverlay backdropFilter="blur(4px)" className="!bg-black/40" />
      <ModalContent
        mx={4}
        maxH="90vh"
        borderRadius="xl"
        borderWidth="1px"
        display="flex"
        flexDirection="column"
        className="!bg-brand-surface !border-brand-secondary/30 !shadow-xl"
      >
        <ModalHeader
          flexShrink={0}
          borderBottomWidth="1px"
          py={4}
          pr={12}
          className="!bg-brand-surface !border-brand-secondary/25"
        >
          <p className="text-base font-semibold text-brand-ink">Add prospect</p>
          <p className="text-xs font-normal text-brand-stone mt-0.5">
            Enter contact details manually. Name is required; other fields power
            template variables and channel outreach.
          </p>
        </ModalHeader>
        <ModalCloseButton
          isDisabled={saving}
          className="!text-brand-stone hover:!bg-brand-bg"
        />

        <ModalBody
          flex="1"
          overflowY="auto"
          py={5}
          px={{ base: 4, md: 6 }}
          className="!bg-brand-surface"
        >
          <form id={formId} onSubmit={handleSubmit} className="space-y-4">
            <Field label="Full name" required>
              <input
                type="text"
                value={form.name}
                onChange={update("name")}
                placeholder="Jane Smith"
                className={ui.inputSurface}
                autoFocus
              />
            </Field>
            <Field
              label="First name"
              hint="Optional — used for {{first_name}} in templates"
            >
              <input
                type="text"
                value={form.firstName}
                onChange={update("firstName")}
                placeholder="Jane"
                className={ui.inputSurface}
              />
            </Field>

            <div className="rounded-lg border border-brand-secondary/30 bg-brand-bg/40 p-4 space-y-4">
              <p className={ui.label}>Company & role</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Company">
                  <input
                    type="text"
                    value={form.company}
                    onChange={update("company")}
                    placeholder="Acme Inc."
                    className={ui.inputSurface}
                  />
                </Field>
                <Field label="Job title">
                  <input
                    type="text"
                    value={form.jobTitle}
                    onChange={update("jobTitle")}
                    placeholder="VP Sales"
                    className={ui.inputSurface}
                  />
                </Field>
              </div>
              <Field
                label="Pain point / industry"
                hint="Maps to {{pain_point}} in templates"
              >
                <input
                  type="text"
                  value={form.painPoint}
                  onChange={update("painPoint")}
                  placeholder="SaaS · scaling outbound"
                  className={ui.inputSurface}
                />
              </Field>
            </div>

            <div className="rounded-lg border border-brand-secondary/30 bg-brand-bg/40 p-4 space-y-4">
              <p className={ui.label}>Contact channels</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Email">
                  <input
                    type="email"
                    value={form.email}
                    onChange={update("email")}
                    placeholder="jane@acme.com"
                    className={ui.inputSurface}
                  />
                </Field>
                <Field label="Phone">
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={update("phone")}
                    placeholder="+1 555 0100"
                    className={ui.inputSurface}
                  />
                </Field>
                <Field label="WhatsApp">
                  <input
                    type="tel"
                    value={form.whatsapp}
                    onChange={update("whatsapp")}
                    placeholder="+1 555 0100"
                    className={ui.inputSurface}
                  />
                </Field>
                <Field label="LinkedIn URL">
                  <input
                    type="url"
                    value={form.linkedinUrl}
                    onChange={update("linkedinUrl")}
                    placeholder="https://linkedin.com/in/…"
                    className={ui.inputSurface}
                  />
                </Field>
              </div>
            </div>
          </form>
        </ModalBody>

        <ModalFooter
          flexShrink={0}
          borderTopWidth="1px"
          gap={2}
          py={4}
          px={{ base: 4, md: 6 }}
          className="!bg-brand-surface !border-brand-secondary/25"
        >
          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className={ui.btnSecondarySurface}
          >
            Cancel
          </button>
          <button
            type="submit"
            form={formId}
            disabled={saving}
            className={ui.btnPrimary}
          >
            {saving ? "Adding…" : "Add prospect"}
          </button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
