"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
} from "@chakra-ui/react";
import AssistBadge from "../ui/AssistBadge";
import { AssistEmpty } from "../ui/AssistPanel";
import EmailModal from "./EmailModal";
import MeetingModal from "./MeetingModal";
import BriefModal from "./BriefModal";
import { classifyNbaAction } from "@/lib/assist/nbaActions";
import { ui } from "@/lib/brandUi";

function primaryLabel(kind, status) {
  if (status === "EXECUTED") {
    return kind === "meeting" ? "View meeting" : "View draft";
  }
  switch (kind) {
    case "meeting":
      return "Schedule meeting";
    case "task":
      return "Add task";
    case "collateral":
      return "Draft email";
    default:
      return "Execute";
  }
}

function statusBadge(status) {
  switch (status) {
    case "EXECUTED":
      return <AssistBadge variant="ok">Executed</AssistBadge>;
    case "DRAFTED":
    case "APPROVED":
      return <AssistBadge variant="info">Drafted</AssistBadge>;
    case "DISMISSED":
      return <AssistBadge variant="ghost">Dismissed</AssistBadge>;
    default:
      return <AssistBadge variant="accent">Suggested</AssistBadge>;
  }
}

function NbaList({ nbas, onOpenPrimary, onOpenBrief }) {
  if (!nbas?.length) {
    return <AssistEmpty>No recommendations yet.</AssistEmpty>;
  }

  return (
    <ul className="divide-y divide-brand-secondary/15">
      {nbas.map((nba) => {
        const { kind } = classifyNbaAction(nba);
        return (
          <li key={nba.id} className="px-4 py-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-brand-ink">
                  {nba.title || nba.actionType || "Recommended action"}
                </p>
                {nba.rationale ? (
                  <p className="text-xs text-brand-stone mt-1">{nba.rationale}</p>
                ) : null}
              </div>
              <div className="text-right shrink-0 space-y-1">
                {typeof nba.score === "number" ? (
                  <p className="text-sm font-semibold text-brand-terracotta tabular-nums">+{nba.score}</p>
                ) : null}
                {statusBadge(nba.status)}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={ui.btnPrimary} onClick={() => onOpenPrimary(nba)}>
                {primaryLabel(kind, nba.status)}
              </button>
              {kind === "meeting" ? (
                <button type="button" className={ui.btnSecondarySurface} onClick={() => onOpenBrief(nba)}>
                  Pre-meeting brief
                </button>
              ) : null}
              {nba.actionType ? (
                <span className="text-xs text-brand-stone self-center">{nba.actionType}</span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function NbaRail({ dealId, nbas, contacts = [], isOpen, onClose }) {
  const router = useRouter();
  const [emailNba, setEmailNba] = useState(null);
  const [meetingNba, setMeetingNba] = useState(null);
  const [briefNba, setBriefNba] = useState(null);

  const openPrimary = (nba) => {
    const { kind } = classifyNbaAction(nba);
    onClose?.();
    if (kind === "meeting") setMeetingNba(nba);
    else setEmailNba(nba);
  };

  const openBrief = (nba) => {
    onClose?.();
    setBriefNba(nba);
  };

  return (
    <>
      <Drawer placement="right" size="md" isOpen={isOpen} onClose={onClose}>
        <DrawerOverlay />
        <DrawerContent className="!max-w-[420px] !bg-brand-surface">
          <DrawerCloseButton />
          <DrawerHeader
            className={`${ui.titleSm} text-base !bg-brand-surface border-b border-brand-secondary/25`}
          >
            <span className="font-serif">Next best actions</span>
            {nbas?.length ? (
              <span className="ml-2 text-sm font-sans font-normal text-brand-stone">({nbas.length})</span>
            ) : null}
          </DrawerHeader>
          <DrawerBody className="!bg-brand-surface px-0 pb-6">
            <NbaList nbas={nbas} onOpenPrimary={openPrimary} onOpenBrief={openBrief} />
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      {emailNba ? (
        <EmailModal
          dealId={dealId}
          nba={emailNba}
          contacts={contacts}
          isOpen={!!emailNba}
          onClose={() => setEmailNba(null)}
          onExecuted={() => router.refresh()}
        />
      ) : null}

      {meetingNba ? (
        <MeetingModal
          dealId={dealId}
          nba={meetingNba}
          contacts={contacts}
          isOpen={!!meetingNba}
          onClose={() => setMeetingNba(null)}
          onScheduled={() => router.refresh()}
        />
      ) : null}

      {briefNba ? (
        <BriefModal
          dealId={dealId}
          nba={briefNba}
          isOpen={!!briefNba}
          onClose={() => setBriefNba(null)}
          onDraftFollowup={() => {
            const nba = briefNba;
            setBriefNba(null);
            setEmailNba(nba);
          }}
        />
      ) : null}
    </>
  );
}
