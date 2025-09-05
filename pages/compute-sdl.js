// pages/compute-sdl.js
import Head from "next/head";
import { useState } from "react";

export default function ComputeSDLPage() {
  const [sdl, setSdl] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("form");
  const [token, setToken] = useState("");
  const [jobId, setJobId] = useState("");
  const [error, setError] = useState("");

  async function createTokenAndQueue(e) {
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

      // 2) Mint a token
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

      // 3) Redeem & queue with SDL payload
      const redeemRes = await fetch("/api/compute/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: mint.token,
          sdl,
          sdlName: "custom-sdl",
          sdlNotes: "submitted via /compute-sdl",
        }),
      });
      const redeem = await redeemRes.json();
      if (!redeem?.ok || !redeem?.queued) throw new Error("Redeem failed");
      setJobId(redeem.id);
      setStep("queued");
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
          content="Paste your own Akash SDL and deploy it using Indianode&#39;s compute queue."
        />
        <link rel="canonical" href="https://www.indianode.com/compute-sdl" />
      </Head>

      <main className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-semibold mb-4">Deploy Custom SDL</h1>
        <p className="text-gray-700 mb-6">
          Paste your Akash <code>.yaml</code> SDL below. We&#39;ll enqueue it as a
          compute task. Your worker can pick it and deploy with the Akash CLI.
        </p>

        {step === "form" && (
          <form onSubmit={createTokenAndQueue} className="space-y-4">
            <div>
              <label className="block font-medium mb-1">SDL (YAML)</label>
              <textarea
                className="w-full border rounded p-3 font-mono text-sm"
                rows={16}
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
                <label className="block font-medium mb-1">
                  Notify Email (optional)
                </label>
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
                {busy ? "Submitting..." : "Queue Deployment"}
              </button>
              {error && <span className="text-red-600 text-sm">{error}</span>}
            </div>
          </form>
        )}

        {step === "queued" && (
          <div className="p-4 border rounded bg-green-50">
            <p className="font-medium">Queued!</p>
            <p className="text-sm mt-1">
              Job ID: <code>{jobId}</code>
            </p>
            <p className="text-sm mt-2">
              Token: <code className="break-all">{token}</code>
            </p>
            <p className="text-sm mt-3">
              Your worker should call <code>/api/compute/pick</code> and will
              receive the job with <code>payload.kind = &#39;akash-sdl&#39;</code> and
              your SDL under <code>payload.sdl</code>.
            </p>
          </div>
        )}
      </main>
    </>
  );
}
