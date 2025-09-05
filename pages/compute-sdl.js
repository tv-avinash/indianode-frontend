// pages/compute-sdl.js
import Head from "next/head";
import { useState } from "react";

export default function ComputeSDLPage() {
  const [sdl, setSdl] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [email, setEmail] = useState("");

  // parameters to bake into the command (only used to render instructions, not required by backend)
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [jobId, setJobId] = useState("");
  const [token, setToken] = useState("");
  const [cmdPosix, setCmdPosix] = useState("");
  const [cmdWin, setCmdWin] = useState("");
  const [step, setStep] = useState("form");

  // Build the copy-ready commands shown to the client (POSIX + Windows)
  function buildCommands(token, sdlText) {
    // Base64 (UTF-8 safe) – works in browsers
    const sdlB64 =
      typeof window !== "undefined"
        ? btoa(unescape(encodeURIComponent(sdlText)))
        : "";

    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : (process.env.PUBLIC_BASE || "https://www.indianode.com");

    const runUrl = `${origin}/api/compute/run-sdl.sh`;

    const posix = `export ORDER_TOKEN='${token}'
export SDL_B64='${sdlB64}'
curl -fsSL ${runUrl} | bash`;

    // Windows PowerShell: set env vars, then pipe to bash (Git-Bash or WSL bash in PATH)
    const win = `$env:ORDER_TOKEN='${token}'
$env:SDL_B64='${sdlB64}'
(Invoke-WebRequest -UseBasicParsing ${runUrl}).Content | bash`;

    return { posix, win };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      // 1) Create order
      const orderRes = await fetch("/api/compute/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku: "generic", minutes: Number(minutes) || 60 }),
      });
      const order = await orderRes.json();
      if (!order?.ok) throw new Error("Order failed");

      // 2) Mint token
      const payId = order?.id || "free-dev";
      const mintRes = await fetch("/api/compute/mint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: payId,
          sku: "generic",
          minutes: Number(minutes) || 60,
          email,
        }),
      });
      const mint = await mintRes.json();
      if (!mint?.ok || !mint?.token) throw new Error("Mint failed");
      setToken(mint.token);

      // 3) (OPTIONAL immediate server redeem)
      // We can redeem here for bookkeeping, but the "run-sdl.sh" script also calls redeem.
      // Keeping both is harmless; remove this call if you want the script to be the only redeemer.
      const redeemRes = await fetch("/api/compute/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: mint.token,
          sdl,                 // raw SDL
          sdlName: "custom-sdl",
          sdlNotes: "submitted via /compute-sdl",
        }),
      });
      const redeem = await redeemRes.json();
      if (!redeem?.ok || !redeem?.queued) {
        // Not fatal for the CLI flow; the script will redeem again with SDL_B64.
        // But we surface it in UI.
        console.warn("redeem response:", redeem);
      } else {
        setJobId(redeem.id || "");
      }

      // 4) Build commands like the Compute flow
      const { posix, win } = buildCommands(mint.token, sdl);
      setCmdPosix(posix);
      setCmdWin(win);
      setStep("ready");
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Head>
        <title>Deploy Custom SDL — Indianode</title>
        <meta
          name="description"
          content="Paste your own Akash SDL and deploy it using Indianode&#39;s compute flow. After submit, copy the ready command to run from your backend."
        />
        <link rel="canonical" href="https://www.indianode.com/compute-sdl" />
      </Head>

      <main className="max-w-4xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-semibold mb-4">Deploy Custom SDL</h1>

        {step === "form" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-gray-700">
              Paste your Akash <code>.yaml</code> SDL below. We&#39;ll queue it and
              show you a tokenized command (same style as our Compute page) that you can copy & run from your backend.
            </p>

            <div>
              <label className="block font-medium mb-1">SDL (YAML)</label>
              <textarea
                className="w-full border rounded p-3 font-mono text-sm"
                rows={18}
                value={sdl}
                onChange={(e) => setSdl(e.target.value)}
                placeholder={"services:\\n  web:\\n    image: nginx:alpine\\n..."}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block font-medium mb-1">Minutes</label>
                <input
                  type="number"
                  min="1"
                  className="w-full border rounded p-2"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block font-medium mb-1">Notify Email (optional)</label>
                <input
                  type="email"
                  className="w-full border rounded p-2"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
                disabled={busy || !sdl.trim()}
              >
                {busy ? "Submitting..." : "Submit & Get Command"}
              </button>
              {error && <span className="text-red-600 text-sm">{error}</span>}
            </div>
          </form>
        )}

        {step === "ready" && (
          <div className="space-y-4">
            <div className="p-4 border rounded bg-green-50">
              <p className="font-medium">Queued!</p>
              {jobId && (
                <p className="text-sm mt-1">
                  Job ID: <code>{jobId}</code>
                </p>
              )}
              <p className="text-sm mt-2">
                Token: <code className="break-all">{token}</code>
              </p>
              <p className="text-sm mt-3">
                Run one of the commands below. It sets <code>ORDER_TOKEN</code> and <code>SDL_B64</code>, then streams <code>/api/compute/run-sdl.sh</code> into bash — same pattern as our Compute flow.
              </p>
            </div>

            <div>
              <h2 className="font-semibold mb-1">Linux / macOS</h2>
              <pre className="bg-gray-900 text-gray-100 rounded p-3 text-xs overflow-x-auto">
{cmdPosix}
              </pre>
            </div>

            <div>
              <h2 className="font-semibold mb-1">Windows (PowerShell → bash)</h2>
              <pre className="bg-gray-900 text-gray-100 rounded p-3 text-xs overflow-x-auto">
{cmdWin}
              </pre>
              <p className="text-xs text-gray-600 mt-1">
                Requires <code>bash</code> in PATH (Git-Bash or WSL). If you want a pure PowerShell script, I can add it.
              </p>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
