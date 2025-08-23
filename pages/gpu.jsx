// pages/gpu.jsx
import { useState } from "react";
import Head from "next/head";
import SiteChrome from "../components/SiteChrome";

const SDLS = {
  whisper: `version: "2.0"
services:
  app:
    image: ghcr.io/indianode/whisper-cpp:cuda
    resources:
      cpu: { units: 4 }
      memory: { size: 16Gi }
      storage:
        - size: 5Gi
      gpu:
        units: 1
    expose:
      - port: 8080
        as: 80
        to:
          - global: true
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
          amount: 200
deployment:
  app:
    anywhere:
      profile: app
      count: 1`,

  sd: `version: "2.0"
services:
  app:
    image: ghcr.io/indianode/stable-diffusion-webui:cuda
    resources:
      cpu: { units: 8 }
      memory: { size: 16Gi }
      storage:
        - size: 20Gi
      gpu:
        units: 1
    expose:
      - port: 7860
        as: 80
        to:
          - global: true
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
          amount: 250
deployment:
  app:
    anywhere:
      profile: app
      count: 1`,

  llama: `version: "2.0"
services:
  app:
    image: ghcr.io/indianode/llama.cpp:server-cuda
    resources:
      cpu: { units: 6 }
      memory: { size: 16Gi }
      storage:
        - size: 10Gi
      gpu:
        units: 1
    expose:
      - port: 8080
        as: 80
        to:
          - global: true
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
          amount: 260
deployment:
  app:
    anywhere:
      profile: app
      count: 1`,
};

function Card({ icon, title, blurb, sdl }) {
  const [open, setOpen] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sdl);
      alert("SDL copied to clipboard.");
    } catch {
      alert("Copy failed. Select the text in Preview and copy manually.");
      setOpen(true);
    }
  };
  return (
    <div className="rounded-2xl bg-white shadow p-6 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="text-2xl">{icon}</div>
        <div>
          <div className="text-xl font-semibold">{title}</div>
          <div className="text-sm text-gray-500">Bound to org: <b>indianode</b></div>
        </div>
      </div>

      <p className="text-gray-700 text-sm leading-relaxed">{blurb}</p>

      <div className="flex items-center gap-4">
        <button
          onClick={copy}
          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          Copy SDL
        </button>
        <button
          onClick={() => setOpen(true)}
          className="text-gray-700 text-sm hover:underline"
        >
          ▶ Preview
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-[min(92vw,900px)] max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="font-semibold">{title} — SDL preview</div>
              <button
                className="px-2 py-1 rounded hover:bg-gray-100"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <pre className="p-4 text-xs overflow-auto bg-gray-50 leading-relaxed whitespace-pre">
{ sdl }
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GPU() {
  return (
    <>
      <Head>
        <title>GPU SDLs — Indianode</title>
        <meta
          name="description"
          content="Akash-ready GPU SDLs for Whisper, Stable Diffusion, and LLaMA, bound to org: indianode."
        />
      </Head>

      <SiteChrome>
        <div className="mx-auto max-w-6xl px-4 py-10">
          <header className="mb-8">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
              GPU SDLs (Whisper • SD • LLaMA)
            </h1>
            <p className="text-slate-300 mt-2">
              These manifests are <b>org: indianode</b> bound and ready to use on Akash.
            </p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card
              icon="🎙️"
              title="Whisper (ASR)"
              blurb="Speech-to-text with whisper.cpp, GPU-accelerated."
              sdl={SDLS.whisper}
            />
            <Card
              icon="🎨"
              title="Stable Diffusion"
              blurb="Text-to-image WebUI on GPU (CUDA build)."
              sdl={SDLS.sd}
            />
            <Card
              icon="🦙"
              title="LLaMA Inference"
              blurb="Serve LLMs via llama.cpp server on GPU."
              sdl={SDLS.llama}
            />
          </div>
        </div>
      </SiteChrome>
    </>
  );
}
