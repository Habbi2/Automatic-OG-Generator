# Automatic OG Generator

Repo: https://github.com/Habbi2/Automatic-OG-Generator

Generate social-ready Open Graph / Twitter / LinkedIn images (and variants) from any public HTTPS URL. Includes a composable overlay template (title + subtitle + theming) and batch mode that returns a ZIP of multiple sizes.

## Quick Start
```
npm install
npm run dev
# → http://localhost:3000
```

## Endpoints

### Single Capture
`GET /api/capture?url=<https-url>&w=1200&h=630`

| Param | Description |
|-------|-------------|
| `url` | (required) HTTPS page to screenshot |
| `w` / `h` | Viewport size (default 1200x630; clamps 400–2000 / 200–1200) |
| `delay` | Extra wait ms after initial load (0–5000) |
| `dark=1` | Emulate dark color scheme |
| `wait` | `auto` (default) \| `dom` \| `load` \| `network` \| `none` |
| `engine=full` | Force bundled puppeteer Chrome instead of serverless chromium |
| `exe` | Absolute override path to Chrome/Edge executable |
| `debug=1` | Return JSON diagnostics instead of image |
| `overlay=1` | Use overlay composition (see below) |
| `title` / `subtitle` | Overlay text (when overlay=1) |
| `theme=light` | Overlay light variant (default dark) |
| `accent` | Two comma-separated colors for accent bar gradient |
| `pad` | Outer overlay padding (CSS shorthand or single number) |
| `noborder=1` | Remove inner card border |
| `noshadow=1` | Remove inner card shadow |
| `autosize=1` | Auto-fit title to ≤2 lines (reduces font size) |
| `hidedev=0` | (Overlay) Disable default dev error/ toast suppression (suppression ON by default) |
| `inject` | Append safe custom CSS (strips `@import`) |
| `hide` | Comma-separated selectors to hide (max 15; sanitized) |
| `mode=static` | (Overlay only) Opt in to static pre-capture (default is live iframe now) |
| `ua=<string>` | Override User-Agent for navigation / static pre-capture |

### Batch Capture
`GET /api/batch?url=<https-url>&preset=social&overlay=1...`

Returns a ZIP (`Content-Type: application/zip`) of PNG images.

| Param | Description |
|-------|-------------|
| `url` | HTTPS page (required) |
| `preset` | `og` or `social` (og + twitter + square + widescreen) |
| `sizes` | Additional list: `name:WIDTHxHEIGHT,name2:...` |
| `delay` | Added after each navigation |
| `dark=1` | Dark scheme emulation |
| (all single capture params) | `engine`, `exe`, etc. |
| `overlay=1` | Apply overlay to each size (with same overlay params) |
| Overlay params | `title`, `subtitle`, `theme`, `accent`, `pad`, `noborder`, `noshadow`, `autosize`, `hidedev`, `inject`, `hide` |

### Overlay Examples
Single overlay capture:
```
/api/capture?url=https://example.com&overlay=1&title=Launch%20Day&subtitle=Try%20it%20now&accent=%230ea5e9,%231d4ed8&pad=32&autosize=1&hidedev=1
```

Batch social preset with overlay:
```
/api/batch?url=https://example.com&preset=social&overlay=1&title=Q4%20Report&subtitle=Highlights&accent=%23ef4444,%23f59e0b&noshadow=1
```

Hide selectors & inject CSS:
```
/api/capture?url=https://example.com&overlay=1&hide=.debug-banner,.cookie-bar&inject=.shot-mask{backdrop-filter:blur(4px);}
```

### Direct Overlay Capture Route (Legacy / Specialized)
You can also call the overlay composition route directly:
```
/api/overlay-capture?url=https://example.com&title=Title&subtitle=Sub&accent=%236366f1,%238b5cf6
```
Enhancements:
- Now defaults to live iframe rendering (matches `/api/capture?overlay=1`).
- Supports `mode=static` to request pre-captured image embedding.
- Accepts the same customization params: `accent`, `pad`, `noborder=1`, `noshadow=1`, `autosize=1`, `hidedev=0` (to opt out), `inject`, `hide`.
- Adds diagnostics: `debug=1` for executable info, structured JSON errors with `phase`.

