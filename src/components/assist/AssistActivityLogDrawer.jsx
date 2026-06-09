"use client";

import {
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
} from "@chakra-ui/react";
import { ui } from "@/lib/brandUi";
import { actionLabel, actionDot } from "@/components/assist/dashboard/ActivityFeed";

function dayKey(d) {
  const date = new Date(d);
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function timeOf(d) {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function isToday(d) {
  const date = new Date(d);
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

function groupByDay(actions) {
  const groups = [];
  const index = new Map();
  for (const a of actions) {
    const key = dayKey(a.createdAt);
    if (!index.has(key)) {
      const g = { key, label: (isToday(a.createdAt) ? "Today · " : "") + key, rows: [] };
      index.set(key, g);
      groups.push(g);
    }
    index.get(key).rows.push(a);
  }
  return groups;
}

const DOT_STYLES = {
  ok: "bg-brand-sage",
  info: "bg-brand-terracotta/70",
  accent: "bg-brand-gold",
  "": "bg-brand-steel",
};

function LogRow({ action }) {
  const dot = actionDot(action.action);
  return (
    <div className="flex gap-3 py-2.5 border-b border-brand-secondary/15 last:border-0">
      <time className="text-xs text-brand-steel tabular-nums w-12 shrink-0 pt-0.5">
        {timeOf(action.createdAt)}
      </time>
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT_STYLES[dot] ?? DOT_STYLES[""]}`} />
      <p className="text-sm text-brand-ink min-w-0">
        <span className="font-medium">{actionLabel(action.action)}</span>
        {action.entityType ? (
          <span className="text-brand-stone">
            {" on "}
            <em className="not-italic">
              {action.entityType}
              {action.hsObjectId ? ` · ${action.hsObjectId}` : ""}
            </em>
          </span>
        ) : action.hsObjectId ? (
          <span className="text-brand-stone"> · {action.hsObjectId}</span>
        ) : null}
      </p>
    </div>
  );
}

export default function AssistActivityLogDrawer({ isOpen, onClose, actions = [] }) {
  const groups = groupByDay(actions);

  return (
    <Drawer placement="right" size="md" isOpen={isOpen} onClose={onClose}>
      <DrawerOverlay />
      <DrawerContent className="!max-w-[560px] !bg-brand-surface">
        <DrawerCloseButton />
        <DrawerHeader className={`${ui.titleSm} text-base !bg-brand-surface border-b border-brand-secondary/25`}>
          Activity log
          <p className="text-xs font-normal text-brand-stone mt-1 font-sans">
            NBA executions, tasks, notes, and insights — ids only, no PII
          </p>
        </DrawerHeader>
        <DrawerBody className="px-4 py-4 !bg-brand-surface">
          {actions.length === 0 ? (
            <p className={`${ui.body} py-8 text-center`}>
              No activity yet. Actions you take across AE Assist show up here.
            </p>
          ) : (
            <div className="space-y-4">
              {groups.map((g) => (
                <section key={g.key}>
                  <h3 className={`${ui.label} mb-2 normal-case tracking-wide`}>{g.label}</h3>
                  <div className={ui.cardMuted}>
                    <div className="px-3">
                      {g.rows.map((a) => (
                        <LogRow key={a.id} action={a} />
                      ))}
                    </div>
                  </div>
                </section>
              ))}
            </div>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
