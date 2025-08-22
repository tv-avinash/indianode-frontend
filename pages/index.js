// pages/index.js
import { useState, useEffect, useMemo } from "react";
import Script from "next/script";
import Head from "next/head";
import Link from "next/link";

// GA helper: safe no-op if gtag isn't ready
const gaEvent = (name, params = {}) => {
  try {
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", name, params);
    }
  } catch {}
};

// Lightweight modal
function Modal({ open, onClose, children, title = "Next steps" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl mx-3 rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h3 className="font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-gray-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export default function Home() {
  const [status, setStatus] = useState("checking...");
  const [loading, setLoading] = useState(false);

  // Buyer inputs
  const [email, setEmail] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [promo, setPromo] = useState("");

  // Waitlist + banners
  const [interest, setInterest] = useState("sd");
  const [wlMsg, setWlMsg] = useState("");
  const [msg, setMsg] = useState("");

  // Toggles
  const enablePayPal =
    String(process.env.NEXT_PUBLIC_ENABLE_PAYPAL || "0") === "1";
  const SHOW_AKASH_HERO =
    String(process.env.NEXT_PUBLIC_SHOW_AKASH || "1") === "1";

  // FX (INR->USD)
  const [fx, setFx] = useState(0.012);
  useEffect(() => {
    fetch("/api/fx")
      .then((r) => r.json())
      .then((j) => setFx(Number(j.rate) || 0.012))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/status")
      .then((res) => res.json())
      .then((data) => setStatus(data.status || "offline"))
      .catch(() => setStatus("offline"));
  }, []);

  const busy = status !== "available";
  const disabled = loading;

  // “Price for 60 minutes” base (₹)
  const price60 = { whisper: 100, sd: 200, llama: 300 };

  // Promo: TRY / TRY10 => ₹5 off
  const PROMO_OFF_INR = 5;
  const promoCode = (promo || "").trim().toUpperCase();
  const promoActive = promoCode === "TRY" || promoCode === "TRY10";

  // Pricing helpers
  function priceInrFor(key, mins) {
    const base = price60[key];
    if (!base) return 0;
    const m = Math.max(1, Number(mins || 60));
    let total = Math.ceil((base / 60) * m);
    if (promoActive) total = Math.max(1, total - PROMO_OFF_INR);
    return total;
  }
  function priceUsdFromInr(inr) {
    const val = inr * fx;
    return Math.round((val + Number.EPSILON) * 100) / 100; // 2dp
  }

  const templates = useMemo(
    () => [
      { key: "whisper", name: "Whisper ASR", desc: "Speech-to-text on GPU" },
      { key: "sd", name: "Stable Diffusion", desc: "Text-to-Image AI" },
      { key: "llama", name: "LLaMA Inference", desc: "Run an LLM on GPU" },
    ],
    []
  );

  // --- Minting modal ---
  const [mintOpen, setMintOpen] = useState(false);
  const [mintCmd, setMintCmd] = useState("");
  const [mintToken, setMintToken] = useState("");
  const DEPLOYER_BASE = process.env.NEXT_PUBLIC_DEPLOYER_BASE || "";
  function buildRunCommand(token) {
    if (!DEPLOYER_BASE) return "missing_env_DEPLOYER_BASE";
    return `curl -fsSL ${DEPLOYER_BASE}/gpu/run.sh | ORDER_TOKEN='${token}' bash`;
  }

  // --- API helpers ---
  async function createRazorpayOrder({ product, minutes, userEmail }) {
    const r = await fetch("/api/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product, minutes, userEmail, promo }),
    });
    const data = await r.json();
    if (!r.ok) {
      if (r.status === 409 && data?.error === "gpu_busy") {
        throw new Error("GPU is busy. Please try again later.");
      }
      throw new Error(data?.error || "Order creation failed");
    }
    return data;
  }

  async function mintAfterPayment({ paymentId, productKey, minutes, email, promo }) {
    const r = await fetch("/api/gpu/mint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentId,
        product: productKey,
        minutes: Number(minutes),
        email: (email || "").trim(),
        promo: (promo || "").trim(),
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error || "token_mint_failed");
    return j;
  }

  async function payWithRazorpay({ product, displayName }) {
    try {
      setMsg("");
      setLoading(true);
      const userEmail = (email || "").trim();
      if (!userEmail) {
        setMsg("Tip: add your email so we can send your deploy URL + receipt.");
      }

      const order = await createRazorpayOrder({ product, minutes, userEmail });

      const valueInr = Number(((order.amount || 0) / 100).toFixed(2));
      gaEvent("begin_checkout", {
        value: valueInr,
        currency: order.currency || "INR",
        coupon: promoCode || undefined,
        items: [
          {
            item_id: product,
            item_name: displayName,
            item_category: "gpu",
            quantity: 1,
            price: valueInr,
          },
        ],
        minutes: Number(minutes),
        payment_method: "razorpay",
      });

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_xxxxxx",
        amount: order.amount,
        currency: order.currency,
        order_id: order.id,
        name: "Indianode Cloud",
        description: `Deployment for ${displayName} (${minutes} min)`,
        prefill: userEmail ? { email: userEmail } : undefined,
        notes: {
          minutes: String(minutes),
          product,
          email: userEmail,
          promo: promoCode,
        },
        theme: { color: "#111827" },
        handler: async function (response) {
          try {
            const result = await mintAfterPayment({
              paymentId: response.razorpay_payment_id,
              productKey: product,
              minutes,
              email: userEmail,
              promo,
            });
            const token = result?.token || "";
            if (!token) throw new Error("no_token");
            const cmd = buildRunCommand(token);
            setMintToken(token);
            setMintCmd(cmd);
            setMintOpen(true);

            gaEvent("purchase", {
              transaction_id: response.razorpay_payment_id,
              value: valueInr,
              currency: order.currency || "INR",
              coupon: promoCode || undefined,
              items: [
                {
                  item_id: product,
                  item_name: displayName,
                  item_category: "gpu",
                  quantity: 1,
                  price: valueInr,
                },
              ],
              minutes: Number(minutes),
              payment_method: "razorpay",
            });
          } catch (e) {
            alert("Could not mint ORDER_TOKEN (" + (e.message || "token_mint_failed") + ")");
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (resp) =>
        alert(resp?.error?.description || "Payment failed")
      );
      rzp.open();
    } catch (e) {
      alert(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function payWithPayPal({ product, amountUsd }) {
    try {
      setLoading(true);
      const r = await fetch("/api/paypal/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product, minutes, amountUsd }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "paypal_create_failed");

      const valueUsd = Number(Number(amountUsd || 0).toFixed(2));
      gaEvent("begin_checkout", {
        value: valueUsd,
        currency: "USD",
        coupon: promoCode || undefined,
        items: [
          {
            item_id: product,
            item_name: product,
            item_category: "gpu",
            quantity: 1,
            price: valueUsd,
          },
        ],
        minutes: Number(minutes),
        payment_method: "paypal",
      });

      window.location.href = j.approveUrl;
    } catch (e) {
      alert(e.message || "PayPal error");
    } finally {
      setLoading(false);
    }
  }

  async function joinWaitlist() {
    setWlMsg("");
    try {
      const r = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          product: interest,
          minutes,
          note: promoActive ? `Promo ${promoCode} user` : "",
        }),
      });
      if (!r.ok) throw new Error("waitlist_failed");
      setWlMsg("Thanks! We’ll email you as soon as the GPU is free.");
      gaEvent("generate_lead", {
        method: "waitlist",
        product: interest,
        minutes: Number(minutes),
        coupon: promoCode || undefined,
      });
    } catch {
      setWlMsg("Could not join waitlist. Please try again.");
    }
  }

  return (
    <>
      <Head>
        <title>Indianode — GPU Hosting for SDLS, Whisper & LLM on RTX 3090</title>
        <meta
          name="description"
          content="Run SDLS, Whisper, and LLM inference on NVIDIA RTX 3090 (24GB). Affordable pay-per-minute GPU hosting for AI developers worldwide."
        />
        <link rel="canonical" href="https://www.indianode.com/" />
        <meta property="og:title" content="Indianode — GPU Hosting on RTX 3090" />
        <meta property="og:description" content="GPU hosting for SDLS, Whisper, and LLM workloads on 24GB RTX 3090." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.indianode.com/" />
        <meta name="twitter:card" content="summary_large_image" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Indianode",
              url: "https://www.indianode.com",
              logo: "https://www.indianode.com/logo.png",
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Indianode",
              url: "https://www.indianode.com",
              potentialAction: {
                "@type": "SearchAction",
                target: "https://www.indianode.com/?q={search_term_string}",
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />
      </Head>

      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white text-gray-900">
        <Script src="https://checkout.razorpay.com/v1/checkout.js" />

        {/* Top bar */}
        <header className="px-5 py-3 bg-gray-900 text-white">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="font-bold">Indianode GPU Cloud</div>
            <div
              className={`text-xs px-2 py-1 rounded ${
                busy ? "bg-amber-500" : "bg-emerald-600"
              }`}
              title="GPU status from /api/status"
            >
              {busy ? "GPU busy" : "GPU available"}
            </div>
          </div>
        </header>

        {/* Main — optimized to fit in one screen on laptops */}
        <main className="max-w-6xl mx-auto px-5 pt-5 pb-4">
          {/* Slim hero: storage + Akash SDLs */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/storage"
              className="inline-flex items-center gap-2 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-sm shadow"
              title="Same-host NVMe for your Akash lease"
            >
              Explore Storage (200 Gi / 500 Gi / 1 TiB)
            </Link>

            {SHOW_AKASH_HERO && (
              <div
                className={`flex flex-wrap items-center gap-2 rounded-full px-2 py-2 text-sm ${
                  busy
                    ? "bg-amber-50 border border-amber-200 text-amber-900"
                    : "bg-emerald-50 border border-emerald-200 text-emerald-900"
                }`}
              >
                <span className="px-2 hidden sm:inline">
                  {busy ? "Deploy via Akash — we’ll queue you" : "Deploy now on Akash"}
                </span>
                <Link href="/whisper-gpu" className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5">
                  Whisper (SDL)
                </Link>
                <Link href="/sdls" className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5">
                  Stable Diffusion (SDL)
                </Link>
                <Link href="/llm-hosting" className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5">
                  LLaMA (SDL)
                </Link>
              </div>
            )}
          </div>

          {/* Compact inputs row */}
          <div className="mt-4 bg-white/70 backdrop-blur rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="flex items-center gap-2">
                <span className="text-xs font-semibold w-28">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="flex-1 border rounded-lg px-3 py-2 text-sm"
                  disabled={loading}
                />
              </label>

              <label className="flex items-center gap-2">
                <span className="text-xs font-semibold w-28">Minutes</span>
                <input
                  type="number"
                  min="1"
                  max="240"
                  value={minutes}
                  onChange={(e) =>
                    setMinutes(Math.max(1, Number(e.target.value || 1)))
                  }
                  className="flex-1 border rounded-lg px-3 py-2 text-sm"
                  disabled={loading}
                />
              </label>

              <label className="flex items-center gap-2">
                <span className="text-xs font-semibold w-28">Promo code</span>
                <input
                  value={promo}
                  onChange={(e) => setPromo(e.target.value)}
                  placeholder="TRY / TRY10"
                  className="flex-1 border rounded-lg px-3 py-2 text-sm"
                  disabled={loading}
                />
              </label>
            </div>

            {busy && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="text-xs text-amber-900 mb-2">
                  GPU is busy. Pay now (we’ll queue it) or join the waitlist:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label className="flex items-center gap-2">
                    <span className="text-xs font-semibold w-20">Email</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="flex-1 border rounded-lg px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="text-xs font-semibold w-20">Interest</span>
                    <select
                      value={interest}
                      onChange={(e) => setInterest(e.target.value)}
                      className="flex-1 border rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="sd">Stable Diffusion</option>
                      <option value="whisper">Whisper ASR</option>
                      <option value="llama">LLaMA Inference</option>
                    </select>
                  </label>
                  <button
                    onClick={joinWaitlist}
                    className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-sm"
                  >
                    Notify me
                  </button>
                </div>
                {wlMsg && (
                  <div className="text-[11px] text-gray-700 mt-2">{wlMsg}</div>
                )}
              </div>
            )}

            {msg && (
              <div className="mt-3 text-center text-xs text-amber-700 bg-amber-100 border border-amber-200 rounded-xl px-3 py-2">
                {msg}
              </div>
            )}
          </div>

          {/* Product row — compact cards */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            {templates.map((t) => {
              const inr = priceInrFor(t.key, minutes);
              const usd = priceUsdFromInr(inr);
              const offInr = promoActive ? PROMO_OFF_INR : 0;
              const offUsd = promoActive ? priceUsdFromInr(PROMO_OFF_INR) : 0;

              return (
                <div
                  key={t.key}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col justify-between"
                >
                  <div>
                    <h2 className="text-lg font-bold">{t.name}</h2>
                    <p className="text-sm text-gray-600 mt-1">{t.desc}</p>

                    <div className="mt-2 text-sm">
                      <span className="font-semibold">Price:</span>{" "}
                      ₹{inr} / ${usd.toFixed(2)}
                    </div>

                    {promoActive && (
                      <div className="text-[11px] text-green-700 mt-1">
                        Includes promo −₹{offInr} (≈${offUsd.toFixed(2)})
                      </div>
                    )}

                    <div className="text-[11px] text-gray-500">
                      Base ₹{price60[t.key]} / 60 min
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2">
                    <button
                      className={`text-white px-4 py-2 rounded-xl text-sm ${
                        disabled
                          ? "bg-gray-400 cursor-not-allowed"
                          : "bg-indigo-600 hover:bg-indigo-700"
                      }`}
                      onClick={() =>
                        payWithRazorpay({ product: t.key, displayName: t.name })
                      }
                      disabled={disabled}
                    >
                      Pay ₹{inr} • Razorpay (INR)
                    </button>

                    {enablePayPal && (
                      <button
                        className={`text-white px-4 py-2 rounded-xl text-sm ${
                          disabled
                            ? "bg-gray-400 cursor-not-allowed"
                            : "bg-slate-700 hover:bg-slate-800"
                        }`}
                        onClick={() =>
                          payWithPayPal({ product: t.key, amountUsd: usd })
                        }
                        disabled={disabled}
                      >
                        Pay ${usd.toFixed(2)} • PayPal (USD)
                      </button>
                    )}

                    <p className="text-[10px] text-gray-500">
                      INR billed via Razorpay. USD is approximate. Prefer Akash?
                      Use SDL buttons at top.
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </main>

        {/* Ultra-slim footer to keep above the fold */}
        <footer className="px-5 py-3 text-center text-[12px] text-gray-600 border-t">
          <div className="mb-1">
            <Link href="/whisper-gpu" className="text-blue-600 hover:underline mx-2">
              Whisper
            </Link>
            <Link href="/sdls" className="text-blue-600 hover:underline mx-2">
              SDLS
            </Link>
            <Link href="/llm-hosting" className="text-blue-600 hover:underline mx-2">
              LLM
            </Link>
            <Link href="/storage" className="text-blue-600 hover:underline mx-2">
              Storage
            </Link>
          </div>
          <div>
            Contact:{" "}
            <a href="mailto:tvavinash@gmail.com" className="text-blue-600 hover:underline">
              tvavinash@gmail.com
            </a>{" "}
            •{" "}
            <a href="tel:+919902818004" className="text-blue-600 hover:underline">
              +91 99028 18004
            </a>{" "}
            • © {new Date().getFullYear()} Indianode
          </div>
        </footer>
      </div>

      {/* Mint modal (command only) */}
      <Modal
        open={mintOpen}
        onClose={() => setMintOpen(false)}
        title="Payment verified — next steps"
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            A one-time <b>ORDER_TOKEN</b> was minted. Run the command below from
            any machine to redeem it and queue your job. <b>Do not</b> run it on
            your Akash host VM.
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
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(mintCmd);
                } catch {}
              }}
            >
              Copy command
            </button>
            <button
              className="bg-gray-200 hover:bg-gray-300 text-gray-900 px-4 py-2 rounded-xl"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(mintToken);
                } catch {}
              }}
            >
              Copy token only
            </button>
          </div>

          <details className="text-xs text-gray-600">
            <summary className="cursor-pointer font-semibold">
              What about time limits?
            </summary>
            <p className="mt-1">
              Your token encodes product + minutes purchased. Our server
              enforces duration (stops the container when time is up). Extra
              usage requires another token.
            </p>
          </details>
        </div>
      </Modal>
    </>
  );
}
