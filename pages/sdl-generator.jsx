// pages/sdl-generator.jsx
import { useState, useMemo } from "react";
import Head from "next/head";
import Link from "next/link";

export default function SDLGenerator() {
  const [prompt, setPrompt] = useState(
    "Nginx static site. Public on port 80. One replica. Add 1Gi persistent volume mounted at /data."
  );
  const [loading, setLoading] = useState(false);
  const [sdl, setSdl] = useState("");
  const [err, setErr] = useState("");

  const sdlB64 = useMemo(() => {
    try {
      return btoa(unescape(encodeURIComponent(sdl)));
    } catch {
      return btoa(sdl || "");
    }
  }, [sdl]);

  async function generate() {
    setErr("");
    setSdl("");
    setLoading(true);
    try {
      const r = await fetch("/api/sdl/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "failed");
      setSdl(String(j.sdl || "").trim());
    } catch (e) {
      setErr(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Generate SDL from Plain English | Indianode</title>
        <meta
          name="description"
          content="Describe your service in plain words and generate an Akash SDL YAML automatically."
        />
        <link rel="canonical" href="https://www.indianode.com/sdl-generator" />
      </Head>

      <div className="min-h-screen bg-gray-50">
        <header className="px-4 py-3 bg-gray-900 text-white">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="font-semibold">Indianode</div>
            <nav className="text-xs space-x-3">
              <Link href="/" className="hover:underline">Home</Link>
              <Link href="/compute" className="hover:underline">Compute</Link>
              <Link href="/compute-sdl" className="hover:underline">Custom SDL</Link>
            </nav>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold">Plain-English → SDL Generator</h1>
          <p className="text-sm text-gray-600 mt-1">
            Tell us what you want to deploy (image, ports, storage, GPUs, env). We’ll turn it into YAML.
          </p>

          <div className="mt-4 grid md:grid-cols-2 gap-4">
            <div className="bg-white border rounded-2xl p-4 shadow">
              <label className="text-sm font-medium">Describe your service</label>
              <textarea
                rows={14}
                className="mt-2 w-full border rounded-xl px-3 py-2 text-sm"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Example: FastAPI app on port 8000, 1 GPU, 10Gi storage at /models, 2 vCPU, 4Gi RAM."
                disabled={loading}
              />
              <div className="mt-3 flex gap-2">
                <button
                  onClick={generate}
                  disabled={loading || !prompt.trim()}
                  className={`px-4 py-2 rounded-lg text-white ${loading ? "bg-gray-400" : "bg-indigo-600 hover:bg-indigo-700"}`}
                >
                  {loading ? "Generating…" : "Generate SDL"}
                </button>
                <button
                  onClick={() => setPrompt("")}
                  disabled={loading}
                  className="px-3 py-2 rounded-lg border"
                >
                  Clear
                </button>
              </div>
              {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
              <p className="mt-3 text-xs text-gray-500">
                We recommend reviewing the YAML and ports before running.
              </p>
            </div>

            <div className="bg-white border rounded-2xl p-4 shadow">
              <label className="text-sm font-medium">Generated SDL (YAML)</label>
              <textarea
                rows={14}
                readOnly
                className="mt-2 w-full border rounded-xl px-3 py-2 font-mono text-xs"
                value={sdl}
                placeholder="YAML will appear here…"
              />
              <div className="mt-3 flex gap-2">
                <button
                  onClick={async () => { try { await navigator.clipboard.writeText(sdl); } catch {} }}
                  disabled={!sdl}
                  className="px-3 py-2 rounded-lg border"
                >
                  Copy
                </button>
                <Link
                  href={sdl ? `/compute-sdl?sdl_b64=${encodeURIComponent(sdlB64)}` : "#"}
                  className={`px-3 py-2 rounded-lg text-white ${sdl ? "bg-emerald-600 hover:bg-emerald-700" : "bg-gray-400 pointer-events-none"}`}
                >
                  Use in Custom SDL Runner
                </Link>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Clicking “Use in Custom SDL Runner” opens the payment + run flow with this SDL prefilled.
              </p>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
