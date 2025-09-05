// pages/index.jsx
import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";

// Minimal inline logo that hints “nodes + India”
function Logo({ className = "h-7 w-7" }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      {/* dot over an “i” + network nodes */}
      <circle cx="32" cy="12" r="5" fill="url(#g)" />
      <rect x="29" y="20" width="6" height="26" rx="3" fill="url(#g)" />
      <circle cx="14" cy="42" r="5" fill="#0ea5e9" />
      <circle cx="50" cy="42" r="5" fill="#8b5cf6" />
      <path d="M19 41 L29 35" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round" />
      <path d="M45 41 L35 35" stroke="#8b5cf6" strokeWidth="3" strokeLinecap="round" />
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

  const busy = status !== "available";

  return (
    <>
      <Head>
        <title>Indianode — GPU • Compute • Storage</title>
        <meta
          name="description"
          content="Pay-per-minute GPU (3090), CPU/RAM compute, and same-host NVMe storage. Ready SDLs for Akash + simple token-based runner."
        />
        <link rel="canonical" href="https://www.indianode.com/" />
        <meta property="og:title" content="Indianode — GPU • Compute • Storage" />
        <meta
          property="og:description"
          content="Run AI and services on-demand: GPU 3090, CPU/RAM, and NVMe storage. Works with Akash or your own host."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.indianode.com/" />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>

      <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
        {/* subtle gradient background */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-1/3 -left-1/3 h-[60rem] w-[60rem] rounded-full bg-cyan-500/10 blur-[140px]" />
          <div className="absolute -bottom-1/3 -right-1/3 h-[60rem] w-[60rem] rounded-full bg-indigo-500/10 blur-[140px]" />
        </div>

        <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 pt-6">
          <Link href="/" className="flex items-center gap-3">
            <Logo className="h-8 w-8" />
            <span className="text-lg font-bold tracking-wide">INDIANODE</span>
          </Link>

          <nav className="flex items-center gap-4 text-sm text-white/80">
            <Link href="/gpu" className="hover:text-white">
              GPU
            </Link>
            <Link href="/compute" className="hover:text-white">
              Compute
            </Link>
            <Link href="/storage" className="hover:text-white">
              Storage
            </Link>
            <Link href="/sdls" className="hidden sm:inline hover:text-white">
              SDLs
            </Link>
            {/* New: direct link to wallet-less SDL flow */}
            <Link href="/compute-sdl" className="hover:text-white">
              Run non-GPU SDLs (No Wallet)
            </Link>
          </nav>
        </header>

        <main className="relative z-10 mx-auto flex max-w-6xl flex-1 items-center px-6 py-10">
          <section className="mx-auto w-full">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80">
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                GPU Status:{" "}
                <b className={`ml-1 ${busy ? "text-amber-300" : "text-emerald-300"}`}>
                  {status}
                </b>
              </div>

              <h1 className="text-balance text-4xl font-extrabold tracking-tight sm:text-5xl">
                Run AI & services on-demand —
                <span className="bg-gradient-to-r from-cyan-300 via-sky-300 to-indigo-300 bg-clip-text text-transparent">
                  {" "}
                  GPU • Compute • Storage
                </span>
              </h1>

              <p className="mx-auto mt-3 max-w-2xl text-pretty text-base text-white/75 sm:text-lg">
                3090 GPU minutes, CPU/RAM jobs and NVMe volumes. Works inside Akash or
                outside with a one-line redeem command. No lock-in.
              </p>

              <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/gpu"
                  className="group inline-flex items-center justify-center rounded-2xl bg-white px-6 py-3 font-semibold text-slate-900 hover:bg-cyan-50"
                >
                  Start GPU (3090)
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
                  href="/compute"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/20 px-6 py-3 font-semibold text-white hover:bg-white/10"
                >
                  CPU / RAM Compute
                </Link>

                <Link
                  href="/storage"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/20 px-6 py-3 font-semibold text-white hover:bg-white/10"
                >
                  Persistent Storage
                </Link>
              </div>

              {/* quick badges */}
              <div className="mt-8 grid grid-cols-1 gap-3 text-xs text-white/70 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  Ready SDLs for Whisper, SD, LLM
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  Token-based runs with minute caps
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  Razorpay (UPI/cards) — no wallet
                </div>
              </div>

              {/* CTA banner: wallet-less SDL flow */}
              <section className="mt-8">
                <div className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">
                  <div className="text-left">
                    <h2 className="text-lg sm:text-xl font-semibold">
                      Run your non-GPU tasks (SDLs) — no crypto wallet needed
                    </h2>
                    <p className="text-sm opacity-90 mt-1">
                      Pay with UPI, cards, or net-banking via Razorpay. We’ll mint a one-time{" "}
                      <b>ORDER_TOKEN</b> so you can deploy straight from your terminal.
                    </p>
                  </div>
                  <Link
                    href="/compute-sdl"
                    className="bg-white text-gray-900 px-4 py-2 rounded-lg font-medium hover:bg-gray-100"
                    onClick={() => {
                      try {
                        if (window.gtag) {
                          window.gtag("event", "select_content", {
                            item_id: "cta_compute_sdl",
                            item_category: "landing",
                          });
                        }
                      } catch {}
                    }}
                  >
                    Run your SDLs
                  </Link>
                </div>
              </section>
            </div>
          </section>
        </main>

        <footer className="relative z-10 mx-auto max-w-6xl px-6 pb-8 pt-2 text-center text-xs text-white/60">
          © {new Date().getFullYear()} Indianode
        </footer>
      </div>
    </>
  );
}
