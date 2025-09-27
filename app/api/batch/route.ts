import { NextRequest } from 'next/server';
import JSZip from 'jszip';
import { Readable } from 'node:stream';
import chromium from '@sparticuz/chromium';
import puppeteerCore from 'puppeteer-core';
import { resolveExecutable, clampNum } from '../../../src/capture-util';

// We re-use logic similar to single capture; minimal duplication to keep this self-contained for now.
// Future: extract shared helpers into lib.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ExecResult { executablePath?: string; usingFull: boolean; attempted: string[] }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let puppeteerFull: any | null = null;
try { puppeteerFull = require('puppeteer'); } catch {}

function parseSizes(raw: string | null): Array<{ w:number; h:number; name:string }> {
  if (!raw) return [];
  return raw.split(',').map(s => s.trim()).filter(Boolean).map((token, idx) => {
    // token format: name:wxh OR wxh
    const namePart = token.includes(':') ? token.split(':')[0] : `size${idx+1}`;
    const dimPart = token.includes(':') ? token.split(':')[1] : token;
    const [wStr,hStr] = dimPart.toLowerCase().split('x');
    const w = parseInt(wStr,10); const h = parseInt(hStr,10);
    if (!Number.isFinite(w)||!Number.isFinite(h)) return null;
    return { w:Math.min(4000,Math.max(100,w)), h:Math.min(4000,Math.max(100,h)), name: namePart };
  }).filter((v):v is {w:number;h:number;name:string} => !!v);
}

const PRESETS: Record<string, Array<{w:number;h:number;name:string}>> = {
  og: [{ w:1200, h:630, name:'og' }],
  social: [
    { w:1200, h:630, name:'og' },
    { w:800, h:418, name:'twitter' },
    { w:1080, h:1080, name:'square' },
    { w:1600, h:900, name:'widescreen' }
  ]
};

function bad(msg: string, status=400) {
  return new Response(JSON.stringify({ error: msg }), { status, headers:{'Content-Type':'application/json'} });
}

const ALLOW_RE = process.env.ALLOWED_HOST_PATTERN ? new RegExp(process.env.ALLOWED_HOST_PATTERN) : null;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url') || '';
  if (!/^https:\/\//i.test(url)) return bad('Missing or invalid https url');
  try {
    const host = new URL(url).hostname;
    if (ALLOW_RE && !ALLOW_RE.test(host)) return bad('Host not allowed');
  } catch { return bad('Invalid URL'); }

  const preset = searchParams.get('preset');
  const overlay = searchParams.get('overlay') === '1';
  const title = (searchParams.get('title') || '').slice(0,300);
  const subtitle = (searchParams.get('subtitle') || '').slice(0,300);
  const theme = searchParams.get('theme') === 'light' ? 'light' : 'dark';
  const accent = searchParams.get('accent') || undefined;
  const pad = searchParams.get('pad') || undefined;
  const noborder = searchParams.get('noborder');
  const noshadow = searchParams.get('noshadow');
  const autosize = searchParams.get('autosize');
  const sizesParam = searchParams.get('sizes');
  const dark = searchParams.get('dark') === '1';
  const delay = clampNum(searchParams.get('delay'), 0,0,5000);
  const engine = searchParams.get('engine');
  const exeOverride = searchParams.get('exe') || undefined;

  let sizes: Array<{w:number;h:number;name:string}> = [];
  if (preset && PRESETS[preset]) sizes = PRESETS[preset];
  sizes = sizes.concat(parseSizes(sizesParam));
  if (!sizes.length) sizes = PRESETS['og'];

  let browser;
  try {
    const { executablePath, usingFull } = await resolveExecutable({ override: exeOverride, forceFull: engine==='full', puppeteerFull });
    const baseArgs = [ '--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--disable-background-networking','--hide-scrollbars' ];
    const launchArgs = usingFull ? baseArgs : [...chromium.args, ...baseArgs];
    const p = usingFull && puppeteerFull ? puppeteerFull : puppeteerCore;
    browser = await p.launch({ args: launchArgs, headless: 'new', executablePath });
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(20000);
    if (dark) { try { await page.emulateMediaFeatures([{ name:'prefers-color-scheme', value:'dark'}]); } catch {} }

    const zip = new JSZip();

    const origin = new URL(req.url).origin;
    for (const { w, h, name } of sizes) {
      await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
      const targetUrl = overlay ? buildOverlayUrl(origin, url, { w, h, title, subtitle, theme, accent, pad, noborder, noshadow, autosize }) : url;
      let resp = await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
      if (!resp) resp = await page.goto(targetUrl, { waitUntil: 'load' });
      if (delay) await page.waitForTimeout(delay);
      await page.waitForTimeout(250);
      const png = await page.screenshot({ type:'png' }) as Buffer;
      zip.file(`${name}-${w}x${h}.png`, png);
    }

    const content = await zip.generateAsync({ type:'uint8array' });
    return new Response(new Uint8Array(content), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="captures.zip"',
        'Cache-Control': 'no-store'
      }
    });
  } catch (e:any) {
    return bad(`Batch failed: ${e.message}` , 500);
  } finally {
    if (browser) await browser.close().catch(()=>{});
  }
}

// clampNum & resolveExecutable imported

function buildOverlayUrl(origin: string, target: string, opts: { w:number; h:number; title:string; subtitle:string; theme:string; accent?:string; pad?:string; noborder?:string|null; noshadow?:string|null; autosize?:string|null }) {
  const qp = new URLSearchParams({
    url: target,
    w: String(opts.w),
    h: String(opts.h),
    title: opts.title,
    subtitle: opts.subtitle,
    theme: opts.theme
  });
  if (opts.accent) qp.set('accent', opts.accent);
  if (opts.pad) qp.set('pad', opts.pad);
  if (opts.noborder === '1') qp.set('noborder','1');
  if (opts.noshadow === '1') qp.set('noshadow','1');
  if (opts.autosize === '1') qp.set('autosize','1');
  return `${origin}/overlay?${qp.toString()}`;
}
