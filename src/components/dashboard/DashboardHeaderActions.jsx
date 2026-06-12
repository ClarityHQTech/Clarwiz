"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDisclosure } from "@chakra-ui/react";
import {
  HiOutlineArrowRight,
  HiOutlineBell,
  HiOutlineExclamationTriangle,
  HiOutlineInformationCircle,
  HiOutlineQuestionMarkCircle,
  HiOutlineSparkles,
} from "react-icons/hi2";
import HelpDrawer from "@/components/dashboard/HelpDrawer";
import { ui } from "@/lib/brandUi";

const SEEN_STORAGE_KEY = "dashboard-notifications-seen";

const ALERT_STYLES = {
  warning: {
    icon: HiOutlineExclamationTriangle,
    iconClass: "text-brand-terracotta",
    bg: "hover:bg-brand-terracotta/10",
  },
  info: {
    icon: HiOutlineInformationCircle,
    iconClass: "text-brand-sage",
    bg: "hover:bg-brand-sage/10",
  },
  signal: {
    icon: HiOutlineSparkles,
    iconClass: "text-brand-gold",
    bg: "hover:bg-brand-gold/10",
  },
};

function loadSeenIds(tenantId) {
  if (typeof window === "undefined" || !tenantId) return new Set();
  try {
    const raw = localStorage.getItem(SEEN_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    const ids = parsed?.[tenantId];
    return new Set(Array.isArray(ids) ? ids : []);
  } catch {
    return new Set();
  }
}

function saveSeenIds(tenantId, ids) {
  if (typeof window === "undefined" || !tenantId) return;
  try {
    const raw = localStorage.getItem(SEEN_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    parsed[tenantId] = [...ids];
    localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // ignore storage errors
  }
}

function NotificationItem({ alert, unread, onNavigate }) {
  const style = ALERT_STYLES[alert.type] ?? ALERT_STYLES.info;
  const Icon = style.icon;

  const content = (
    <>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-bg ${style.iconClass}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="text-sm font-medium text-brand-ink">{alert.title}</p>
          {unread ? (
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-500" aria-label="Unread" />
          ) : null}
        </div>
        <p className="text-xs text-brand-stone mt-0.5 line-clamp-2">{alert.message}</p>
        {alert.cta ? (
          <span className={`mt-1.5 inline-flex items-center gap-1 text-xs font-medium ${ui.link}`}>
            {alert.cta}
            <HiOutlineArrowRight className="h-3 w-3" />
          </span>
        ) : null}
      </div>
    </>
  );

  if (alert.href) {
    return (
      <Link
        href={alert.href}
        onClick={onNavigate}
        className={`flex gap-3 px-4 py-3 transition-colors ${style.bg}`}
      >
        {content}
      </Link>
    );
  }

  return <div className={`flex gap-3 px-4 py-3 ${style.bg}`}>{content}</div>;
}

function NotificationPanel({ open, panelRef, buttonRef, unreadCount, alerts, seenIds, onNavigate }) {
  const [panelStyle, setPanelStyle] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !buttonRef.current) {
      setPanelStyle(null);
      return undefined;
    }

    const updatePosition = () => {
      const rect = buttonRef.current.getBoundingClientRect();
      const width = Math.min(352, window.innerWidth - 32);
      const right = Math.max(16, window.innerWidth - rect.right);

      setPanelStyle({
        position: "fixed",
        top: rect.bottom + 8,
        right,
        width,
        zIndex: 200,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, buttonRef]);

  if (!open || !mounted || !panelStyle) return null;

  return createPortal(
    <div
      ref={panelRef}
      style={panelStyle}
      className="overflow-hidden rounded-xl border border-brand-secondary/30 bg-white shadow-lg shadow-brand-ink/10"
      role="dialog"
      aria-label="Notifications"
    >
      <div className="flex items-center justify-between border-b border-brand-secondary/25 px-4 py-3">
        <h2 className="text-sm font-semibold text-brand-ink">Notifications</h2>
        {unreadCount > 0 ? (
          <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600">
            {unreadCount} new
          </span>
        ) : null}
      </div>

      {alerts.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-brand-stone">
          You&apos;re all caught up — no notifications right now.
        </p>
      ) : (
        <div className="max-h-[min(24rem,60vh)] overflow-y-auto divide-y divide-brand-secondary/15">
          {alerts.map((alert) => (
            <NotificationItem
              key={alert.id}
              alert={alert}
              unread={!seenIds.has(alert.id)}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}

export default function DashboardHeaderActions({ alerts = [], tenantId }) {
  const help = useDisclosure();
  const [open, setOpen] = useState(false);
  const [seenIds, setSeenIds] = useState(() => new Set());
  const panelRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    setSeenIds(loadSeenIds(tenantId));
  }, [tenantId]);

  const alertIds = useMemo(() => alerts.map((a) => a.id), [alerts]);

  const unreadCount = useMemo(
    () => alerts.filter((a) => !seenIds.has(a.id)).length,
    [alerts, seenIds]
  );

  const markAllSeen = useCallback(() => {
    const next = new Set(alertIds);
    setSeenIds(next);
    saveSeenIds(tenantId, next);
  }, [alertIds, tenantId]);

  const handleOpen = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next) markAllSeen();
      return next;
    });
  };

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (e) => {
      if (
        panelRef.current?.contains(e.target) ||
        buttonRef.current?.contains(e.target)
      ) {
        return;
      }
      setOpen(false);
    };

    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const iconBtnClass =
    "relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-brand-secondary/30 bg-white text-brand-stone hover:bg-brand-bg hover:text-brand-ink transition-colors";

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={help.onOpen}
        className={iconBtnClass}
        aria-label="How Clarwiz works"
        title="How Clarwiz works"
      >
        <HiOutlineQuestionMarkCircle className="h-5 w-5" />
      </button>

      <HelpDrawer isOpen={help.isOpen} onClose={help.onClose} />

      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          onClick={handleOpen}
          className={iconBtnClass}
          aria-label="Notifications"
          aria-expanded={open}
          aria-haspopup="true"
          title="Notifications"
        >
          <HiOutlineBell className="h-5 w-5" />
          {unreadCount > 0 ? (
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
          ) : null}
        </button>

        <NotificationPanel
          open={open}
          panelRef={panelRef}
          buttonRef={buttonRef}
          unreadCount={unreadCount}
          alerts={alerts}
          seenIds={seenIds}
          onNavigate={() => setOpen(false)}
        />
      </div>
    </div>
  );
}
