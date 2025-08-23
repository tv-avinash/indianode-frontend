// pages/compute.jsx
import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Script from "next/script";
import Link from "next/link";

// --- simple GA wrapper (safe if gtag not present) ---
const gaEvent = (name, params = {}) => {
  try { if (typeof window !== "undefined" && window.gtag) window.gtag("event", name, params); } catch {}
};

function Modal({ open, onClose, title = "Next steps", children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl mx-4 rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-lg">{title}</h3>
          <button onClick={onClose} className="rounded p-2 hover:bg-gray-100">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export default function Compute() {
  const [email, setEmail] = useState("");
  const [minutes, setMinutes] = useState(1);
  const [promo, setPromo] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const disabled = loading;

  // Modal after mint
  const [mintOpen, setMintOpen] = useState(false);
  const [mintCmd, setMintCmd] = useState("");
  const [mintToken, setMintToken] = useState("");

  const DEPLOYER_BASE = process.env.NEXT_PUBLIC_DEPLOYER_BASE || "";

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((j) => setBusy(j.status !== "available"))
      .catch(() => setBusy(false));
  }, []);

  const skuList = useMemo(
    () => [
      // CPU workers
      {
        sku: "cpu2x4",
        name: "CPU Worker • 2 vCPU • 4 Gi",
        base60: 60,
        sdlHref: "/api/sdl/cpu2x4", // optional
        akashLock: "org=indianode",
      },
      {
        sku: "cpu4x8",
        name: "CPU Worker • 4 vCPU • 8 Gi",
        base60: 120,
        sdlHref: "/api/sdl/cpu4x8",
        akashLock: "org=indianode",
      },
      {
        sku: "cpu8x16",
        name: "CPU Worker • 8 vCPU • 16 Gi",
        base60: 240,
        sdlHref: "/api/sdl/cpu8x16",
        akashLock: "org=indianode",
      },

      // Redis cache
      {
        sku: "redis4",
        name: "Redis Cache • 4 Gi",
        base60: 49,
        sdlHref: "/api/sdl/redis4",
        akashLock: "org=indianode",
      },
      {
        sku: "redis8",
        name: "Redis Cache • 8 Gi",
        base60: 89,
        sdlHref: "/api/sdl/redis8",
        akashLock: "org=indianode",
      },
      {
        sku: "redis16",
        name: "Redis Cache • 16 Gi",
        base60: 159,
        sdlHref: "/api/sdl/redis16",
        akashLock: "org=indianode",
      },
    ],
    []
  );

  const promoActive = /^(TRY|TRY10)$/i.test(String(promo || "").trim());

  function priceInr(base60, mins) {
    const m = Math.max(1, Number(mins || 1));
    let inr = Math.ceil((base60 / 60) * m);
    if (promoActive) inr = Math.max(1, inr - 5);
    return inr;
  }

  function buildRunCommand(token) {
    if (!DEPLOYER_BASE) return "missing_env_DEPLOYER_BASE";
    return `curl -fsSL ${DEPLOYER_BASE}/compute/run.sh | ORDER_TOKEN='${token}' bash`;
  }

  async function createComputeOrder({ sku, minutes, email, promo }) {
    const r = await fetch("/api/compute/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sku, minutes, email, promo }),
    });
    const j = await r.json();
    if (!r.ok || !j?.ok) throw new Error(j?.error || "order_failed");
    return j; // { ok:true, id, amount, currency }
  }

  async function mintAfterPayment({ paymentId, sku, minutes, email, promo }) {
    const r = await fetch("/api/compute/mint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId, sku, minutes, email, promo }),
    });
    const j = await r.json();
    if (!r.ok || !j?.token) throw new Error(j?.error || "no_token");
    return j; // { token }
  }

  async function payWithRazorpay({ sku, displayName }) {
    try {
      setLoading(true);

      const userEmail = (email || "").trim();
      const ord = await createComputeOrder({ sku, minutes, email: userEmail, promo });

      const opts = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_xxxxx",
        amount: ord.amount,
        currency: ord.currency || "INR",
        ...(ord.id ? { order_id: ord.id } : {}), // only pass order_id if real order exists
        name: "Indianode Cloud",
        description: `${displayName} (${minutes} min)`,
        prefill: userEmail ? { email: userEmail } : undefined,
        theme: { color: "#111827" },
        handler: async (resp) => {
          try {
            const paymentId = resp?.razorpay_payment_id || `dev_${Date.now()}`;
            const out = await mintAfterPayment({
              paymentId,
              sku,
              minutes,
              email: userEmail,
              promo,
            });
            const token = out.token;
            const cmd = buildRunCommand(token);
            setMintToken(token);
            setMintCmd(cmd);
            setMintOpen(true);
          } catch (e) {
            alert(e?.message || "Could not mint token");
          }
        },
      };

      const rzp = new window.Razorpay(opts);
      rzp.on("payment.failed", (e) =>
        alert(e?.error?.description || "Oops! Something went wrong.\nPayment Failed")
      );
      rzp.open();
    } catch (e) {
      alert(e?.message || "Payment init failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Indianode — CPU & RAM Services</title>
      </Head>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />

      <div className="min-h-screen bg-gray-50 text-gray-900">
        <header className="p-6 bg-gray-900 text-white text-center text-2xl font-bold">
          Indianode — CPU & RAM
        </header>

        <main className="p-6 max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <label className="flex flex-col">
              <span className="text-sm font-semibold mb-1">Email</span>
              <input
                type="email"
                className="border rounded-lg px-3 py-2"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="flex flex-col">
              <span className="text-sm font-semibold mb-1">Minutes</span>
              <input
                type="number"
                min="1"
                max="240"
                className="border rounded-lg px-3 py-2"
                value={minutes}
                onChange={(e) => setMinutes(Math.max(1, Number(e.target.value || 1)))}
              />
            </label>
            <label className="flex flex-col">
              <span className="text-sm font-semibold mb-1">Promo</span>
              <input
                className="border rounded-lg px-3 py-2"
                placeholder="TRY / TRY10"
                value={promo}
                onChange={(e) => setPromo(e.target.value)}
              />
            </label>
          </div>

          <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {skuList.map((item) => {
              const inr = priceInr(item.base60, minutes);
              return (
                <div key={item.sku} className="bg-white rounded-2xl shadow p-6 flex flex-col justify-between">
                  <div>
                    <h2 className="text-lg font-bold mb-1">{item.name}</h2>
                    <p className="text-gray-600 text-sm mb-3">lock: {item.akashLock}</p>
                    <p className="text-gray-800">
                      <span className="font-semibold">Price:</span> ₹{inr} <span className="text-xs">(base ₹{item.base60}/60m)</span>
                    </p>
                    {promoActive && (
                      <p className="text-xs text-green-700 mt-1">Includes promo: −₹5</p>
                    )}
                  </div>

                  <div className="grid gap-2 mt-4">
                    <button
                      className={`text-white px-4 py-2 rounded-xl ${
                        disabled ? "bg-gray-400 cursor-not-allowed" : "bg-slate-800 hover:bg-slate-900"
                      }`}
                      onClick={() => payWithRazorpay({ sku: item.sku, displayName: item.name })}
                      disabled={disabled}
                    >
                      Pay ₹{inr} • Razorpay (INR)
                    </button>

                    <div className="flex gap-2">
                      <a
                        href={item.sdlHref}
                        className="flex-1 text-center bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl"
                      >
                        Deploy on Akash (SDL)
                      </a>
                      <button
                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-900 px-4 py-2 rounded-xl"
                        onClick={() => {
                          navigator.clipboard.writeText(`# SDL for ${item.sku} — see docs`);
                        }}
                      >
                        Copy SDL
                      </button>
                    </div>

                    <p className="text-[11px] text-gray-500">
                      You’ll pay AKT when using SDLs (marketplace). Card payment is only for one-time jobs via our script.
                    </p>
                  </div>
                </div>
              );
            })}
          </section>
        </main>

        {/* Mint modal */}
        <Modal
          open={mintOpen}
          onClose={() => setMintOpen(false)}
          title="Payment verified — next steps"
        >
          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              Payment verified & a one-time <b>ORDER_TOKEN</b> was minted. Run the command below
              from any machine to redeem it and queue your job. <b>Do not</b> run it on your Akash host VM.
            </p>

            {!DEPLOYER_BASE && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                Set <code className="font-mono">NEXT_PUBLIC_DEPLOYER_BASE</code> in Vercel.
              </div>
            )}

            <div className="bg-gray-900 text-gray-100 rounded-xl p-3 font-mono text-xs overflow-x-auto">
              {mintCmd || "…"}
            </div>

            <div className="flex gap-2">
              <button
                className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl"
                onClick={async () => { try { await navigator.clipboard.writeText(mintCmd); } catch {} }}
              >
                Copy command
              </button>
              <button
                className="bg-gray-200 hover:bg-gray-300 text-gray-900 px-4 py-2 rounded-xl"
                onClick={async () => { try { await navigator.clipboard.writeText(mintToken); } catch {} }}
              >
                Copy token only
              </button>
            </div>
          </div>
        </Modal>

        <footer className="p-4 text-center text-sm text-gray-600">
          © {new Date().getFullYear()} Indianode
        </footer>
      </div>
    </>
  );
}
