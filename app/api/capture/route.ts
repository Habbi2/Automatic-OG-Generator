import { NextRequest } from 'next/server';
import chromium from '@sparticuz/chromium';
import puppeteerCore from 'puppeteer-core';
import { resolveExecutable, clampNum } from '../../../src/capture-util';
// Attempt to import full puppeteer (dev dependency) for local Windows fallback.
// We purposely type as any to pass through to shared resolver without pulling full PuppeteerNode types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let puppeteerFull: any | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  puppeteerFull = require('puppeteer');
} catch {}

// Basic param validation (lightweight; could switch to zod)
function bad(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: { 'Content-Type': 'application/json' }});
}

const HTTPS_RE = /^https:\/\//i;
const PRIVATE_IP_RE = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1]))/;
const ALLOW_RE = process.env.ALLOWED_HOST_PATTERN ? new RegExp(process.env.ALLOWED_HOST_PATTERN) : null;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const parsed = new URL(req.url);
  const searchParams = parsed.searchParams;
  const origin = parsed.origin;
  const url = searchParams.get('url') || '';
  if (!url) return bad('Missing url');
  if (!HTTPS_RE.test(url)) return bad('Only https URLs allowed');
  try {
    const host = new URL(url).hostname;
    if (PRIVATE_IP_RE.test(host)) return bad('Private / local hosts blocked');
    if (ALLOW_RE && !ALLOW_RE.test(host)) return bad('Host not allowed');
  } catch {
    return bad('Invalid URL');
  }
  const w = clampNum(searchParams.get('w'), 1200, 400, 2000);
  const h = clampNum(searchParams.get('h'), 630, 200, 1200);
  const delay = clampNum(searchParams.get('delay'), 0, 0, 5000);
  const wait = searchParams.get('wait') || 'auto'; // auto | dom | load | network | none
  const dark = searchParams.get('dark') === '1';
  const uaOverride = searchParams.get('ua') || undefined; // optional user agent override
  const exeOverride = searchParams.get('exe') || undefined; // optional manual override
  const debug = searchParams.get('debug') === '1';
  const engine = searchParams.get('engine'); // 'full' to force full puppeteer
  const overlay = searchParams.get('overlay') === '1';
  // Default to live mode; static must be explicitly requested with mode=static
  const modeParam = searchParams.get('mode');
  const mode = modeParam === 'static' ? 'static' : 'live';
  const title = searchParams.get('title') || '';
  const subtitle = searchParams.get('subtitle') || '';
  const theme = searchParams.get('theme') === 'light' ? 'light' : 'dark';
  const accent = searchParams.get('accent') || undefined;
  const pad = searchParams.get('pad') || undefined;
  const noborder = searchParams.get('noborder');
  const noshadow = searchParams.get('noshadow');
  const autosize = searchParams.get('autosize');
  const hideDevParam = searchParams.get('hidedev');
  const hideDev = hideDevParam === '0' ? '0' : '1';
  // New scaling/frame customization parameters (optional)
  const framew = searchParams.get('framew') || undefined; // desired final visual width of embedded page
  const iframebase = searchParams.get('iframebase') || undefined; // base logical width before scaling
  const iframefit = searchParams.get('iframefit') || undefined; // width|cover|none
  const iframealign = searchParams.get('iframealign') || undefined; // left|center
  const maxscale = searchParams.get('maxscale') || undefined; // clamp scale factor
  const keepwidth = searchParams.get('keepwidth') || undefined; // '1' preserves original mask width
  const scaleFlag = searchParams.get('scale') || undefined; // '0' disables scaling script
  const border = searchParams.get('border') || undefined; // '1' forces border (default now off)

  let browser;
  let phase: string = 'init';
  try {
  const { executablePath, usingFull, attempted } = await resolveExecutable({ override: exeOverride, forceFull: engine === 'full', puppeteerFull });
    if (debug) {
      return new Response(JSON.stringify({
        debug: true,
        executablePath,
        usingFull,
        attempted,
        env: process.env.CHROME_PATH || null,
        platform: process.platform,
        versions: { node: process.version }
      }, null, 2), { status: 200, headers: { 'Content-Type': 'application/json' }});
    }
    const baseArgs = [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--hide-scrollbars',
      '--disable-breakpad',
      '--disable-client-side-phishing-detection',
      '--disable-component-update',
      '--disable-default-apps',
      '--mute-audio'
    ];
    const launchArgs = usingFull ? baseArgs : [...chromium.args, ...baseArgs];
    const p = usingFull && puppeteerFull ? puppeteerFull : puppeteerCore;
    phase = 'launch';
    browser = await p.launch({
      args: launchArgs,
      defaultViewport: { width: w, height: h },
      executablePath: executablePath,
      headless: 'new'
    });
    phase = 'newPage';
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(15000);
    // Emulate dark mode if requested
    if (dark) {
      try { await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]); } catch {}
    }
    const start = Date.now();
    // Decide wait strategy
    let waitUntil: any = 'domcontentloaded';
    if (wait === 'load') waitUntil = 'load';
    else if (wait === 'network') waitUntil = 'networkidle2';
    else if (wait === 'none') waitUntil = undefined;

  // Decide which URL to actually load (overlay wrapper vs direct)
  let preCapturedDataUrl: string | null = null;
  if (overlay && mode === 'static') {
    // Pre-capture target site first, then embed base64 PNG as data URL in overlay to avoid any runtime dev overlays or animations.
    try {
      phase = 'static-newPage';
      const tmpPage = await browser.newPage();
      tmpPage.setDefaultNavigationTimeout(15000);
      // Use a stable desktop UA to reduce chance of bot/WAF variation & locale error pages
      const primaryUA = uaOverride || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36';
      try { await tmpPage.setUserAgent(primaryUA); } catch {}
      let waitUntil: any = 'domcontentloaded';
      if (wait === 'load') waitUntil = 'load'; else if (wait === 'network') waitUntil = 'networkidle2'; else if (wait === 'none') waitUntil = undefined;
      phase = 'static-goto';
      const respStatic = await tmpPage.goto(url, waitUntil ? { waitUntil } : {});
      const status = respStatic?.status() || 0;
      if (!respStatic || status >= 400) {
        // Retry logic for specific status like 431 (header too large or WAF block) with alternate UA & networkidle2 to let redirects settle
        if (status === 431 || status === 403) {
          try {
            phase = 'static-retry-alt-ua';
            const altUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edg/120.0.0.0 Chrome/120.0.0.0 Safari/537.36';
            await tmpPage.setUserAgent(uaOverride || altUA);
            const respRetry = await tmpPage.goto(url, { waitUntil: 'networkidle2', timeout: 18000 });
            const retryStatus = respRetry?.status() || 0;
            if (!respRetry || retryStatus >= 400) {
              throw new Error('static-pre-capture-status-' + status + '-retry-' + retryStatus);
            }
          } catch (rErr) {
            throw rErr;
          }
        } else {
          throw new Error('static-pre-capture-status-' + status);
        }
      }
      if (delay) { phase = 'static-delay'; await tmpPage.waitForTimeout(delay); }
      phase = 'static-screenshot';
      const ss = await tmpPage.screenshot({ type: 'png', captureBeyondViewport: false }) as Buffer;
      if (!ss || ss.length < 1024) throw new Error('static-empty-screenshot');
      if (ss.length > 5_000_000) { // 5MB guard
        throw new Error('static-too-large-' + ss.length);
      }
      preCapturedDataUrl = 'data:image/png;base64,' + ss.toString('base64');
      await tmpPage.close();
    } catch (e) {
      // If pre-capture fails, fall back to live mode
      preCapturedDataUrl = null;
      if (debug) console.warn('[static-fallback]', (e as any)?.message);
    }
  }

  const effectiveMode = preCapturedDataUrl ? 'static' : (mode === 'live' ? 'live' : undefined);
  const targetUrl = overlay ? buildOverlayInternal(origin, preCapturedDataUrl ? preCapturedDataUrl : url, { title, subtitle, theme, w, h, accent, pad, noborder, noshadow, autosize, hideDev, mode: effectiveMode, framew, iframebase, iframefit, iframealign, maxscale, keepwidth, scaleFlag, border }) : url;
  if (overlay && debug) {
    console.log('[overlay-debug]', { targetUrl, origin, title, subtitle, theme, w, h });
  }
    phase = 'navigate-main';
  let resp = await page.goto(targetUrl, waitUntil ? { waitUntil } : {});
    if (!resp && waitUntil !== 'load') {
      phase = 'navigate-fallback-load';
      // fallback to load
      resp = await page.goto(targetUrl, { waitUntil: 'load' });
    }
    if (!resp && waitUntil !== 'networkidle2') {
      try { resp = await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 10000 }); } catch {}
    }
    if (!resp) throw new Error('No response navigation');

    if (delay) { phase = 'post-delay'; await page.waitForTimeout(delay); }
    // Additional small wait for fonts / paint
    await page.waitForTimeout(Math.min(700, Math.max(150, 500 - (Date.now() - start))));

    // Detect blank body (common when CSP blocks) and attempt a small retry via reload
    const bodyText = await page.evaluate(() => document.body && document.body.innerText && document.body.innerText.trim().slice(0, 50));
    const bodyHtmlLen = await page.evaluate(() => document.body && document.body.innerHTML.length || 0);
    if (bodyHtmlLen < 50) {
      try {
        await page.reload({ waitUntil: 'load', timeout: 8000 });
      } catch {}
    }
    // Detect common Chrome internal error pages (e.g. ERR_TOO_MANY_REDIRECTS like layout with large center message) and fallback to live overlay if we were static
    if (overlay && preCapturedDataUrl && bodyHtmlLen < 400 && (bodyText || '').toLowerCase().includes('esta página no funciona')) {
      try {
        // Attempt live mode instead
        preCapturedDataUrl = null;
        const liveUrl = buildOverlayInternal(origin, url, { title, subtitle, theme, w, h, accent, pad, noborder, noshadow, autosize, hideDev, mode: 'live' });
        phase = 'navigate-live-fallback';
        await page.goto(liveUrl, { waitUntil: 'load', timeout: 12000 });
        await page.waitForTimeout(300);
      } catch {}
    }

    let buf: Buffer | null = null;
    for (let i = 0; i < 2; i++) {
      try {
        phase = 'screenshot-' + i;
        buf = await page.screenshot({ type: 'png' }) as Buffer;
        if (buf && buf.length > 5000) break; // assume non-empty
      } catch (sErr) {
        if (i === 1) throw sErr;
        await page.waitForTimeout(500);
      }
    }
    if (!buf) throw new Error('Screenshot failed');

    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400'
      }
    });
  } catch (e: any) {
    // expose extra hint for local dev
    const hint = e && e.message && /executable|ENOENT|spawn/i.test(e.message)
      ? 'Browser executable not found. Fixes: (1) Install Chrome/Edge (2) Set CHROME_PATH env or use ?exe=full%5Cpath%5Cto%5Cchrome.exe (3) Ensure full puppeteer installed (4) On Windows try an absolute path like C:/Program Files/Google/Chrome/Application/chrome.exe'
      : undefined;
    const extra = (e as any).attempted || undefined;
    return new Response(JSON.stringify({
      error: 'Capture failed',
      message: e?.message || String(e),
      phase,
      hint,
      attempted: extra,
      stack: process.env.NODE_ENV !== 'production' ? e?.stack : undefined
    }, null, 2), { status: 500, headers: { 'Content-Type': 'application/json' }});
  } finally {
    if (browser) await browser.close().catch(()=>{});
  }
}


