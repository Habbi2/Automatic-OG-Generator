import React from 'react';
import AutoFitTitleClient from '../../src/overlay/AutoFitTitleClient';

// /overlay?url=https://...&title=...&subtitle=...&theme=dark|light&w=1200&h=630
// Rendered server-side then hydrated very lightly (no heavy client code). The capture API will screenshot this page.

function sanitize(str: string | null): string {
  if (!str) return '';
    return str ?? '';
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default function OverlayPage({ searchParams }: { searchParams: Record<string,string|undefined> }) {
  const url = searchParams.url || 'about:blank';
  const mode = searchParams.mode === 'static' ? 'static' : 'live';
  const titleRaw = searchParams.title || 'Preview Title';
  const subtitleRaw = searchParams.subtitle || 'Optional subtitle describing the capture.';
  const theme = (searchParams.theme === 'light') ? 'light' : 'dark';
  const w = Number(searchParams.w || 1200);
  const h = Number(searchParams.h || 630);
  const accent = (searchParams.accent || '#6366f1,#8b5cf6').split(',').slice(0,2);
  const pad = clampPad(searchParams.pad);
  const noBorder = searchParams.noborder === '1';
  const noShadow = searchParams.noshadow === '1';
  const autoSize = searchParams.autosize === '1';
  // Hide dev overlays by default; pass hidedev=0 to show them intentionally
  const hideDev = searchParams.hidedev !== '0';
  const inject = (searchParams.inject || '').slice(0, 2000); // limit size
  const hideSelectors = (searchParams.hide || '').split(',').map(s=>s.trim()).filter(Boolean).slice(0,15);

  const title = autoSize ? autoClampTitle(titleRaw) : sanitize(titleRaw);
  const subtitle = sanitize(subtitleRaw);

  // Return a single root div (avoid nested <html>/<head>/<body> which caused hydration + capture issues)
  return (
    <div className="overlay-root" style={{ width: w, height: h }} suppressHydrationWarning>
      <style id="__overlay_base" suppressHydrationWarning>{baseCss(theme, hideDev)}</style>
      { (inject || hideSelectors.length > 0) ? (
        <style id="__custom_inject" suppressHydrationWarning>{buildInjectedCss(inject, hideSelectors)}</style>
      ) : null }
      <div className="root wide" style={{ padding: pad }}>
        <div className="left-bar" style={{ background: `linear-gradient(180deg, ${accent[0]}, ${accent[1] || accent[0]})` }} />
        <div className="content-row">
          <div className="panel text">
            <AutoFitTitleClient text={title} enabled={autoSize} />
            {subtitle && <p className="subtitle">{subtitle}</p>}
          </div>
          <div className="panel shot">
            <div className="shot-mask" style={{ border: noBorder ? '0' : undefined, boxShadow: noShadow ? 'none' : undefined }}>
              {mode === 'static' && url.startsWith('data:image') ? (
                <img src={url} alt="capture" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
              ) : (
                <>
                  <iframe src={url} title="target" loading="eager" data-autoscale="1" />
                  <script
                    // eslint-disable-next-line react/no-danger
                    dangerouslySetInnerHTML={{ __html: `(()=>{try{const f=document.querySelector('.shot-mask iframe[data-autoscale]');if(!f) return;const cont=f.parentElement;const BASE=390;function scale(){if(!cont) return;const avail=cont.clientWidth; if(!avail) return; const s=avail/BASE; f.style.width=BASE+'px'; f.style.height='100%'; f.style.transform='scale('+s+')'; f.style.transformOrigin='top left'; cont.style.overflow='hidden';}scale();window.addEventListener('resize',scale,{passive:true});f.addEventListener('load',scale);}catch(e){console&&console.warn('iframe autoscale failed',e);}})();` }}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function buildInjectedCss(inject:string, hideSelectors:string[]) {
  let css = '';
  if (hideSelectors.length) {
    const safe = hideSelectors.filter(sel => sel.length < 80 && /^[#.\w\-\[\]\=\s:>+~*]+$/.test(sel));
    if (safe.length) css += safe.join(',') + '{display:none !important;}';
  }
  if (inject) {
    // very light sanitization: disallow @import
    if (!/@import/i.test(inject)) css += '\n' + inject;
  }
  return css;
}

// AutoFitTitleClient imported at top; remains a small client component.

function clampPad(raw: string | undefined) {
  if (!raw) return '40px 56px 40px 88px';
  // Accept single number (uniform) or css shorthand (limit length)
  if (/^\d{1,3}$/.test(raw)) {
    const v = Math.min(160, Math.max(0, parseInt(raw,10)));
    return `${v}px`;
  }
  if (/^[0-9px %.-]{1,60}$/i.test(raw)) return raw;
  return '40px 56px 40px 88px';
}

function autoClampTitle(t: string) {
  // Rough heuristic: reduce font size if length exceeds thresholds
  const base = t.trim();
  const len = base.length;
  if (len < 38) return base; // keep original size via CSS default
  // Inject markers for CSS variable override via inline style? Simpler: shrink words by inserting \u2009 (thin space) not needed.
  // We'll just truncate for now to 140 chars and rely on wrapping.
  return base.slice(0,140);
}

function baseCss(theme: 'dark'|'light', hideDev:boolean) {
  const fg = theme==='dark' ? '#ffffff' : '#0f172a';
  const sub = theme==='dark' ? '#cbd5e1' : '#475569';
  const gradStart = theme==='dark' ? '#0f0f14' : '#f8fafc';
  const gradEnd = theme==='dark' ? '#1e1b2e' : '#e0e7ff';
  const cardBg = theme==='dark' ? '#10151c' : '#ffffff';
  const cardBorder = theme==='dark' ? '#1f2937' : '#e2e8f0';
  return `
    * { box-sizing: border-box; }
    .overlay-root { position:relative; margin:0; padding:0; font-family: 'Inter', 'Segoe UI', system-ui, sans-serif; width:100%; height:100%; background: linear-gradient(135deg, ${gradStart}, ${gradEnd}); color:${fg}; display:flex; font-size:16px; }
  ${hideDev ? `
  /* Hide Next.js / React error overlays & toasts in dev */
  #__next-build-watcher, #__next-build-error, #__next-route-announcer, [class*='nextjs-'], [data-nextjs-toast], [data-nextjs-error-overlay-root] { display:none !important; visibility:hidden !important; opacity:0 !important; }
  ` : ''}
    .root { position:relative; flex:1; display:flex; padding:42px clamp(40px,5vw,72px) 40px clamp(78px,6vw,112px); }
    .left-bar { position:absolute; inset:0 auto 0 0; width:12px; background:linear-gradient(180deg,#6366f1,#8b5cf6); border-radius:0 6px 6px 0; box-shadow:0 0 0 1px rgba(255,255,255,0.06),0 0 24px -4px rgba(99,102,241,0.55); }
    .content-row { flex:1; display:flex; gap:clamp(32px,4vw,64px); align-items:stretch; }
    .panel { display:flex; flex-direction:column; justify-content:center; min-width:0; }
    .panel.text { flex:0 0 36%; max-width:560px; }
    h1 { margin:0 0 18px 0; font-size:clamp(40px,5.6vw,64px); line-height:1.05; font-weight:600; letter-spacing:-1.4px; text-wrap:balance; }
    .subtitle { margin:0; font-size:clamp(20px,2vw,30px); line-height:1.25; color:${sub}; font-weight:450; }
    .panel.shot { flex:1; display:flex; }
  .shot-mask { position:relative; flex:1; background:${cardBg}; border:2px solid ${cardBorder}; border-radius:30px; overflow:hidden; box-shadow:0 8px 38px -8px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,${theme==='dark'?0.04:0.6}); display:flex; align-items:stretch; justify-content:flex-start; }
    .shot-mask::after { content:''; position:absolute; inset:0; pointer-events:none; background:linear-gradient(145deg, rgba(255,255,255,${theme==='dark'?0.02:0.35}) 0%, rgba(255,255,255,0) 55%); mix-blend-mode:${theme==='dark'?'overlay':'normal'}; }
    iframe, .shot-mask > img { flex:1; width:100%; height:100%; border:0; background:#000; display:block; }
    @media (max-width:1200px) { .panel.text { flex:0 0 42%; } }
    @media (max-width:1000px) { .root { padding:36px 48px 36px 84px; } h1 { font-size:clamp(36px,6.2vw,56px); } .content-row { gap:40px; } }
    @media (max-width:820px) { .content-row { flex-direction:column; } .panel.text { flex:0 0 auto; max-width:100%; } .panel.shot { min-height:320px; } .root { padding:40px 48px 48px 72px; } }
  `;
}
