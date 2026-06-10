"use client";

import { useEffect, useState } from "react";
import {
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
} from "@chakra-ui/react";
import { toast } from "sonner";
import { TYPE_OPTIONS, CATEGORY_OPTIONS, STAGE_OPTIONS } from "./constants";
import { modalShell, modalUi, ui } from "@/lib/brandUi";

const EMPTY = {
  title: "",
  category: "SALES",
  type: "ONE_PAGER",
  funnelStage: "ANY",
  html: "",
  url: "",
  tags: "",
};

export default function RegisterModal({ isOpen, onClose, onRegistered }) {
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const close = () => {
    setForm(EMPTY);
    onClose();
  };

  useEffect(() => {
    if (!isOpen) setForm(EMPTY);
  }, [isOpen]);

  const submit = async () => {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!form.html.trim() && !form.url.trim()) {
      toast.error("Paste HTML content or provide an external URL");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/assist/collateral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          category: form.category,
          type: form.type,
          funnelStage: form.funnelStage,
          html: form.html.trim() || undefined,
          url: form.url.trim() || undefined,
          tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Could not register template");
        return;
      }
      toast.success(form.html.trim() ? "Template registered" : "Collateral registered");
      onRegistered?.(data.item);
      close();
    } catch {
      toast.error("Could not register template");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      isCentered
      size="2xl"
      scrollBehavior="inside"
      closeOnOverlayClick={!submitting}
    >
      <ModalOverlay backdropFilter="blur(4px)" className={modalUi.overlayClass} />
      <ModalContent
        {...modalShell.content}
        {...modalShell.contentCentered}
        maxW="3xl"
        className={modalUi.contentClass}
      >
        <ModalHeader {...modalShell.header} className={`${modalUi.headerClass} !border-b`}>
          <span className="font-serif text-lg">Register brand template</span>
        </ModalHeader>
        <ModalCloseButton className={modalUi.closeButtonClass} isDisabled={submitting} />

        <ModalBody
          {...modalShell.body}
          {...modalShell.bodyPadded}
          className={`${modalUi.bodyClass} space-y-4`}
        >
          <div>
            <label className={`block ${ui.label} mb-1 normal-case tracking-normal`}>Title</label>
            <input
              className={ui.inputSurface}
              value={form.title}
              onChange={set("title")}
              placeholder="Sales one-pager"
              autoFocus
            />
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className={`block ${ui.label} mb-1 normal-case tracking-normal`}>Category</label>
              <select className={ui.inputSurface} value={form.category} onChange={set("category")}>
                {CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={`block ${ui.label} mb-1 normal-case tracking-normal`}>Type</label>
              <select className={ui.inputSurface} value={form.type} onChange={set("type")}>
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={`block ${ui.label} mb-1 normal-case tracking-normal`}>Funnel stage</label>
              <select className={ui.inputSurface} value={form.funnelStage} onChange={set("funnelStage")}>
                {STAGE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={`block ${ui.label} mb-1 normal-case tracking-normal`}>HTML content</label>
            <textarea
              className={`${ui.inputSurface} font-mono text-xs resize-y min-h-[200px]`}
              value={form.html}
              onChange={set("html")}
              placeholder="<!DOCTYPE html><html>…paste your on-brand template markup…</html>"
              rows={12}
            />
            <p className="text-xs text-brand-stone mt-1.5">
              The pasted markup becomes an editable brand template. Bake brand colors in; use{" "}
              <code className={ui.code}>{"{{prospect_name}}"}</code>-style placeholders for personalization.
            </p>
          </div>

          <div>
            <label className={`block ${ui.label} mb-1 normal-case tracking-normal`}>External URL (optional)</label>
            <input
              className={ui.inputSurface}
              value={form.url}
              onChange={set("url")}
              placeholder="https://… (link-only asset instead of pasted HTML)"
            />
          </div>

          <div>
            <label className={`block ${ui.label} mb-1 normal-case tracking-normal`}>Tags</label>
            <input
              className={ui.inputSurface}
              value={form.tags}
              onChange={set("tags")}
              placeholder="fintech, cfo, security"
            />
            <p className="text-xs text-brand-stone mt-1.5">Comma-separated; powers best-match ranking.</p>
          </div>
        </ModalBody>

        <ModalFooter {...modalShell.footer} className={`${modalUi.footerClass} !border-t gap-2`}>
          <button type="button" className={ui.btnSecondary} onClick={close} disabled={submitting}>
            Cancel
          </button>
          <button type="button" className={ui.btnPrimary} onClick={submit} disabled={submitting}>
            {submitting ? "Registering…" : "Register template"}
          </button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