Recommendation: Prefer `/api/capture?overlay=1` for consistency & batching support. Use `/api/overlay-capture` only if you need a minimal surface or want to experiment independently.

## Security & Constraints
| Measure | Detail |
|---------|--------|
| HTTPS enforced | Only `https://` URLs accepted |
| Private network blocked | `localhost`, `127.*`, `10.*`, `192.168.*`, `172.16-31` |
| Dimension clamps | Prevent huge memory usage |
| Navigation timeout | 15s default per page (capture) |
| Retry heuristics | Reload on blank/short body, multi wait strategy |
| Status 431/403 fallback | Static pre-capture retries with alternate Edge UA + `networkidle2`, then falls back to live mode if needed |
| Dev artifact suppression | Enabled by default; add `hidedev=0` to show Next.js dev overlays |

## Title Auto-Fit
When `autosize=1` we attempt client-side measurement and decrement font-size (64px → ≥32px) until the title occupies at most two lines.

## Custom CSS Injection
## Live vs Static Overlay

Default behavior (no `mode` param): live `<iframe>` inside the overlay so the target page can finish dynamic rendering, client hydration, and late animations before the screenshot is taken.

Opt-in static mode (`mode=static`) workflow:
1. Headless browser loads target off-screen
2. Optional wait / delay
3. Screenshot converted to base64 data URL `<img>` in overlay

Pros (static): deterministic, avoids late UI shifts, resilient to dev overlays. Cons: some protected sites return error pages to headless static pre-capture (e.g. HTTP 431) and need live mode instead.

Examples:
Live (default):
```
/api/capture?url=https://example.com&overlay=1&title=Live%20Default
```
Static opt-in:
```
/api/capture?url=https://example.com&overlay=1&mode=static&title=Static%20Capture
```

Note: Large static pages increase data URL size; if necessary a future optimization can spill to a temporary hash reference instead of inline base64.

- `inject` param appended verbatim (after basic sanitization). No `@import` allowed.
- `hide` param lets you specify simple selectors to receive `display:none`.
- Dev overlays/toasts are removed by default from the iframe/embedded page; use `hidedev=0` to keep them (useful for debugging your own site while still capturing).

## Development Tips
| Tip | Why |
|-----|-----|
| Add `&bust=<Date.now()>` | Defeat HTTP cache while iterating |
| Use `debug=1` first | Confirm executable path + env before screenshot |
| Try `delay=500-1500` | Helps late-loading fonts / client hydration |
| Use batch presets | Generate all social ratios at once |

## Roadmap (Next Ideas)
- WebP output (`format=webp`)
- Region crop / selector crop
- Signed request / API token
- Concurrency limiter & metrics
- Multi-theme A/B batch

## Design & Styling
The UI uses a lightweight custom token system (see `styles/tokens.css`) to keep the interface flat and elegant without affecting the rendered OG overlay output.

Key points:
- Tokens define color, spacing, radii, typography, and shadows; dark-first with prepared light theme via `[data-theme='light']`.
- Global styles import the token file and provide minimal semantic utilities (`.container`, `.stack`, form control resets).
- Overlay composition keeps its internal CSS to ensure pixel-stable OG output; only future-safe alignment (no layout shifts) was done during the refactor.
- Buttons & inputs rely on custom properties for quick theming; focus states use `--field-ring` and `--focus-outline` for accessibility.
- Adding a theme switch only requires toggling `data-theme="light"` on `<html>` or a high wrapper.

Non-goals of the styling layer:
- No dependency on Tailwind / external utility frameworks for production build size control.
- No runtime CSS-in-JS to keep server render lean.

If you extend tokens, prefer additive changes (new `--color-*` or spacing steps) to avoid breaking existing capture UI.

## License
MIT

## Deployment (Vercel)

The project is optimized for Vercel’s serverless functions using `puppeteer-core` + `@sparticuz/chromium`.

