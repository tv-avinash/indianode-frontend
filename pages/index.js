// pages/index.js
import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";

/** Minimal inline SVG logo: “I” made of connected nodes */
function IndianodeLogo({ className = "h-10 w-auto" }) {
  return (
    <svg
      viewBox="0 0 220 48"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Indianode"
    >
      {/* Node network behind the glyph */}
      <g opacity="0.15" stroke="currentColor" strokeWidth="1.4" fill="none">
        <path d="M10 28 L30 10 L55 22 L80 9 L105 18 L130 8 L155 16 L180 7 L205 16" />
        <circle cx="10" r="3" cy="28" />
        <circle cx="30" r="3" cy="10" />
        <circle cx="55" r="3" cy="22" />
        <circle cx="80" r="3" cy="9" />
        <circle cx="105" r="3" cy="18" />
        <circle cx="130" r="3" cy="8" />
        <circle cx="155" r="3" cy="16" />
        <circle cx="180" r="3" cy="7" />
        <circle cx="205" r="3" cy="16" />
      </g>

      {/* Stylized “I” */}
      <rect x="8" y="8" width="12" height="32" rx="6" fill="currentColor" />

      {/* Wordmark */}
      <text
        x="28"
        y="32"
        fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial"
        fontSize="24"
        fontWeight="700"
        letterSpacing="0.5"
        fill="currentColor"
      >
        Indianode
      </text>
    </svg>
  );
}

export default function Landing() {
  const [status, setStatus] = useState("checking…");

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((j) => setStatus(j?.status || "offline"))
      .catch(() => setStatus("offline"));
  }, []);

  const gpuBusy = status !== "available";

  return (
    <>
      <Head>
        <title>Indianode — CPU/RAM Compute & Persistent Storage on Akash</title>
        <meta
          name="description"
          content="Spin up CPU/RAM workers or persistent NVMe storage. Akash-locked SDLs for on-chain deploys and one-line run.sh for off-chain jobs."
        />
        <link rel="canonical" href="https://www.indianode.com/" />
        {/* OG */}
        <meta property="og:title" content="Indianode — Compute & Storage" />
        <meta
          property="og:description"
          content="Monetize idle CPU/RAM/NVMe or buy short jobs. Works with Akash and one-time cards."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.indianode.com/" />
        <meta name="twitter:card" content="summary_large_image" />
        {/* JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Indianode",
              url: "https://www.indianode.com",
              logo: "https://www.indianode.com/icon.png",
            }),
          }}
        />
      </Head>

      {/* Full-screen hero */}
      <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-900 text-white">
        {/* Subtle grid */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,.15) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />

        {/* Glow */}
        <div
          aria-hidden
          className="absolute -top-40 -left-32 h-80 w-80 rounded-full blur-3xl"
          style={{ background: "radial-gradient(closest-side, #7c3aed50, transparent)" }}
        />
        <div
          aria-hidden
          className="absolute -bottom-40 -right-32 h-96 w-96 rounded-full blur-3xl"
          style={{ background: "radial-gradient(closest-side, #22d3ee40, transparent)" }}
        />

        {/* Nav */}
        <header className="relative z-10">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
            <div className="flex items-center gap-3 text-indigo-100">
              <IndianodeLogo className="h-9 w-auto text-white/95" />
              <span className="hidden md:inline text-sm text-white/60">
                CPU • RAM • NVMe on Akash
              </span>
            </div>

            <nav className="flex items-center gap-4 text-sm">
              <Link href="/compute" className="hover:text-cyan-200">
                Compute
              </Link>
              <Link href="/storage" className="hover:text-cyan-200">
                Storage
              </Link>
              <Link href="/sdls" className="hidden sm:inline hover:text-cyan-200">
                SDLs
              </Link>
            </nav>
          </div>
        </header>

        {/* Center hero content */}
        <main className="relative z-10">
          <div className="mx-auto grid max-w-6xl gap-8 px-6 pt-6 md:pt-10">
            <div className="text-center mx-auto max-w-3xl">
              <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-tight">
                Run <span className="text-cyan-300">Compute</span> &{" "}
                <span className="text-indigo-300">Storage</span> in one click
              </h1>
              <p className="mt-4 text-lg text-white/80">
                Pay-per-minute CPU/RAM jobs & persistent NVMe volumes. Use our
                Akash-locked SDLs or a one-line script — same host, same speed.
              </p>

              {/* Status pill */}
              <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm text-white/90">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${
                    gpuBusy ? "bg-amber-400" : "bg-emerald-400"
                  }`}
                />
                GPU status: {gpuBusy ? "busy / queued" : "available"}
              </div>

              {/* CTAs */}
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/compute"
                  className="group inline-flex items-center justify-center rounded-2xl bg-white px-6 py-3 text-slate-900 font-semibold hover:bg-cyan-100"
                >
                  Launch Compute
                  <svg
                    className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M12.293 3.293a1 1 0 011.414 0l4.999 5a1 1 0 010 1.414l-4.999 5a1 1 0 11-1.414-1.414L15.586 10l-3.293-3.293a1 1 0 010-1.414z" />
                    <path d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
                  </svg>
                </Link>

                <Link
                  href="/storage"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/25 px-6 py-3 font-semibold text-white hover:bg-white/10"
                >
                  Persistent Storage
                </Link>
              </div>

              {/* quick links row */}
              <div className="mt-4 text-sm text-white/70">
                Prefer Akash? Use{" "}
                <Link href="/sdls" className="underline decoration-dotted hover:text-white">
                  ready-to-use SDLs
                </Link>
                .
              </div>
            </div>

            {/* Features (compact row, still fits on one screen) */}
            <div className="mx-auto grid max-w-5xl grid-cols-1 gap-3 sm:grid-cols-3 text-sm">
              <div className="rounded-2xl bg-white/5 p-4 backdrop-blur">
                <p className="font-semibold">One-line jobs</p>
                <p className="text-white/80">
                  Pay, get an <code className="text-cyan-200">ORDER_TOKEN</code>,
                  run <code className="text-cyan-200">run.sh</code>. That’s it.
                </p>
              </div>
              <div className="rounded-2xl bg-white/5 p-4 backdrop-blur">
                <p className="font-semibold">Akash-locked</p>
                <p className="text-white/80">
                  SDLs pinned to our node for predictable placement & pricing.
                </p>
              </div>
              <div className="rounded-2xl bg-white/5 p-4 backdrop-blur">
                <p className="font-semibold">Fair billing</p>
                <p className="text-white/80">
                  Card for short jobs, AKT on the marketplace for long runs.
                </p>
              </div>
            </div>
          </div>
        </main>

        {/* Footer (inside the fold; still single screen on common laptop sizes) */}
        <footer className="relative z-10 mt-10 px-6 pb-8 text-center text-xs text-white/60">
          <nav className="mb-2 space-x-4">
            <Link href="/compute" className="hover:text-white">Compute</Link>
            <Link href="/storage" className="hover:text-white">Storage</Link>
            <Link href="/sdls" className="hover:text-white">SDLs</Link>
          </nav>
          © {new Date().getFullYear()} Indianode
        </footer>
      </div>
    </>
  );
}
