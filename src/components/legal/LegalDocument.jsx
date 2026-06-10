import { ui } from "@/lib/brandUi";

export function LegalSection({ title, children }) {
  return (
    <section className="space-y-3">
      <h2 className="font-serif text-xl font-semibold text-brand-ink">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-brand-stone">{children}</div>
    </section>
  );
}

export default function LegalDocument({ title, lastUpdated, children }) {
  return (
    <main className={`${ui.page} text-brand-ink`}>
      <div className="max-w-3xl mx-auto px-6 py-16 lg:py-24">
        <header className="mb-12 border-b border-brand-secondary/25 pb-8">
          <h1 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight text-brand-ink">
            {title}
          </h1>
          <p className="mt-3 text-sm text-brand-steel">Last updated: {lastUpdated}</p>
        </header>
        <div className="space-y-10">{children}</div>
      </div>
    </main>
  );
}
