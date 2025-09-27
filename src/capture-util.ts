// Shared helpers extracted from capture & batch routes.
import fs from 'node:fs';
import path from 'node:path';
import chromium from '@sparticuz/chromium';
import puppeteerCore from 'puppeteer-core';

export interface ExecResult { executablePath?: string; usingFull: boolean; attempted: string[] }
export interface ResolveOpts { override?: string; forceFull?: boolean; puppeteerFull?: typeof puppeteerCore | null }

export async function resolveExecutable(opts: ResolveOpts): Promise<ExecResult> {
  const { override, forceFull, puppeteerFull } = opts;
  const attempted: string[] = [];
  function valid(p?: string | null): string | undefined {
    if (!p) return; attempted.push(p);
    try {
      const st = fs.statSync(p); if (st.isFile()) return p; if (st.isDirectory()) {
        const binNames = process.platform === 'win32' ? ['chrome.exe','chromium.exe','msedge.exe'] : ['chrome','chromium','edge'];
        for (const b of binNames) { const nested = path.join(p,b); attempted.push(nested); try { if (fs.statSync(nested).isFile()) return nested; } catch {} }
      }
    } catch {}
    return;
  }
  const envPath = override || process.env.CHROME_PATH; const envValid = valid(envPath); if (envValid) return { executablePath: envValid, usingFull:false, attempted };
  if (forceFull && puppeteerFull) { try { /* @ts-ignore */ const fp = puppeteerFull.executablePath && puppeteerFull.executablePath(); const fv = valid(fp); if (fv) return { executablePath: fv, usingFull:true, attempted }; } catch {} }
  try { const cp = await chromium.executablePath(); const cv = valid(cp); if (cv && (/\.exe$/i.test(cv) || process.platform !== 'win32')) return { executablePath: cv, usingFull:false, attempted }; } catch {}
  if (puppeteerFull) { try { /* @ts-ignore */ const fp = puppeteerFull.executablePath && puppeteerFull.executablePath(); const fv = valid(fp); if (fv) return { executablePath: fv, usingFull:true, attempted }; } catch {} }
  if (process.platform === 'win32') {
    const pf = [process.env['PROGRAMFILES'], process.env['PROGRAMFILES(X86)']].filter(Boolean) as string[]; const la = process.env['LOCALAPPDATA'];
    const candidates:string[] = []; for (const b of pf) { candidates.push(path.join(b,'Google/Chrome/Application/chrome.exe')); candidates.push(path.join(b,'Microsoft/Edge/Application/msedge.exe')); }
    if (la) { candidates.push(path.join(la,'Google/Chrome/Application/chrome.exe')); candidates.push(path.join(la,'Microsoft/Edge/Application/msedge.exe')); }
    for (const c of candidates) { const v = valid(c); if (v) return { executablePath: v, usingFull:false, attempted }; }
  }
  return { executablePath: undefined, usingFull: !!puppeteerFull, attempted };
}

export function clampNum(raw: string | null, fallback:number, min:number, max:number) {
  if (!raw) return fallback; const n = parseInt(raw,10); if (isNaN(n)) return fallback; return Math.min(max, Math.max(min,n));
}
