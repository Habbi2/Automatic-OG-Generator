"use client";
import React, { useEffect, useRef } from 'react';

interface Props { text: string; enabled: boolean; }

export default function AutoFitTitleClient({ text, enabled }: Props) {
  const ref = useRef<HTMLHeadingElement|null>(null);
  useEffect(() => {
    if (!enabled || !ref.current) return;
    const el = ref.current;
    const maxLines = 2;
    let size = 64;
    const min = 32;
    const lh = 1.05;
    el.style.fontSize = size + 'px';
    el.style.lineHeight = lh.toString();
    for (let i=0;i<40;i++) {
      const rect = el.getBoundingClientRect();
      const lineHeight = size * lh;
      const lines = rect.height / lineHeight;
      if (lines <= maxLines) break;
      size -= 2;
      if (size < min) break;
      el.style.fontSize = size + 'px';
    }
  }, [text, enabled]);
  return <h1 ref={ref}>{text}</h1>;
}
