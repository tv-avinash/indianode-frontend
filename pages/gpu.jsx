// pages/gpu.jsx
import { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import SiteChrome from "../components/SiteChrome";

// GA helper (safe no-op if gtag isn't ready)
const gaEvent = (name, params = {}) => {
  try {
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", name, params);
    }
  } catch {}
};

// --- SDL factory (distinct, provider-bound) ---
function sdlFor(key) {
  const banner = (title) => `# Indianode provider-bound SDL — ${title}
# Bound to org: indianode
`;

  if (key === "whisper") {
    return `${banner("Whisper (ASR)")}
version: "2.0"
services:
  app:
    image: ghcr.io/ggerganov/whisper.cpp:latest
    resources:
      cpu: { units: 4 }
      memory: { size: 8Gi }
      gpu: { units: 1 }
      storage:
        - size: 10Gi
profiles:
  compute:
    app: {}
  placement:
    anywhere:
      attributes:
        org: indianode
      pricing:
        app:
          denom: uakt
          amount: 100
deployment:
  app:
    anywhere:
      profile: app
      count: 1
`;
  }

  if (key === "sd") {
    return `${banner("Stable Diffusion (WebUI)")}
version: "2.0"
services:
  app:
    image: ghcr.io/ai-dock/stable-diffusion-webui:cuda
    resources:
      cpu: { units: 6 }
      memory: { size: 14Gi }
      gpu: { units: 1 }
      storage:
        - size: 20Gi
profiles:
  compute:
    app: {}
  placement:
    anywhere:
      attributes:
        org: indianode
      pricing:
        app:
          denom: uakt
          amount: 120
deployment:
  app:
    anywhere:
      profile: app
      count: 1
`;
  }

  // llama (default)
  return `${banner("LLaMA Inference (llama.cpp server)")}
version: "2.0"
services:
  app:
    image: ghcr.io/ggerganov/llama.cpp:server
    resources:
      cpu: { units: 6 }
      memory: { size: 16Gi }
      gpu: { units: 1 }
      storage:
        - size: 15Gi
profiles:
  compute:
    app: {}
  placement:
    anywhere:
      attributes:
        org: indianode
      pricing:
        app:
          denom: uakt
          amount: 130
deployment:
  app:
    anywhere:
      profile: app
      count: 1
`;
}

// clipboard helper (with fallback)
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}

export default function GPUPage() {
  const cards = [
    { key: "whisper", emoji: "🎙️", title: "Whisper (ASR)", blurb: "Speech-to-text via whisper.cpp" },
    { key: "sd",      emoji: "🎨", title: "Stable Diffusion", blurb: "Text-to-image WebUI on GPU" },
    { key: "llama",   emoji: "🦙", title: "LLaMA Inference",  blurb: "Serve LLMs with llama.cpp" },
  ];
  const [copied, setCopied] = useState("");

  async function onCopySDL(key) {
    const ok = await copyText(sdlFor(key));
    if (ok) {
      setCopied(key);
      gaEvent("select_content", { content_type: "button", item_id: `copy_sdl_${key}` });
      setTimeout(() => setCopied(""), 1800);
    } else {
      alert("Could not copy to clipboard. Please try again.");
    }
  }

  return (
    <>
      <Head>
        <title>GPU SDLs — Indianode</title>
        <meta name="description" content="Provider-bound Akash SDLs for Whisper, Stable Diffusion, and LLaMA on Indianode." />
        <link rel="canonical" href="https://www.indianode.com/gpu" />
        <meta property="og:title" content="GPU SDLs — Indianode" />
        <meta property="og:description" content="Copy ready-to-use provider-bound Akash SDLs for GPU workloads." />
        <meta property="og:type" content="website" />
      </Head>

      <SiteChrome>
        {/* Hero (tight, matches compute spacing) */}
        <section className="max-w-6xl mx-auto px-4 pt-6 pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                Provider-bound GPU SDLs
              </h1>
              <p className="text-gray-600 mt-1 text-sm md:text-base">
                Ready Akash manifests bound to <span className="inline-block rounded-md px-2 py-0.5 bg-gray-100 font-mono text-xs">org: indianode</span>.
              </p>
            </div>
            <div className="hidden md:flex items-center gap-2 shrink-0">
              <Link href="/compute" className="text-sm px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50">
                CPU / Queue
              </Link>
              <Link href="/" className="text-sm px-3 py-2 rounded-xl bg-gray-900 text-white hover:bg-black">
                Home
              </Link>
            </div>
          </div>
        </section>

        {/* Cards (single-screen friendly) */}
        <section className="max-w-6xl mx-auto px-4 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {cards.map((c) => (
              <div
                key={c.key}
                className="group rounded-2xl border border-gray-200 bg-white p-5 flex flex-col h-full shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3">
                  <div className="text-2xl">{c.emoji}</div>
                  <div className="min-w-0">
                    <h2 className="text-base md:text-lg font-semibold leading-tight">{c.title}</h2>
                    <p className="text-xs text-gray-500">Bound to <span className="font-mono">org: indianode</span></p>
                  </div>
                </div>

                <p className="text-sm text-gray-600 mt-3">{c.blurb}</p>

                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={() => onCopySDL(c.key)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm hover:bg-emerald-700"
                    title="Copy provider-bound SDL to clipboard"
                  >
                    {copied === c.key ? "Copied ✓" : "Copy SDL"}
                  </button>

                  <details className="ml-auto text-xs text-gray-600">
                    <summary className="cursor-pointer select-none py-1 px-2 rounded-lg hover:bg-gray-50">
                      Preview
                    </summary>
                    <pre className="mt-2 p-3 bg-gray-900 text-gray-100 rounded-lg text-[11px] overflow-x-auto max-h-44">
{`${sdlFor(c.key)}`}
                    </pre>
                  </details>
                </div>
              </div>
            ))}
          </div>

          {/* Tiny hint to keep within one screen height */}
          <p className="text-xs text-gray-500 mt-2">
            Paste the SDL into your Akash manifest and deploy with your usual tooling.
          </p>
        </section>
      </SiteChrome>
    </>
  );
}