function buildOverlayInternal(origin: string, target: string, opts: { title: string; subtitle: string; theme: string; w: number; h: number; accent?: string; pad?: string; noborder?: string | null; noshadow?: string | null; autosize?: string | null; hideDev?: string | null; mode?: string; framew?: string; iframebase?: string; iframefit?: string; iframealign?: string; maxscale?: string; keepwidth?: string; scaleFlag?: string; border?: string }) {
  const { title, subtitle, theme, w, h, accent, pad, noborder, noshadow, autosize, hideDev, mode, framew, iframebase, iframefit, iframealign, maxscale, keepwidth, scaleFlag, border } = opts;
  const qp = new URLSearchParams({
    url: target,
    title: title.slice(0,300),
    subtitle: subtitle.slice(0,300),
    theme,
    w: String(w),
    h: String(h)
  });
  if (accent) qp.set('accent', accent);
  if (pad) qp.set('pad', pad);
  if (noborder === '1') qp.set('noborder', '1');
  if (noshadow === '1') qp.set('noshadow', '1');
  if (autosize === '1') qp.set('autosize', '1');
  // Default hideDev on unless explicitly 0
  if (hideDev !== '0') qp.set('hidedev','1');
  if (mode === 'static' || mode === 'live') qp.set('mode', mode);
  if (framew) qp.set('framew', framew);
  if (iframebase) qp.set('iframebase', iframebase);
  if (iframefit) qp.set('iframefit', iframefit);
  if (iframealign) qp.set('iframealign', iframealign);
  if (maxscale) qp.set('maxscale', maxscale);
  if (keepwidth) qp.set('keepwidth', keepwidth);
  if (scaleFlag) qp.set('scale', scaleFlag);
  if (border) qp.set('border', border);
  return `${origin}/overlay?${qp.toString()}`;
}

// resolveExecutable & clampNum now imported
