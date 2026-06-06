"use client";

import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Checkbox,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ui } from "@/lib/brandUi";

const initialForm = {
  name: "",
  industry: "",
  about: "",
  website: "",
  adminEmail: "",
  payment_status: false,
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

export default function CreateTenantModal({ isOpen, onClose, onCreated }) {
  const [form, setForm] = useState(initialForm);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (isOpen) setForm(initialForm);
  }, [isOpen]);

  const update = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleClose = () => {
    if (!creating) onClose();
  };

  const createTenant = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Tenant name is required");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          industry: form.industry.trim() || undefined,
          about: form.about.trim() || undefined,
          website: form.website.trim() || undefined,
          adminEmail: form.adminEmail.trim() || undefined,
          payment_status: form.payment_status,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Failed to create tenant");
        return;
      }
      toast.success("Tenant created");
      setForm(initialForm);
      onCreated?.(data.tenant);
      onClose();
    } catch {
      toast.error("Failed to create tenant");
    } finally {
      setCreating(false);
    }
  };

  const formId = "create-tenant-form";

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="lg"
      isCentered
      scrollBehavior="inside"
      closeOnOverlayClick={!creating}
      blockScrollOnMount
    >
      <ModalOverlay backdropFilter="blur(4px)" className="!bg-black/40" />
      <ModalContent
        mx={4}
        maxH="90vh"
        borderRadius="xl"
        overflow="hidden"
        borderWidth="1px"
        display="flex"
        flexDirection="column"
        className="!bg-brand-surface !border-brand-secondary/30 !shadow-xl !rounded-xl !overflow-hidden"
      >
        <ModalHeader
          flexShrink={0}
          borderBottomWidth="1px"
          borderTopRadius="inherit"
          py={4}
          pr={12}
          className="!bg-brand-surface !border-brand-secondary/25"
        >
          <p className="text-base font-semibold text-brand-ink">Create tenant</p>
          <p className="text-xs font-normal text-brand-stone mt-0.5">
            Set up the workspace and assign a tenant admin.
          </p>
        </ModalHeader>
        <ModalCloseButton
          isDisabled={creating}
          className="!text-brand-stone hover:!bg-brand-bg"
        />

        <ModalBody
          flex="1"
          overflowY="auto"
          py={5}
          px={{ base: 4, md: 6 }}
          className="!bg-brand-surface"
        >
          <form id={formId} onSubmit={createTenant} className="space-y-4">
            <Field label="Name" required>
              <input
                type="text"
                value={form.name}
                onChange={update("name")}
                placeholder="Acme Corp"
                className={ui.inputSurface}
                autoFocus
                required
              />
            </Field>

            <Field label="Industry">
              <input
                type="text"
                value={form.industry}
                onChange={update("industry")}
                placeholder="e.g. SaaS, Healthcare"
                className={ui.inputSurface}
              />
            </Field>

            <Field label="Website">
              <input
                type="url"
                value={form.website}
                onChange={update("website")}
                placeholder="https://example.com"
                className={ui.inputSurface}
              />
            </Field>

            <Field label="About">
              <textarea
                value={form.about}
                onChange={update("about")}
                placeholder="Brief description of the company"
                rows={3}
                className={`${ui.inputSurface} resize-y`}
              />
            </Field>

            <Field label="Admin email" hint="Invited as tenant admin if provided">
              <input
                type="email"
                value={form.adminEmail}
                onChange={update("adminEmail")}
                placeholder="admin@company.com"
                className={ui.inputSurface}
              />
            </Field>

            <Checkbox
              isChecked={form.payment_status}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  payment_status: e.target.checked,
                }))
              }
              colorScheme="green"
              className="!text-sm !text-brand-stone"
            >
              Payment enabled
            </Checkbox>
          </form>
        </ModalBody>

        <ModalFooter
          flexShrink={0}
          borderTopWidth="1px"
          borderBottomRadius="inherit"
          gap={2}
          py={4}
          px={{ base: 4, md: 6 }}
          className="!bg-brand-surface !border-brand-secondary/25"
        >
          <button
            type="button"
            onClick={handleClose}
            disabled={creating}
            className={ui.btnSecondarySurface}
          >
            Cancel
          </button>
          <button
            type="submit"
            form={formId}
            disabled={creating}
            className={ui.btnPrimary}
          >
            {creating ? "Creating…" : "Create tenant"}
          </button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
