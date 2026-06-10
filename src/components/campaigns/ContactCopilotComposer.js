"use client";

import { useMemo, useState } from "react";
import { HiOutlinePaperAirplane } from "react-icons/hi2";
import { toast } from "sonner";
import { ui } from "@/lib/brandUi";
import { CHANNEL_LABELS } from "@/lib/campaignConstants";
import { applyTemplateVariables } from "@/lib/execution/renderMessage";
import {
  getLinkedInCopilotUiState,
  LINKEDIN_CONNECTION_NOTE_MAX_CHARS,
} from "@/lib/execution/executionRules";
import { getWhatsAppCopilotUiState } from "@/lib/whatsappSessionWindow";
import {
  canUseTemplateForProspect,
  TEMPLATE_VARIABLES,
} from "@/lib/templateVariables";

function TemplateSelect({ label, templates, value, onChange, prospect }) {
  if (!templates.length) {
    return (
      <p className="text-xs text-brand-stone">
        No {label} templates — add them in campaign Settings.
      </p>
    );
  }

  return (
    <div>
      <label className={`block ${ui.label} mb-1 normal-case tracking-normal`}>
        Use template (optional)
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={ui.inputSurface}
      >
        <option value="">Custom message</option>
        {templates.map((t) => {
          const usable = canUseTemplateForProspect(t, prospect);
          return (
            <option key={t.id} value={t.id} disabled={!usable}>
              S{t.stage}
              {t.channel === "email" && t.subject ? ` — ${t.subject}` : ""}
              {t.channel === "whatsapp" && t.whatsappTemplateId
                ? ` — ${t.whatsappTemplateId}`
                : ""}
              {!usable ? " (missing contact fields)" : ""}
            </option>
          );
        })}
      </select>
    </div>
  );
}

function EmailComposer({ prospect, campaign, templates, onSend, sending }) {
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const applyTemplate = (id) => {
    setTemplateId(id);
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    setSubject(applyTemplateVariables(tpl.subject, { prospect, campaign }));
    setMessage(applyTemplateVariables(tpl.body, { prospect, campaign }));
  };

  if (!prospect.email?.trim()) {
    return (
      <p className="text-xs text-brand-stone py-2">
        This contact has no email address.
      </p>
    );
  }

  return (
    <div className="space-y-3 pt-3 border-t border-brand-secondary/25">
      <TemplateSelect
        label="email"
        templates={templates}
        value={templateId}
        onChange={applyTemplate}
        prospect={prospect}
      />
      <div>
        <label className={`block ${ui.label} mb-1 normal-case tracking-normal`}>
          Subject
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className={ui.inputSurface}
        />
      </div>
      <div>
        <label className={`block ${ui.label} mb-1 normal-case tracking-normal`}>
          Message
        </label>
        <textarea
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className={`${ui.inputSurface} resize-y`}
          placeholder={`Variables: ${TEMPLATE_VARIABLES}`}
        />
      </div>
      <SendButton
        sending={sending}
        onClick={() =>
          onSend({
            channel: "email",
            templateId: templateId || undefined,
            subject,
            message,
          })
        }
        disabled={!subject.trim() || !message.trim()}
      />
    </div>
  );
}

