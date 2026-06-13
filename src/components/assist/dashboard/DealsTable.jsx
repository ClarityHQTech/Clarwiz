"use client";

import { useRouter } from "next/navigation";
import AssistBadge from "../ui/AssistBadge";
import { fmtAmount, fmtStaleness } from "../format";
import { ui } from "@/lib/brandUi";

function scoreVariant(score) {
  if (score == null) return "ghost";
  if (score >= 70) return "ok";
  if (score >= 40) return "warn";
  return "danger";
}

export default function DealsTable({ deals = [] }) {
  const router = useRouter();

  if (!deals.length) {
    return (
      <div className={`${ui.cardSurface} px-4 py-10 text-center`}>
        <p className="text-sm text-brand-stone">No open deals right now.</p>
      </div>
    );
  }

  return (
    <div className={ui.tableWrap}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className={ui.tableHead}>
              <th className={ui.tableHeadCell}>Deal</th>
              <th className={ui.tableHeadCell}>Company</th>
              <th className={`${ui.tableHeadCell} text-right`}>Contacts</th>
              <th className={ui.tableHeadCell}>Stage</th>
              <th className={`${ui.tableHeadCell} text-right`}>Amount</th>
              <th className={`${ui.tableHeadCell} text-right`}>Score</th>
              <th className={`${ui.tableHeadCell} text-right`}>NBAs executed</th>
              <th className={`${ui.tableHeadCell} text-right`}>Last activity</th>
            </tr>
          </thead>
          <tbody className={ui.divider}>
            {deals.map((deal) => (
              <tr
                key={deal.id}
                className={ui.tableRowHover}
                onClick={() => router.push(`/assist/deal/${deal.id}`)}
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-brand-ink truncate">{deal.name}</p>
                </td>
                <td className="px-4 py-3 text-brand-stone truncate">{deal.company || "—"}</td>
                <td className={`${ui.tableCellMetric} text-brand-stone`}>{deal.contactCount}</td>
                <td className="px-4 py-3 text-brand-stone truncate">{deal.stageLabel || "—"}</td>
                <td className={`${ui.tableCellMetric} font-medium`}>{fmtAmount(deal.amount)}</td>
                <td className={`${ui.tableCellMetric} text-right`}>
                  {deal.score == null ? (
                    <span className="text-brand-stone">—</span>
                  ) : (
                    <AssistBadge variant={scoreVariant(deal.score)}>{deal.score}</AssistBadge>
                  )}
                </td>
                <td className={`${ui.tableCellMetric} text-brand-stone`}>{deal.executedNbaCount}</td>
                <td className={`${ui.tableCellMetric} text-brand-stone`}>
                  {fmtStaleness(deal.lastActivityAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
