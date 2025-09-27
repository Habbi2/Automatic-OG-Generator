import { NextRequest } from 'next/server';
import chromium from '@sparticuz/chromium';
import puppeteerCore from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

let puppeteerFull: typeof import('puppeteer-core') | null = null;
try { puppeteerFull = require('puppeteer'); } catch {}

function bad(msg: string, status=400, extra: Record<string,any> = {}) {
  return new Response(JSON.stringify({ error: msg, ...extra }, null, 2), { status, headers:{'Content-Type':'application/json','Cache-Control':'no-store'} });
}

const ALLOW_RE = process.env.ALLOWED_HOST_PATTERN ? new RegExp(process.env.ALLOWED_HOST_PATTERN) : null;

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const target = searchParams.get('url') || '';
  if (!target || !/^https:\/\//i.test(target)) return bad('Missing https target url');
  try {
    const host = new URL(target).hostname;
    if (ALLOW_RE && !ALLOW_RE.test(host)) return bad('Host not allowed');
  } catch { return bad('Invalid URL'); }
  const title = (searchParams.get('title') || 'Example Title').slice(0,300);
  const subtitle = (searchParams.get('subtitle') || 'Subtitle').slice(0,300);
  const theme = searchParams.get('theme') === 'light' ? 'light' : 'dark';
  const w = clamp(searchParams.get('w'),1200,400,2000);
  const h = clamp(searchParams.get('h'),630,200,1200);
  const delay = clamp(searchParams.get('delay'),0,0,5000);
  const engine = searchParams.get('engine');
  const exeOverride = searchParams.get('exe') || undefined;
  const modeParam = searchParams.get('mode');
  // Default now to live; static only when explicitly requested
  const requestedMode: 'static'|'live' = modeParam === 'static' ? 'static' : 'live';
  const accent = searchParams.get('accent') || undefined;
  const pad = searchParams.get('pad') || undefined;
  const noborder = searchParams.get('noborder') === '1';
  const noshadow = searchParams.get('noshadow') === '1';
  const autosize = searchParams.get('autosize') === '1';
  const hideDevParam = searchParams.get('hidedev');
  const hideDev = hideDevParam === '0' ? false : true;
  const debug = searchParams.get('debug') === '1';

  let browser; let phase = 'init'; let preCapturedDataUrl: string | null = null; let attempted: string[]|undefined;
  try {
    phase = 'resolve-executable';
    const { executablePath, usingFull, attempted: att } = await resolveExecutable({ override: exeOverride, forceFull: engine==='full' });
    attempted = att;
    if (debug) {
      return bad('debug-info', 200, { executablePath, usingFull, attempted, requestedMode, platform: process.platform });
    }
    const baseArgs = ['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--hide-scrollbars'];
    const launchArgs = usingFull ? baseArgs : [...chromium.args, ...baseArgs];
    const p = usingFull && puppeteerFull ? puppeteerFull : puppeteerCore;
    phase = 'launch';
    browser = await p.launch({ args: launchArgs, executablePath, headless:'new', defaultViewport:{ width:w, height:h } });

    // Static pre-capture
    if (requestedMode === 'static') {
      try {
        phase = 'static-newPage';
        const tmp = await browser.newPage();
        tmp.setDefaultNavigationTimeout(15000);
        try { await tmp.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36'); } catch {}
        phase = 'static-goto';
        const respStatic = await tmp.goto(target, { waitUntil:'domcontentloaded' });
        const status = respStatic?.status() || 0;
        if (!respStatic || status >= 400) throw new Error('static-status-' + status);
        if (delay) { phase = 'static-delay'; await tmp.waitForTimeout(delay); }
        phase = 'static-screenshot';
        const buf = await tmp.screenshot({ type:'png', captureBeyondViewport:false }) as Buffer;
        if (!buf || buf.length < 1024) throw new Error('static-empty');
        if (buf.length > 5_000_000) throw new Error('static-too-large-' + buf.length);
        preCapturedDataUrl = 'data:image/png;base64,' + buf.toString('base64');
        await tmp.close();
      } catch (e) {
        // fallback to live mode
        preCapturedDataUrl = null;
      }
    }

    phase = 'newPage';
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(15000);

    const modeEffective = preCapturedDataUrl ? 'static' : (requestedMode === 'live' ? 'live' : undefined);
    const overlayUrl = buildOverlay(origin, preCapturedDataUrl ? preCapturedDataUrl : target, { title, subtitle, theme, w, h, accent, pad, noborder, noshadow, autosize, hideDev, mode: modeEffective });
    phase = 'goto-overlay';
    let resp = await page.goto(overlayUrl, { waitUntil: 'load' });
    if (!resp) {
      // fallback attempts
      try { resp = await page.goto(overlayUrl, { waitUntil:'domcontentloaded' }); } catch {}
    }
    if (!resp) throw new Error('overlay-no-response');
    if (delay && !preCapturedDataUrl) { // if static already waited earlier
      phase = 'post-delay';
      await page.waitForTimeout(delay);
    }
    await page.waitForTimeout(250);
    phase = 'screenshot';
    const png = await page.screenshot({ type:'png' }) as Buffer;
    if (!png || png.length < 1000) {
      // capture body HTML snippet for diagnostics
      const htmlSnippet = await page.evaluate(() => document.body ? document.body.innerHTML.slice(0,400) : 'no-body');
      throw new Error('blank-screenshot length='+(png?png.length:0)+' htmlSnippet='+htmlSnippet.replace(/\n/g,' '));
    }
    return new Response(new Uint8Array(png), { status:200, headers:{ 'Content-Type':'image/png','Cache-Control':'no-store','x-overlay-mode': modeEffective || requestedMode } });
  } catch (e:any) {
    return bad('Overlay capture failed', 500, { message: e?.message || String(e), phase, requestedMode, hasDataUrl: !!preCapturedDataUrl, attempted });
  } finally { if (browser) await browser.close().catch(()=>{}); }
}

function buildOverlay(origin: string, target: string, opts: { title:string; subtitle:string; theme:string; w:number; h:number; accent?:string; pad?:string; noborder?:boolean; noshadow?:boolean; autosize?:boolean; hideDev?:boolean; mode?: string }) {
  const { title, subtitle, theme, w, h, accent, pad, noborder, noshadow, autosize, hideDev, mode } = opts;
  const qp = new URLSearchParams({ url: target, title, subtitle, theme, w: String(w), h: String(h) });
  if (accent) qp.set('accent', accent);
  if (pad) qp.set('pad', pad);
  if (noborder) qp.set('noborder','1');
  if (noshadow) qp.set('noshadow','1');
  if (autosize) qp.set('autosize','1');
  if (hideDev) qp.set('hidedev','1');
  if (mode === 'static' || mode === 'live') qp.set('mode', mode);
  return `${origin}/overlay?${qp.toString()}`;
}

function clamp(raw:string|null, fallback:number, min:number, max:number) { if (!raw) return fallback; const n = parseInt(raw,10); if (isNaN(n)) return fallback; return Math.min(max, Math.max(min,n)); }

interface ExecResult { executablePath?: string; usingFull:boolean; attempted:string[] }
interface ResolveOpts { override?:string; forceFull?:boolean }
async function resolveExecutable(opts:ResolveOpts): Promise<ExecResult> {
  const { override, forceFull } = opts; const attempted:string[]=[];
  function valid(p?:string|null):string|undefined { if (!p) return; attempted.push(p); try { const st = fs.statSync(p); if (st.isFile()) return p; if (st.isDirectory()) { const binNames = process.platform==='win32'?['chrome.exe','chromium.exe','msedge.exe']:['chrome','chromium','edge']; for (const b of binNames){ const nested=path.join(p,b); attempted.push(nested); try { if (fs.statSync(nested).isFile()) return nested; } catch {} } } } catch {} return; }
  const envPath = override || process.env.CHROME_PATH; const envValid=valid(envPath); if (envValid) return { executablePath:envValid, usingFull:false, attempted };
  if (forceFull && puppeteerFull) { try { /* @ts-ignore */ const fp=puppeteerFull.executablePath&&puppeteerFull.executablePath(); const fv=valid(fp); if (fv) return { executablePath:fv, usingFull:true, attempted }; } catch {} }
  try { const cp=await chromium.executablePath(); const cv=valid(cp); if (cv && /\.exe$/i.test(cv)) return { executablePath:cv, usingFull:false, attempted }; } catch {}
  if (puppeteerFull) { try { /* @ts-ignore */ const fp=puppeteerFull.executablePath&&puppeteerFull.executablePath(); const fv=valid(fp); if (fv) return { executablePath:fv, usingFull:true, attempted }; } catch {} }
  if (process.platform==='win32') { const pf=[process.env['PROGRAMFILES'],process.env['PROGRAMFILES(X86)']].filter(Boolean) as string[]; const la=process.env['LOCALAPPDATA']; const candidates:string[]=[]; for (const b of pf){ candidates.push(path.join(b,'Google/Chrome/Application/chrome.exe')); candidates.push(path.join(b,'Microsoft/Edge/Application/msedge.exe')); } if (la){ candidates.push(path.join(la,'Google/Chrome/Application/chrome.exe')); candidates.push(path.join(la,'Microsoft/Edge/Application/msedge.exe')); } for (const c of candidates) { const v=valid(c); if (v) return { executablePath:v, usingFull:false, attempted }; } }
  return { executablePath:undefined, usingFull:!!puppeteerFull, attempted };
}