function LinkedInComposer({
  prospect,
  campaign,
  templates,
  communications,
  onSend,
  sending,
}) {
  const [templateId, setTemplateId] = useState("");
  const [message, setMessage] = useState("");

  const linkedinState = useMemo(
    () => getLinkedInCopilotUiState(communications),
    [communications]
  );

  const connectionTemplates = templates.filter(
    (t) => t.cta === "connect_linkedin"
  );
  const messageTemplates = templates.filter((t) => t.cta !== "connect_linkedin");

  const applyTemplate = (id, forConnection) => {
    setTemplateId(id);
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) {
      setMessage("");
      return;
    }
    setMessage(applyTemplateVariables(tpl.body, { prospect, campaign }));
  };

  if (!prospect.linkedinUrl?.trim()) {
    return (
      <p className="text-xs text-brand-stone py-2">
        This contact has no LinkedIn profile URL.
      </p>
    );
  }

  if (linkedinState.connectionPending) {
    return (
      <div className="pt-3 border-t border-brand-secondary/25">
        <p className="text-xs text-brand-stone">
          LinkedIn connection request pending — wait for acceptance before sending a
          message.
        </p>
      </div>
    );
  }

  if (linkedinState.canSendConnection) {
    return (
      <div className="space-y-3 pt-3 border-t border-brand-secondary/25">
        <p className="text-xs text-brand-stone">
          Send a connection request first. Note max{" "}
          {LINKEDIN_CONNECTION_NOTE_MAX_CHARS} characters.
        </p>
        <TemplateSelect
          label="LinkedIn connection"
          templates={connectionTemplates}
          value={templateId}
          onChange={(id) => applyTemplate(id, true)}
          prospect={prospect}
        />
        <div>
          <label className={`block ${ui.label} mb-1 normal-case tracking-normal`}>
            Connection note (optional)
          </label>
          <textarea
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={LINKEDIN_CONNECTION_NOTE_MAX_CHARS}
            className={`${ui.inputSurface} resize-y`}
          />
          <p className="text-xs text-brand-steel mt-1 text-right tabular-nums">
            {message.length}/{LINKEDIN_CONNECTION_NOTE_MAX_CHARS}
          </p>
        </div>
        <SendButton
          label="Send connection request"
          sending={sending}
          onClick={() =>
            onSend({
              channel: "linkedin",
              action: "connection_request",
              templateId: templateId || undefined,
              message,
            })
          }
        />
      </div>
    );
  }

  if (linkedinState.canSendMessage) {
    return (
      <div className="space-y-3 pt-3 border-t border-brand-secondary/25">
        <p className="text-xs text-brand-ink">
          Connection accepted — you can send a LinkedIn message.
        </p>
        <TemplateSelect
          label="LinkedIn"
          templates={messageTemplates}
          value={templateId}
          onChange={(id) => applyTemplate(id, false)}
          prospect={prospect}
        />
        <div>
          <label className={`block ${ui.label} mb-1 normal-case tracking-normal`}>
            Message
          </label>
          <textarea
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className={`${ui.inputSurface} resize-y`}
          />
        </div>
        <SendButton
          label="Send LinkedIn message"
          sending={sending}
          onClick={() =>
            onSend({
              channel: "linkedin",
              action: "message",
              templateId: templateId || undefined,
              message,
            })
          }
          disabled={!message.trim()}
        />
      </div>
    );
  }

  return null;
}

