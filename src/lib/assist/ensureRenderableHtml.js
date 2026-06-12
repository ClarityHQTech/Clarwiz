/**
 * Normalize stored collateral HTML so email attachments and downloads open as
 * rendered pages in a browser — not as visible source / escaped markup.
 */

function decodeBasicHtmlEntities(text) {
  return String(text)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function looksEntityEscapedHtml(text) {
  return /&lt;(!DOCTYPE|html|head|body|main|div|p|h1)\b/i.test(text) && !/<(!DOCTYPE|html|head|body|main|div|p|h1)\b/i.test(text);
}

/**
 * Coerce arbitrary stored HTML into a complete, browser-renderable document.
 */
export function ensureRenderableHtmlDocument(html) {
  let s = String(html ?? "").trim();
  if (!s) return "";

  if (s.startsWith('"') && s.endsWith('"')) {
    try {
      const parsed = JSON.parse(s);
      if (typeof parsed === "string") s = parsed.trim();
    } catch {
      /* keep original */
    }
  }

  if (looksEntityEscapedHtml(s)) {
    s = decodeBasicHtmlEntities(s).trim();
  }

  if (/<!DOCTYPE\s+html/i.test(s) || /<html[\s>]/i.test(s)) {
    return s;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Collateral</title>
</head>
<body>
${s}
</body>
</html>`;
}

/** Body markup only — for inlining collateral below an email (not as a file). */
export function extractHtmlBodyForEmbed(html) {
  const rendered = ensureRenderableHtmlDocument(html);
  const match = rendered.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (match) return match[1].trim();
  return rendered;
}

/** RFC 2045 — fold base64 bodies to 76-character lines for MIME attachments. */
export function foldBase64(b64) {
  const lines = [];
  for (let i = 0; i < b64.length; i += 76) {
    lines.push(b64.slice(i, i + 76));
  }
  return lines.join("\r\n");
}
