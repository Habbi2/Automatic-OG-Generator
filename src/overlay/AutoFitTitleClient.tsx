"use client";
import React, { useEffect, useRef, useState } from 'react';

interface Props { text: string; enabled: boolean; }

export default function AutoFitTitleClient({ text, enabled }: Props) {
  const ref = useRef<HTMLHeadingElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;
    // Capture the original font size declared by CSS (fallback 64)
    const original = parseFloat(getComputedStyle(el).fontSize) || 64;

    function shrink() {
      if (!el) return;
      // Reset to original before measuring
      el.style.fontSize = original + 'px';
      const parent = el.parentElement;
      if (!parent) return;
      const maxWidth = parent.clientWidth;
      // Binary search to find largest size that keeps width & line constraints
      let lo = 24, hi = original, best = original;
      for (let i = 0; i < 12; i++) {
        const mid = (lo + hi) / 2;
        el.style.fontSize = mid + 'px';
        // Force reflow and measure
        const { scrollWidth, clientWidth, scrollHeight } = el;
        const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || (mid * 1.05);
        const lines = Math.round(scrollHeight / lineHeight);
        const fitsWidth = scrollWidth <= clientWidth + 1 && clientWidth <= maxWidth + 1;
        const fitsLines = lines <= 3; // allow up to 3 lines
        if (fitsWidth && fitsLines) {
          best = mid;
          lo = mid; // try a bit larger
        } else {
          hi = mid; // must go smaller
        }
      }
      el.style.fontSize = Math.max(24, Math.min(best, original)) + 'px';
    }

    shrink();
    setReady(true);

    const ro = new ResizeObserver(() => shrink());
    const parent = el.parentElement;
    if (parent) ro.observe(parent);
    return () => ro.disconnect();
  }, [text, enabled]);

  return <h1 ref={ref} style={{ opacity: ready || !enabled ? 1 : 0, transition: 'opacity .3s ease' }}>{text}</h1>;
}
