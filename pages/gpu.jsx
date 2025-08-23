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

// --- SDL factory (provider-bound, all distinct) ---
function sdlFor(key) {
  const header = (title) => `# Indianode provider-bound SDL — ${title}
# Bound to org: indianode
`;

  switch (key) {
    case "whisper":
      return `${header("Whisper (ASR)")}
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

    case "sd":
      return `${header("Stable Diffusion (WebUI)")}
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

    case "llama":
    default:
      return `${header("LLaMA Inference (llama.cpp server)")}
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
}

// Small helper: copy text → clipboard
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function GPUPage() {
  const cards = [
    {
      key: "whisper",
      emoji: "🎙️",
      title: "Whisper (ASR)",
      blurb: "Speech-to-text on GPU with whisper.cpp",
    },
    {
      key: "sd",
      emoji: "🎨",
      title: "Stable Diffusion",
      blurb: "Text-to-image (WebUI) on a single GPU",
    },
    {
      key: "llama",
      emoji: "🦙",
      title: "LLaMA Inference",
      blurb: "Serve LLMs via llama.cpp server",
    },
  ];

  const [copiedKey, setCopiedKey] = useState("");

  async function onCopySDL(key) {
    const sdl = sdlFor(key);
    const ok = await copyText(sdl);
    if (ok) {
      setCopiedKey(key);
      gaEvent("select_content", {
        content_type: "button",
        item_id: `copy_sdl_${key}`,
      });
      setTimeout(() => setCopiedKey(""), 2000);
    } else {
      alert("Could not copy. Please try again.");
    }
  }

  return (
    <>
      <Head>
        <title>GPU SDLs — Indianode</title>
        <meta
          name="description"
          content="Provider-bound Akash SDLs for Whisper, Stable Diffusion, and LLaMA on Indianode."
        />
        <link rel="canonical" href="https://www.indianode.com/gpu" />
        <meta property="og:title" content="GPU SDLs — Indianode" />
        <meta
          property="og:description"
          content="Copy ready-to-use provider-bound Akash SDLs for GPU workloads."
        />
        <meta property="og:type" content="website" />
      </Head>

      <SiteChrome>
        {/* Hero — compact, single-screen */}
        <section className="max-w-6xl mx-auto px-4 pt-6 pb-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                Provider-bound GPU SDLs
              </h1>
              <p className="text-gray-600 mt-1">
                Copy an Akash SDL pre-bound to <code className="px-1 py-0.5 rounded bg-gray-100">org: indianode</code>.
              </p>
            </div>
            <div className="hidden md:flex items-center gap-3">
              <Link
                href="/"
                className="text-sm px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50"
              >
                ← Back to Home
              </Link>
              <Link
                href="/compute"
                className="text-sm px-3 py-2 rounded-xl bg-gray-900 text-white hover:bg-black"
              >
                CPU / Queue
              </Link>
            </div>
          </div>
        </section>

        {/* Cards — tight grid, single-screen friendly */}
        <section className="max-w-6xl mx-auto px-4 pb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {cards.map((c) => (
              <div
                key={c.key}
                className="rounded-2xl border border-gray-200 bg-white p-5 flex flex-col"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="text-2xl">{c.emoji}</div>
                  <h2 className="text-lg font-semibold">{c.title}</h2>
                </div>
                <p className="text-sm text-gray-600 mb-4">{c.blurb}</p>

                <div className="mt-auto flex items-center gap-2">
                  <button
                    onClick={() => onCopySDL(c.key)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm hover:bg-emerald-700"
                    title="Copy provider-bound SDL to clipboard"
                  >
                    {copiedKey === c.key ? "Copied ✓" : "Copy SDL"}
                  </button>

                  <details className="ml-auto text-xs text-gray-600">
                    <summary className="cursor-pointer select-none py-1 px-2 rounded-lg hover:bg-gray-50">
                      Preview
                    </summary>
                    <pre className="mt-2 p-3 bg-gray-900 text-gray-100 rounded-lg text-[11px] overflow-x-auto max-h-56">
{`${sdlFor(c.key)}`}
                    </pre>
                  </details>
                </div>
              </div>
            ))}
          </div>

          {/* Small note — keep concise to fit one screen */}
          <p className="text-xs text-gray-500 mt-3">
            Tip: Paste the SDL into your Akash manifest file, then deploy with your preferred tooling.
          </p>
        </section>
      </SiteChrome>
    </>
  );
}