### 1. Fork / Clone
```
git clone https://github.com/Habbi2/Automatic-OG-Generator.git
cd Automatic-OG-Generator/automatic-og-generator
```

### 2. Install & Build Locally
```
npm install
npm run build
```
Run dev to sanity check:
```
npm run dev
```
Visit: http://localhost:3000/api/capture?url=https://example.com&debug=1

### 3. Vercel Project
Create a new Vercel project and import this subfolder (`automatic-og-generator`). Ensure the **Root Directory** is set correctly if the monorepo has multiple apps.

### 4. Environment Variables
Add (optional but recommended):

| Name | Purpose | Example |
|------|---------|---------|
| `ALLOWED_HOST_PATTERN` | Regex limiting which target hostnames can be captured (prevents abuse / arbitrary SSRF-style capture) | `^(?:www\.)?(example|yourdomain)\.com$` |

If omitted, any public HTTPS host (still filtered against private / localhost ranges) is allowed. Use anchored regexes: start (`^`) and end (`$`) to avoid partial matches. Multiple domains can be grouped using `(?:a|b)`.

### 5. Function Sizing
`vercel.json` already pins memory + maxDuration per heavy route:
```json
{
	"version": 2,
	"functions": {
		"app/api/capture/route.ts": { "memory": 1024, "maxDuration": 20 },
		"app/api/overlay-capture/route.ts": { "memory": 1024, "maxDuration": 20 },
		"app/api/batch/route.ts": { "memory": 1536, "maxDuration": 40 }
	},
	"routes": [
		{ "src": "/health", "dest": "/api/capture?url=https://example.com&debug=1" }
	]
}
```
Adjust if you experience timeouts (e.g. increase `maxDuration` slightly). Batch routes naturally require more memory/time.

### 6. Chromium Execution
No custom binary path is required on Vercel—`@sparticuz/chromium` supplies arguments & executable. You can force the full bundled Chrome locally using `engine=full` for parity tests.

### 7. Testing After Deploy
Use the debug endpoint first:
```
https://<your-deployment>.vercel.app/api/capture?url=https://example.com&debug=1
```
Confirm fields: `executablePath`, `browserMode`, and that no error phase is reported.

Then try a real capture:
```
https://<host>/api/capture?url=https://example.com&w=1200&h=630
```
Overlay sample:
```
https://<host>/api/capture?url=https://example.com&overlay=1&title=Launch&subtitle=Now&accent=%230ea5e9,%231d4ed8&autosize=1
```
Batch sample:
```
https://<host>/api/batch?url=https://example.com&preset=social&overlay=1&title=Hello
```

### 8. Caching / CDN
Responses are not aggressively cached by default (dynamic). For frequently reused URLs consider adding a proxy layer or introducing a future `cache=1` parameter with a hash key stored in KV/object storage.

### 9. Abuse Mitigation
Current safeguards:
* Protocol + private IP blocking.
* Optional hostname regex allowlist (`ALLOWED_HOST_PATTERN`).
* Dimension clamping & navigation timeout.
Recommended enhancements (not yet built-in):
* HMAC signature on query string (server verifies).
* IP-based minimal rate limiting (Edge Middleware + Upstash/Vercel KV).
* Response caching of identical URL + param hashes.

### Common Deployment Issues
| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Timeout on batch | Too many sizes / dynamic site slow | Increase memory/time or reduce sizes |
| Blank image | Page heavy JS; needed more wait | Add `delay=1000` or change `wait=load` |
| 403/431 static pre-capture | Site rejects headless UA | Allow fallback by omitting `mode=static` or use live (default) |
| ECONNRESET sporadic | Remote site connection instability | Add small `delay`, consider retry externally |

### Production Monitoring Ideas
Add a scheduled cron (Vercel Cron) to hit `/health` and page if non-200. Extend debug output to log structured metrics to a logging service (e.g. Axiom, Logtail) for latency + failure phase distribution.

---
If you implement signing, rate limiting, or persistent caching, update this section so consumers know the security guarantees.
