import Link from 'next/link';
import CaptureClient from '../components/CaptureClient';

export default function Home() {
  return (
    <main className="max-w-5xl mx-auto p-8 space-y-10">
      <header className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">Automatic OG Generator</h1>
        <p className="text-neutral-400 max-w-2xl">Generate Open Graph / Twitter share images from any public HTTPS URL. Provide dimensions, optional delay, dark mode emulation, then download the PNG.</p>
      </header>
      <CaptureClient />
      <section className="space-y-4 text-sm text-neutral-400 max-w-3xl">
        <h2 className="text-xl font-bold tracking-tight text-neutral-100" style={{ margin:0 }}>About This Project</h2>
        <p>
          Automatic OG Generator is a lightweight Next.js tool that captures live webpages (or a themed overlay)
          and renders production‑ready Open Graph images for social sharing. It focuses on reliability, fast cold starts,
          and flexible layout parameters (title, subtitle, accent gradient, padding, static/live modes, auto title sizing, and more).
        </p>
        <p>
          Built and maintained by <a href="https://www.habbiwebdesign.site/" target="_blank" rel="noopener noreferrer" className="underline">Habbi Web Design</a>. Visit the site to explore high‑end web design work, branding, and performance‑oriented builds.
        </p>
      </section>
      <footer className="pt-10 text-sm text-neutral-500">
        <p>API: <code>/api/capture?url=&lt;https-url&gt;&w=1200&h=630&delay=500&dark=1</code></p>
  <p>Source <Link href="https://github.com/Habbi2/Automatic-OG-Generator" className="underline">GitHub</Link></p>
      </footer>
    </main>
  );
}
