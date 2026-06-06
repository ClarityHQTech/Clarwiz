"use client";

// Editorial page header (Marketing360 pattern): eyebrow pill + serif title with an
// italic ember accent + subtitle. Render inside a .mofu wrapper (tokens cascade).
export default function PageHeader({ eyebrow = "MOFU", title, accent, subtitle, actions, crumb }) {
  return (
    <div className="page-head">
      <div>
        {crumb ? <div className="crumb" style={{ fontSize: 12, marginBottom: 4 }}>{crumb}</div> : eyebrow ? <span className="pill-eyebrow">{eyebrow}</span> : null}
        <div className="pt">{title}{accent ? <em className="accent-em"> {accent}</em> : null}</div>
        {subtitle ? <div className="ps">{subtitle}</div> : null}
      </div>
      {actions ? <><div className="spacer" />{actions}</> : null}
    </div>
  );
}
