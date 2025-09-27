'use client';
import React, { useState } from 'react';

export default function CaptureClient() {
  const [url, setUrl] = useState('https://example.com');
  const [w, setW] = useState(1200);
  const [h, setH] = useState(630);
  const [delay, setDelay] = useState(0);
  const [dark, setDark] = useState(false);
  const [useOverlay, setUseOverlay] = useState(false);
  const [title, setTitle] = useState('Your Feature Headline');
  const [subtitle, setSubtitle] = useState('Short supporting subtitle for context.');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [accent, setAccent] = useState('#6366f1,#8b5cf6');
  const [pad, setPad] = useState('40px 56px 40px 88px');
  const [noBorder, setNoBorder] = useState(false);
  const [noShadow, setNoShadow] = useState(false);
  const [autoSize, setAutoSize] = useState(true);
  const [hideDev, setHideDev] = useState(true);
  const [loading, setLoading] = useState(false);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true); setError(null);
    const qs = new URLSearchParams({ url, w: String(w), h: String(h) });
    if (delay) qs.set('delay', String(delay));
    if (dark) qs.set('dark', '1');
    if (useOverlay) {
      qs.set('overlay', '1');
      if (title) qs.set('title', title);
      if (subtitle) qs.set('subtitle', subtitle);
      if (theme === 'light') qs.set('theme', 'light');
      if (accent) qs.set('accent', accent);
      if (pad) qs.set('pad', pad);
      if (noBorder) qs.set('noborder','1');
      if (noShadow) qs.set('noshadow','1');
      if (autoSize) qs.set('autosize','1');
      if (hideDev) qs.set('hidedev','1');
    }
    const full = `/api/capture?${qs.toString()}&bust=${Date.now()}`;
    try {
      const res = await fetch(full);
      if (!res.ok) {
        let text: string | undefined;
        let j: any = null;
        try { j = await res.json(); } catch { try { text = await res.text(); } catch {} }
        const msg = (j && (j.error || j.message)) || text || res.statusText;
        throw new Error(msg || 'Request failed');
      }
      const blob = await res.blob();
      setImgUrl(URL.createObjectURL(blob));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="stack">
      <form onSubmit={e => { e.preventDefault(); run(); }} className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6 items-end" id="panel" style={{ background:'var(--color-surface)', border:'1px solid var(--color-border)', boxShadow:'var(--shadow-sm)' }}>
        <div className="sm:col-span-3 lg:col-span-3">
          <label className="block text-xs uppercase tracking-wide mb-1">URL</label>
          <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..." required />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide mb-1">Width</label>
          <input type="number" value={w} onChange={e=>setW(Number(e.target.value))} min={400} max={2000} />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide mb-1">Height</label>
          <input type="number" value={h} onChange={e=>setH(Number(e.target.value))} min={200} max={1200} />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide mb-1">Delay (ms)</label>
          <input type="number" value={delay} onChange={e=>setDelay(Number(e.target.value))} min={0} max={5000} />
        </div>
        <div className="flex items-center gap-2">
            <input id="overlay" type="checkbox" checked={useOverlay} onChange={e=>setUseOverlay(e.target.checked)} />
            <label htmlFor="overlay" className="text-sm">Overlay</label>
        </div>
        {useOverlay && (
          <>
            <div className="sm:col-span-3 lg:col-span-3">
              <label className="block text-xs uppercase tracking-wide mb-1">Title</label>
              <input value={title} onChange={e=>setTitle(e.target.value)} maxLength={300} />
            </div>
            <div className="sm:col-span-3 lg:col-span-3">
              <label className="block text-xs uppercase tracking-wide mb-1">Subtitle</label>
              <input value={subtitle} onChange={e=>setSubtitle(e.target.value)} maxLength={300} />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide mb-1">Theme</label>
              <select value={theme} onChange={e=>setTheme(e.target.value as any)}>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </div>
            <div className="sm:col-span-3 lg:col-span-2">
              <label className="block text-xs uppercase tracking-wide mb-1">Accent Gradient</label>
              <input value={accent} onChange={e=>setAccent(e.target.value)} placeholder="#6366f1,#8b5cf6" />
              <p className="text-[10px] text-neutral-500 mt-1">Two comma-separated colors.</p>
            </div>
            <div className="sm:col-span-3 lg:col-span-2">
              <label className="block text-xs uppercase tracking-wide mb-1">Padding</label>
              <input value={pad} onChange={e=>setPad(e.target.value)} />
              <p className="text-[10px] text-neutral-500 mt-1">CSS shorthand or single number.</p>
            </div>
            <div className="flex items-center gap-2 mt-6">
              <input id="noborder" type="checkbox" checked={noBorder} onChange={e=>setNoBorder(e.target.checked)} />
              <label htmlFor="noborder" className="text-sm">No Border</label>
            </div>
            <div className="flex items-center gap-2 mt-6">
              <input id="noshadow" type="checkbox" checked={noShadow} onChange={e=>setNoShadow(e.target.checked)} />
              <label htmlFor="noshadow" className="text-sm">No Shadow</label>
            </div>
            <div className="flex items-center gap-2 mt-6">
              <input id="autosize" type="checkbox" checked={autoSize} onChange={e=>setAutoSize(e.target.checked)} />
              <label htmlFor="autosize" className="text-sm">Auto Size Title</label>
            </div>
          </>
        )}
        <div className="sm:col-span-3 lg:col-span-6 flex gap-3 pt-2">
          <button disabled={loading} className="btn">{loading ? 'Capturing...' : 'Capture'}</button>
          {imgUrl && <a download={useOverlay ? 'overlay.png' : 'capture.png'} href={imgUrl} className="btn btn-secondary">Download</a>}
        </div>
      </form>
      {error && <p className="text-sm" style={{ color:'var(--color-danger)' }}>{error}</p>}
      {imgUrl && (
        <div className="capture-preview">
          <p className="text-xs u-text-dim" style={{ marginBottom:'6px' }}>Preview</p>
          <img src={imgUrl} alt="Capture preview" />
        </div>
      )}
    </section>
  );
}
