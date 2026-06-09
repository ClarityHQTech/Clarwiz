"use client";

import { ui } from "@/lib/brandUi";

export function AssistPanel({ title, count, action, children, className = "", bodyClassName = "" }) {
  return (
    <section className={`${ui.cardSurface} ${className}`}>
      {(title || action) && (
        <div className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 ${ui.tableToolbar}`}>
          {title ? (
            <h2 className={`${ui.titleSm} text-base`}>
              {title}
              {count != null ? (
                <span className="ml-2 text-sm font-sans font-normal text-brand-stone">({count})</span>
              ) : null}
            </h2>
          ) : (
            <span />
          )}
          {action}
        </div>
      )}
      {bodyClassName ? <div className={bodyClassName}>{children}</div> : children}
    </section>
  );
}

export function AssistEmpty({ children }) {
  return (
    <p className="px-4 py-8 text-center text-sm text-brand-stone">
      {children || "Nothing to show yet."}
    </p>
  );
}