function formatWindowExpiry(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function WhatsAppComposer({ prospect, templates, communications, onSend, sending }) {
  const windowState = useMemo(
    () => getWhatsAppCopilotUiState(prospect, communications),
    [prospect, communications]
  );
  const [sendMode, setSendMode] = useState(
    windowState.windowOpen ? "freeform" : "template"
  );
  const [templateId, setTemplateId] = useState("");
  const [message, setMessage] = useState("");

  if (!prospect.whatsapp?.trim()) {
    return (
      <p className="text-xs text-brand-stone py-2">
        This contact has no WhatsApp number.
      </p>
    );
  }

  if (windowState.windowOpen) {
    return (
      <div className="space-y-3 pt-3 border-t border-brand-secondary/25">
        <div className="rounded-md bg-brand-sage/15 border border-brand-sage/30 px-3 py-2">
          <p className="text-xs font-medium text-brand-ink">
            24-hour window for free messages available
          </p>
          {windowState.expiresAt && (
            <p className="text-xs text-brand-stone mt-0.5">
              Until {formatWindowExpiry(windowState.expiresAt)}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSendMode("freeform")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
              sendMode === "freeform"
                ? "border-brand-sage bg-brand-sage/20 text-brand-ink"
                : "border-brand-secondary/40 text-brand-stone hover:text-brand-ink"
            }`}
          >
            Free message (recommended)
          </button>
          <button
            type="button"
            onClick={() => setSendMode("template")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
              sendMode === "template"
                ? "border-brand-sage bg-brand-sage/20 text-brand-ink"
                : "border-brand-secondary/40 text-brand-stone hover:text-brand-ink"
            }`}
          >
            Template
          </button>
        </div>

        {sendMode === "freeform" ? (
          <>
            <div>
              <label className={`block ${ui.label} mb-1 normal-case tracking-normal`}>
                Message
              </label>
              <textarea
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className={`${ui.inputSurface} resize-y`}
                placeholder="Write any message — no template approval needed during this window"
              />
            </div>
            <SendButton
              label="Send WhatsApp message"
              sending={sending}
              onClick={() =>
                onSend({
                  channel: "whatsapp",
                  sendMode: "freeform",
                  message,
                })
              }
              disabled={!message.trim()}
            />
          </>
        ) : (
          <>
            {!templates.length ? (
              <p className="text-xs text-brand-stone">
                No WhatsApp templates on this campaign — add them in Settings.
              </p>
            ) : (
              <>
                <div>
                  <label className={`block ${ui.label} mb-1 normal-case tracking-normal`}>
                    WhatsApp template
                  </label>
                  <select
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                    className={ui.inputSurface}
                  >
                    <option value="">Select template…</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        S{t.stage} — {t.whatsappTemplateId}
                      </option>
                    ))}
                  </select>
                </div>
                <SendButton
                  label="Send WhatsApp template"
                  sending={sending}
                  onClick={() =>
                    onSend({
                      channel: "whatsapp",
                      sendMode: "template",
                      templateId,
                    })
                  }
                  disabled={!templateId}
                />
              </>
            )}
          </>
        )}
      </div>
    );
  }

  if (!templates.length) {
    return (
      <div className="space-y-3 pt-3 border-t border-brand-secondary/25">
        <p className="text-xs text-brand-stone">
          No WhatsApp templates on this campaign — add them in Settings. Free-form
          messages require the contact to message you first (24-hour window).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-3 border-t border-brand-secondary/25">
      <p className="text-xs text-brand-stone">
        Outside the 24-hour window — only approved templates can be sent until the
        contact replies on WhatsApp.
      </p>
      <div>
        <label className={`block ${ui.label} mb-1 normal-case tracking-normal`}>
          WhatsApp template
        </label>
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className={ui.inputSurface}
        >
          <option value="">Select template…</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              S{t.stage} — {t.whatsappTemplateId}
            </option>
          ))}
        </select>
      </div>
      <SendButton
        label="Send WhatsApp template"
        sending={sending}
        onClick={() =>
          onSend({
            channel: "whatsapp",
            sendMode: "template",
            templateId,
          })
        }
        disabled={!templateId}
      />
    </div>
  );
}

function SendButton({ onClick, sending, disabled, label = "Send" }) {
  return (
    <button
      type="button"
      disabled={sending || disabled}
      onClick={onClick}
      className={`${ui.btnPrimary} w-full sm:w-auto disabled:opacity-50`}
    >
      <HiOutlinePaperAirplane className="h-4 w-4" />
      {sending ? "Sending…" : label}
    </button>
  );
}

export default function ContactCopilotComposer({
  channel,
  channelEnabled = true,
  prospect,
  campaign,
  templates,
  communications,
  campaignId,
  campaignContactId,
  onSent,
}) {
  const [sending, setSending] = useState(false);

  const channelTemplates = useMemo(
    () => templates.filter((t) => t.channel === channel),
    [templates, channel]
  );

  if (!channelEnabled) {
    return (
      <div className="pt-3 border-t border-brand-secondary/25 mt-3">
        <p className="text-xs text-brand-stone">
          {CHANNEL_LABELS[channel]} is not enabled for this campaign. Turn it on
          in campaign Settings → Outreach channels.
        </p>
      </div>
    );
  }

  const handleSend = async (payload) => {
    setSending(true);
    try {
      const res = await fetch(
        `/api/campaigns/${campaignId}/contact-campaigns/${campaignContactId}/send`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");

      if (data.skipped) {
        toast.warning(data.error || "Send skipped — check integrations");
      } else if (data.success) {
        toast.success(data.deliveryMessage || "Message sent");
      } else {
        toast.error(data.error || "Send failed");
      }

      if (data.campaign) {
        onSent?.(data.campaign);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  if (channel === "email") {
    return (
      <EmailComposer
        prospect={prospect}
        campaign={campaign}
        templates={channelTemplates}
        onSend={handleSend}
        sending={sending}
      />
    );
  }

  if (channel === "linkedin") {
    return (
      <LinkedInComposer
        prospect={prospect}
        campaign={campaign}
        templates={channelTemplates}
        communications={communications}
        onSend={handleSend}
        sending={sending}
      />
    );
  }

  return (
    <WhatsAppComposer
      prospect={prospect}
      templates={channelTemplates}
      communications={communications}
      onSend={handleSend}
      sending={sending}
    />
  );
}
