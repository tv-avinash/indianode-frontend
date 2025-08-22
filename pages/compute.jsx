import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import Script from "next/script";

// GA helper (safe if gtag isn't ready)
const gaEvent = (name, params = {}) => {
  try {
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", name, params);
    }
  } catch {}
};

// Simple modal
function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl mx-4 rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-lg">{title || "Next steps"}</h3>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-gray-100">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export default function Compute() {
  // top-level status
  const [status, setStatus] = useState("checking...");
  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((j) => setStatus(j.status || "offline"))
      .catch(() => setStatus("offline"));
  }, []);
  const busy = status !== "available";

  // buyer inputs
  const [email, setEmail] = useState("");
  const [minutes, setMinutes] = useState(1);
  const [promo, setPromo] = useState("");

  // pricing helpers
  const PROMO_OFF_INR = 5;
  const promoCode = (promo || "").trim().toUpperCase();
  const promoActive = promoCode === "TRY" || promoCode === "TRY10";

  // plans (price60 = base ₹ per 60 minutes)
  const plans = useMemo(
    () => [
      { key: "cpu2x4", title: "CPU Worker • 2 vCPU • 4 Gi", price60: 60, cpu: 2, memGi: 4 },
      { key: "cpu4x8", title: "CPU Worker • 4 vCPU • 8 Gi", price60: 120, cpu: 4, memGi: 8 },
      { key: "cpu8x16", title: "CPU Worker • 8 vCPU • 16 Gi", price60: 240, cpu: 8, memGi: 16 },
      { key: "redis4", title: "Redis Cache • 4 Gi", price60: 49, cpu: 1, memGi: 4 },
      { key: "redis8", title: "Redis Cache • 8 Gi", price60: 89, cpu: 2, memGi: 8 },
      { key: "redis16", title: "Redis Cache • 16 Gi", price60: 159, cpu: 2, memGi: 16 },
    ],
    []
  );

  const priceInrFor = (p) => {
    const m = Math.max(1, Number(minutes || 1));
    let inr = Math.ceil((p.price60 / 60) * m);
    if (promoActive) inr = Math.max(1, inr - PROMO_OFF_INR);
    return inr;
  };

  // SDL helpers (locked to your org)
  const ATTR_KEY = "org";
  const ATTR_VAL = "indianode";
  const sdlFor = (p) => {
    const isRedis = p.key.startsWith("redis");
    return `version: "2.0"
services:
  app:
    image: ${isRedis ? "redis:7-alpine" : "ubuntu:22.04"}
    ${isRedis ? "" : `command: ["bash","-lc","sleep infinity"]`}
    resources:
      cpu: { units: ${p.cpu} }
      memory: { size: ${p.memGi}Gi }
      storage:
        - size: 2Gi
profiles:
  compute:
    app: {}
  placement:
    anywhere:
      attributes:
        ${ATTR_KEY}: ${ATTR_VAL}
      pricing:
        app:
          denom: uakt
          amount: 50
deployment:
  app:
    anywhere:
      profile: app
      count: 1
`;
  };

  // Modal (post-payment)
  const [mintOpen, setMintOpen] = useState(false);
  const [mintCmd, setMintCmd] = useState("");
  const [mintToken, setMintToken] = useState("");
  const DEPLOYER_BASE = process.env.NEXT_PUBLIC_DEPLOYER_BASE || "";

  const buildRunCommand = (tok) =>
    DEPLOYER_BASE
      ? `curl -fsSL ${DEPLOYER_BASE}/compute/run.sh | ORDER_TOKEN='${tok}' bash`
      : "missing_env_DEPLOYER_BASE";

  // Payments
  const [loading, setLoading] = useState(false);

  async function createOrder({ product }) {
    const r = await fetch("/api/compute/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product,
        minutes: Number(minutes),
        userEmail: (email || "").trim(),
        promo: promoCode,
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error || "order_failed");
    return j;
  }

  async function mintToken({ paymentId, product }) {
    const r = await fetch("/api/compute/mint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentId,
        product,
        minutes: Number(minutes),
        email: (email || "").trim(),
        promo: promoCode,
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error || "mint_failed");
    return j; // { token }
  }

  async function payWithRazorpay(p) {
    try {
      setLoading(true);
      const order = await createOrder({ product: p.key });

      // GA
      gaEvent("begin_checkout", {
        value: Number((order.amount || 0) / 100),
        currency: order.currency || "INR",
        items: [{ item_id: p.key, item_name: p.title, item_category: "compute" }],
        minutes: Number(minutes),
        payment_method: "razorpay",
      });

      const rz = new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_xxxxxx",
        amount: order.amount,
        currency: order.currency,
        order_id: order.id,
        name: "Indianode Compute",
        description: `${p.title} (${minutes} min)`,
        prefill: email ? { email } : undefined,
        notes: { product: p.key, minutes: String(minutes), email },
        handler: async (resp) => {
          try {
            const minted = await mintToken({ paymentId: resp.razorpay_payment_id, product: p.key });
            const tok = minted?.token;
            if (!tok) throw new Error("no_token");
            setMintToken(tok);
            setMintCmd(buildRunCommand(tok));
            setMintOpen(true);

            gaEvent("purchase", {
              transaction_id: resp.razorpay_payment_id,
              value: Number((order.amount || 0) / 100),
              currency: order.currency || "INR",
              items: [{ item_id: p.key, item_name: p.title, item_category: "compute" }],
              minutes: Number(minutes),
              payment_method: "razorpay",
            });
          } catch (e) {
            alert(e.message || "token_mint_failed");
          }
        },
      });

      rz.on("payment.failed", (e) => alert(e?.error?.description || "Payment failed"));
      rz.open();
    } catch (e) {
      alert(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Indianode — CPU & RAM Services</title>
        <meta name="description" content="Use Akash-locked SDLs or pay for one-time CPU/RAM jobs. Monetize idle cores and memory." />
        <link rel="canonical" href="https://www.indianode.com/compute" />
      </Head>

      <Script src="https://checkout.razorpay.com/v1/checkout.js" />

      <div className="min-h-screen bg-gray-50 text-gray-900">
        <header className="px-6 py-4 bg-gray-900 text-white flex items-center justify-between">
          <div className="font-bold text-lg">Indianode — CPU & RAM</div>
          <div
            className={`text-xs px-2 py-1 rounded ${busy ? "bg-amber-500" : "bg-emerald-600"}`}
            title="GPU status from /api/status"
          >
            {busy ? "GPU busy" : "GPU available"}
          </div>
        </header>

        <main className="max-w-6xl mx-auto p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="text-sm">
              Use our <b>Akash-locked SDLs</b> or pay to get a <b>one-time token</b> & run via our script.
            </div>
            <Link href="/storage" className="inline-flex items-center bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-3 py-2">
              Need same-host NVMe? Storage →
            </Link>
          </div>

          {/* controls */}
          <div className="grid md:grid-cols-3 gap-3 mb-6">
            <input
              type="email"
              placeholder="you@example.com"
              className="border rounded-lg px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              type="number"
              min="1"
              value={minutes}
              className="border rounded-lg px-3 py-2"
              onChange={(e) => setMinutes(Math.max(1, Number(e.target.value || 1)))}
            />
            <input
              placeholder="TRY / TRY10"
              className="border rounded-lg px-3 py-2"
              value={promo}
              onChange={(e) => setPromo(e.target.value)}
            />
          </div>

          <h2 className="text-lg font-semibold mb-2">CPU Workers</h2>
          <div className="grid md:grid-cols-3 gap-5">
            {plans.slice(0, 3).map((p) => (
              <div key={p.key} className="bg-white rounded-2xl shadow p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold">{p.title}</h3>
                  <span className="text-[11px] text-emerald-700">lock: {ATTR_KEY}={ATTR_VAL}</span>
                </div>
                <div className="mt-2 text-sm text-gray-700">
                  Price: ₹{priceInrFor(p)}{" "}
                  <span className="text-gray-500"> (base ₹{p.price60}/60m)</span>
                </div>

                <button
                  className="w-full mt-4 bg-slate-400/60 text-white rounded-xl px-3 py-2 hover:bg-slate-500 disabled:opacity-60"
                  onClick={() => payWithRazorpay(p)}
                  disabled={loading}
                >
                  Pay ₹{priceInrFor(p)} • Razorpay (INR)
                </button>

                <div className="grid grid-cols-2 gap-3 mt-3">
                  <a
                    className="text-center bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-3 py-2"
                    download={`${p.key}.yaml`}
                    href={`data:text/yaml;charset=utf-8,${encodeURIComponent(sdlFor(p))}`}
                    onClick={() => gaEvent("select_content", { item_id: `dl_sdl_${p.key}` })}
                  >
                    Deploy on Akash (SDL)
                  </a>
                  <button
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl px-3 py-2"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(sdlFor(p));
                      } catch {}
                    }}
                  >
                    Copy SDL
                  </button>
                </div>
              </div>
            ))}
          </div>

          <h2 className="text-lg font-semibold mt-8 mb-2">RAM Cache (Redis)</h2>
          <div className="grid md:grid-cols-3 gap-5">
            {plans.slice(3).map((p) => (
              <div key={p.key} className="bg-white rounded-2xl shadow p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold">{p.title}</h3>
                  <span className="text-[11px] text-emerald-700">lock: {ATTR_KEY}={ATTR_VAL}</span>
                </div>
                <div className="mt-2 text-sm text-gray-700">
                  Price: ₹{priceInrFor(p)}{" "}
                  <span className="text-gray-500"> (base ₹{p.price60}/60m)</span>
                </div>

                <button
                  className="w-full mt-4 bg-slate-400/60 text-white rounded-xl px-3 py-2 hover:bg-slate-500 disabled:opacity-60"
                  onClick={() => payWithRazorpay(p)}
                  disabled={loading}
                >
                  Pay ₹{priceInrFor(p)} • Razorpay (INR)
                </button>

                <div className="grid grid-cols-2 gap-3 mt-3">
                  <a
                    className="text-center bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-3 py-2"
                    download={`${p.key}.yaml`}
                    href={`data:text/yaml;charset=utf-8,${encodeURIComponent(sdlFor(p))}`}
                    onClick={() => gaEvent("select_content", { item_id: `dl_sdl_${p.key}` })}
                  >
                    Deploy on Akash (SDL)
                  </a>
                  <button
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl px-3 py-2"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(sdlFor(p));
                      } catch {}
                    }}
                  >
                    Copy SDL
                  </button>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-6 text-center text-xs text-gray-600">
            You’ll pay AKT when using the SDLs (marketplace). The card payment is only for one-time jobs via our script.
          </p>
        </main>

        <footer className="px-6 py-3 text-center text-xs text-gray-500">
          © {new Date().getFullYear()} Indianode •{" "}
          <Link href="/" className="text-blue-600 hover:underline">Home</Link>
        </footer>
      </div>

      {/* Post-payment modal */}
      <Modal open={mintOpen} onClose={() => setMintOpen(false)} title="Payment verified — next steps">
        <p className="text-sm text-gray-700">
          A one-time <b>ORDER_TOKEN</b> was minted. Run this command from any machine to redeem it and queue your job.
          <b> Do not</b> run it on your Akash host VM.
        </p>

        {!DEPLOYER_BASE && (
          <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            Set <code className="font-mono">NEXT_PUBLIC_DEPLOYER_BASE</code> in Vercel.
          </div>
        )}

        <div className="mt-3 bg-gray-900 text-gray-100 rounded-xl p-3 font-mono text-xs overflow-x-auto">
          {mintCmd || "…"}
        </div>

        <div className="mt-3 flex gap-2">
          <button
            className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl"
            onClick={async () => {
              try { await navigator.clipboard.writeText(mintCmd); } catch {}
            }}
          >
            Copy command
          </button>
          <button
            className="bg-gray-200 hover:bg-gray-300 text-gray-900 px-4 py-2 rounded-xl"
            onClick={async () => {
              try { await navigator.clipboard.writeText(mintToken); } catch {}
            }}
          >
            Copy token only
          </button>
        </div>
      </Modal>
    </>
  );
}
