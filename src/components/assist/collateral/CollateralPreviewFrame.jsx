"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { injectEmbedPreviewStyles } from "@/lib/assist/richCollateral/embedPreviewStyles";

function withEmbedParam(src) {
  if (!src || src.startsWith("blob:")) return src;
  const url = new URL(src, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  url.searchParams.set("embed", "1");
  return `${url.pathname}${url.search}`;
}

function measureIframe(iframe) {
  const doc = iframe?.contentDocument;
  if (!doc) return null;
  const w = Math.max(
    doc.documentElement?.scrollWidth ?? 0,
    doc.body?.scrollWidth ?? 0,
    doc.documentElement?.clientWidth ?? 0,
    720,
  );
  const h = Math.max(
    doc.documentElement?.scrollHeight ?? 0,
    doc.body?.scrollHeight ?? 0,
    doc.documentElement?.clientHeight ?? 0,
    480,
  );
  return { width: w, height: h };
}

/**
 * Scrollable collateral preview — auto-sizes to full document dimensions.
 * Pass `src` (API URL) or `srcDoc` (inline HTML).
 */
export default function CollateralPreviewFrame({
  src,
  srcDoc,
  title = "Collateral preview",
  className = "",
  onLoad,
}) {
  const iframeRef = useRef(null);
  const [size, setSize] = useState(null);

  const resize = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const measured = measureIframe(iframe);
    if (measured) setSize(measured);
  }, []);

  useEffect(() => {
    setSize(null);
  }, [src, srcDoc]);

  useEffect(() => {
    if (!srcDoc) return;
    const onResize = () => resize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [srcDoc, resize]);

  const handleLoad = useCallback(() => {
    resize();
    onLoad?.();
    // Fonts/layout may settle after first paint
    requestAnimationFrame(() => resize());
    setTimeout(() => resize(), 120);
  }, [resize, onLoad]);

  const resolvedSrc = src ? withEmbedParam(src) : undefined;
  const resolvedSrcDoc = srcDoc ? injectEmbedPreviewStyles(srcDoc) : undefined;

  return (
    <div className={`overflow-auto min-h-0 flex-1 bg-[#E9E2D2] ${className}`}>
      <iframe
        ref={iframeRef}
        src={resolvedSrc}
        srcDoc={resolvedSrcDoc}
        title={title}
        sandbox="allow-same-origin"
        onLoad={handleLoad}
        className="block border-0 bg-[#E9E2D2]"
        style={
          size
            ? { width: size.width, height: size.height, minWidth: "100%" }
            : { width: "100%", height: "100%", minHeight: 480 }
        }
      />
    </div>
  );
}
