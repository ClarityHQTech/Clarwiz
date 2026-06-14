"use client";

/** Render **bold**, bullets, and short sections for Cockpit assistant replies. */
function parseInline(text) {
  if (!text) return null;
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="ck-chat-strong">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

export default function CockpitMessageContent({ content }) {
  if (!content) return null;

  const lines = content.split("\n");
  const blocks = [];
  let listItems = [];

  const flushList = () => {
    if (!listItems.length) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="ck-chat-list">
        {listItems}
      </ul>
    );
    listItems = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (!trimmed) {
      flushList();
      continue;
    }

    const bullet = trimmed.match(/^[-•*]\s+(.+)/);
    if (bullet) {
      listItems.push(
        <li key={`li-${listItems.length}`}>{parseInline(bullet[1])}</li>
      );
      continue;
    }

    const numbered = trimmed.match(/^\d+[.)]\s+(.+)/);
    if (numbered) {
      listItems.push(
        <li key={`li-${listItems.length}`} className="ck-chat-list-num">
          {parseInline(numbered[1])}
        </li>
      );
      continue;
    }

    flushList();

    const heading = trimmed.match(/^#{1,3}\s+(.+)/);
    if (heading) {
      blocks.push(
        <p key={`h-${blocks.length}`} className="ck-chat-label">
          {parseInline(heading[1])}
        </p>
      );
      continue;
    }

    blocks.push(
      <p key={`p-${blocks.length}`} className="ck-chat-para">
        {parseInline(trimmed)}
      </p>
    );
  }

  flushList();

  return <div className="ck-chat-md">{blocks}</div>;
}
