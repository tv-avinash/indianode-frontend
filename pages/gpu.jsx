// pages/gpu.jsx
import { useState } from "react";
import Head from "next/head";
import SiteChrome from "../components/SiteChrome";

// Safe GA helper
const gaEvent = (name, params = {}) => {
  try {
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", name, params);
    }
  } catch {}
};

// --- Provider-bound SDLs (distinct for each) ---
function sdlFor(key) {
  const prefix = (title) =>
    `# Indianode provider-bound SDL — ${title}
# Bound to org: indianode
`;

  switch (key) {
    case "whisper":
      return `${prefix("Whisper (ASR)")}
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
      return `${prefix("Stable Diffusion (WebUI)")}
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
    default: // llama
      return `${prefix("LLaMA Inference (llama.cpp server)")}
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

// Clipboard helper
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
  const [copiedKey, setCopiedKey] = useState("");

  const cards = [
    {
      key: "whisper",
      emoji: "🎙️",
      title: "Whisper (ASR)",
      blurb: "Speech-to-text with whisper.cpp, GPU-accelerated.",
    },
    {
      key: "sd",
      emoji: "🎨",
      title: "Stable Diffusion",
      blurb: "Text-to-image WebUI on GPU (CUDA build).",
    },
    {
      key: "llama",
      emoji: "🦙",
      title: "LLaMA Inference",
      blurb: "Serve LLMs via llama.cpp server on GPU.",
    },
  ];

  async function onCopy(key) {
    const ok = await copyText(sdlFor(key));
    if (ok) {
      setCopiedKey(key);
      gaEvent("select_content", {
        content_type: "button",
        item_id: `copy_sdl_${key}`,
      });
      setTimeout(() => setCopiedKey(""), 1800);
    } else {
      alert("Could not copy to clipboard. Please try again.");
    }
  }

  return (
    <>
      <Head>
        <title>GPU SDLs — Indianode</title>
        <meta
          name="description"
          content="Ready, provider-bound Akash SDLs for Whisper, Stable Diffusion, and LLaMA on Indianode."
        />
        <link rel="canonical" href="https://www.indianode.com/gpu" />
        <meta property="og:title" content="GPU SDLs — Indianode" />
        <meta
          property="og:description"
          content="Copy provider-bound Akash manifests for GPU workloads."
        />
        <meta property="og:type" content="website" />
      </Head>

      <SiteChrome>
        <main className="max-w-6xl mx-auto px-6 py-8">
          <header className="mb-6">
            <h1 className="text-3xl font-bold">GPU SDLs (Whisper • SD • LLaMA)</h1>
            <p className="text-gray-600 mt-2">
              These manifests are <span className="font-mono">org: indianode</span> bound and ready to use on Akash.
            </p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {cards.map((c) => (
              <div
                key={c.key}
                className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="text-3xl">{c.emoji}</div>
                  <div>
                    <h2 className="text-xl font-semibold">{c.title}</h2>
                    <p className="text-sm text-gray-500">
                      Bound to <span className="font-mono">org: indianode</span>
                    </p>
                  </div>
                </div>

                <p className="text-gray-700 mt-3">{c.blurb}</p>

                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={() => onCopy(c.key)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    {copiedKey === c.key ? "Copied ✓" : "Copy SDL"}
                  </button>

                  <details className="ml-auto text-sm text-gray-600">
                    <summary className="cursor-pointer select-none py-1 px-2 rounded-lg hover:bg-gray-50">
                      Preview
                    </summary>
                    <pre className="mt-2 p-3 bg-gray-900 text-gray-100 rounded-lg text-xs overflow-x-auto">
{`${sdlFor(c.key)}`}
                    </pre>
                  </details>
                </div>
              </div>
            ))}
          </div>
        </main>
      </SiteChrome>
    </>
  );
}
