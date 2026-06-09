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
import { modalShell, modalUi, ui } from "@/lib/brandUi";
import { CONTACT_PERSONA_LABELS } from "@/lib/contactPersona";

const EMPTY_FORM = {
  name: "",
  firstName: "",
  lastName: "",
  company: "",
  jobTitle: "",
  persona: "",
  email: "",
  phone: "",
  whatsapp: "",
  linkedinUrl: "",
  twitterId: "",
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

export default function AddContactModal({
  isOpen,
  onClose,
  campaignId,
  onAdded,
  onAdd,
  variant = "full",
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

    if (onAdd) {
      onAdd(form);
      toast.success("Contact added.");
      onClose();
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add contact");
      toast.success("Contact added.");
      onAdded?.(data);
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const formId = "add-contact-form";

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
      <ModalOverlay backdropFilter="blur(4px)" className={modalUi.overlayClass} />
      <ModalContent
        {...modalShell.content}
        {...modalShell.contentCentered}
        className={modalUi.contentClass}
      >
        <ModalHeader {...modalShell.header} className={modalUi.headerClass}>
          <p className="text-base font-semibold text-brand-ink">Add contact</p>
          {variant === "full" && (
            <p className="text-xs font-normal text-brand-stone mt-0.5">
              Creates or links a business user and enrolls them in this campaign.
            </p>
          )}
        </ModalHeader>
        <ModalCloseButton
          isDisabled={saving}
          className={modalUi.closeButtonClass}
        />

        <ModalBody
          {...modalShell.body}
          {...modalShell.bodyPadded}
          className={modalUi.bodyClass}
        >
          <form id={formId} onSubmit={handleSubmit} className="space-y-4">
            <Field label="Name" required>
              <input
                type="text"
                value={form.name}
                onChange={update("name")}
                placeholder="Jane Smith"
                className={ui.inputSurface}
                autoFocus
              />
            </Field>

            {variant === "full" && (
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="First name" hint="Used for {{first_name}}">
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={update("firstName")}
                    className={ui.inputSurface}
                  />
                </Field>
                <Field label="Last name">
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={update("lastName")}
                    className={ui.inputSurface}
                  />
                </Field>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Company">
                <input
                  type="text"
                  value={form.company}
                  onChange={update("company")}
                  className={ui.inputSurface}
                />
              </Field>
              <Field label="Job title">
                <input
                  type="text"
                  value={form.jobTitle}
                  onChange={update("jobTitle")}
                  className={ui.inputSurface}
                />
              </Field>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Email">
                <input
                  type="email"
                  value={form.email}
                  onChange={update("email")}
                  className={ui.inputSurface}
                />
              </Field>
              <Field label="WhatsApp">
                <input
                  type="tel"
                  value={form.whatsapp}
                  onChange={update("whatsapp")}
                  className={ui.inputSurface}
                />
              </Field>
              <Field label="Phone">
                <input
                  type="tel"
                  value={form.phone}
                  onChange={update("phone")}
                  className={ui.inputSurface}
                />
              </Field>
              <Field label="LinkedIn URL">
                <input
                  type="url"
                  value={form.linkedinUrl}
                  onChange={update("linkedinUrl")}
                  className={ui.inputSurface}
                />
              </Field>
            </div>

            {variant === "full" && (
              <>
                <Field label="Persona">
                  <select
                    value={form.persona}
                    onChange={update("persona")}
                    className={ui.inputSurface}
                  >
                    <option value="">Other (default)</option>
                    {Object.entries(CONTACT_PERSONA_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Twitter / X">
                  <input
                    type="text"
                    value={form.twitterId}
                    onChange={update("twitterId")}
                    className={ui.inputSurface}
                  />
                </Field>
              </>
            )}
          </form>
        </ModalBody>

        <ModalFooter {...modalShell.footer} className={modalUi.footerClass}>
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
            {saving ? "Adding…" : "Add contact"}
          </button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
