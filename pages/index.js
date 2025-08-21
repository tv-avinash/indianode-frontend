import { useState, useEffect, useMemo } from "react";
import Script from "next/script";
import Head from "next/head";
import Link from "next/link";

const gaEvent = (name, params = {}) => {
  try {
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", name, params);
    }
  } catch {}
};

// -------- SDL helpers (hero buttons) --------
function blobDownload(filename, text) {
  const blob = new Blob([text], { type: "text/yaml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function makeLockedGpuSDL({ title, port }) {
  const ATTR_KEY = process.env.NEXT_PUBLIC_PROVIDER_ATTR_KEY || "org";
  const ATTR_VAL = process.env.NEXT_PUBLIC_PROVIDER_ATTR_VAL || "indianode";

  return `version: "2.0"
services:
  app:
    image: nvidia/cuda:12.4.1-runtime-ubuntu22.04
    command: ["bash","-lc","sleep infinity"]
    expose:
      - port: ${port}
        as: ${port}
        to:
          - global: true
    resources:
      cpu:
        units: 4
      memory:
        size: 16Gi
      storage:
        - size: 10Gi
      gpu:
        units: 1
        attributes:
          vendor/nvidia/model/*: "true"
profiles:
  compute:
    app: {}
  placement:
    locked:
      attributes:
        ${ATTR_KEY}: ${ATTR_VAL}
      pricing:
        app:
          denom: uakt
          amount: 1
deployment:
  app:
    locked:
      profile: app
      count: 1
# ${title} • locked to ${ATTR_KEY}=${ATTR_VAL}
`;
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

  // Post-payment command modal
  const [showModal, setShowModal] = useState(false);
  const [orderToken, setOrderToken] = useState("");
  const [modalProduct, setModalProduct] = useState("");
  const [modalMinutes, setModalMinutes] = useState(0);

  const enablePayPal =
    String(process.env.NEXT_PUBLIC_ENABLE_PAYPAL || "0") === "1";

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

  // -------- Payments --------
  async function createRazorpayOrder({ product, minutes, userEmail }) {
    const r = await fetch("/api/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product, minutes, userEmail, promo }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      if (r.status === 409 && data?.error === "gpu_busy") {
        throw new Error("GPU is busy. Please try again later.");
      }
      throw new Error(data?.error || "Order creation failed");
    }
    return data;
  }

  function openCommandModal({ token, product, minutes }) {
    setOrderToken(token);
    setModalProduct(product);
    setModalMinutes(minutes);
    setShowModal(true);
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

      // GA
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
            // Robust parse: read text first, then JSON-try
            const mintRes = await fetch("/api/gpu/mint", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                paymentId: response.razorpay_payment_id,     // common name
                razorpayPaymentId: response.razorpay_payment_id, // alt name if backend expects this
                product,
                minutes,
                email: userEmail,
              }),
            });

            const raw = await mintRes.text();
            let j = null;
            try {
              j = JSON.parse(raw);
            } catch {
              // Not JSON — keep j = null
            }

            if (!mintRes.ok || !j?.token) {
              console.error("Mint error", {
                status: mintRes.status,
                raw: raw?.slice(0, 500),
              });
              const serverMsg =
                (j && (j.error || j.message)) ||
                (raw && raw.slice(0, 180)) ||
                "token_mint_failed";
              alert(`Could not mint ORDER_TOKEN (${mintRes.status}). ${serverMsg}`);
              return;
            }

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

            openCommandModal({ token: j.token, product, minutes });
          } catch (e) {
            console.error(e);
            alert(e?.message || "Could not mint ORDER_TOKEN");
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
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "paypal_create_failed");

      gaEvent("begin_checkout", {
        value: Number(Number(amountUsd || 0).toFixed(2)),
        currency: "USD",
        coupon: promoCode || undefined,
        items: [
          {
            item_id: product,
            item_name: product,
            item_category: "gpu",
            quantity: 1,
            price: amountUsd,
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

  const busy = status !== "available";
  const disabled = loading;

  // --- Command text for modal ---
  const siteOrigin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://www.indianode.com";
  const SCRIPT_BASE =
    process.env.NEXT_PUBLIC_DEPLOYER_BASE || siteOrigin;
  const commandText = orderToken
    ? `curl -fsSL ${SCRIPT_BASE}/downloads/scripts/run-gpu.sh | ORDER_TOKEN='${orderToken}' bash`
    : "";

  // Hero SDL downloaders
  function downloadWhisperSDL() {
    const sdl = makeLockedGpuSDL({ title: "Whisper", port: 7860 });
    blobDownload("whisper_locked_indianode.yaml", sdl);
    gaEvent("download_sdl", { item_id: "whisper_sdl" });
  }
  function downloadSDSDL() {
    const sdl = makeLockedGpuSDL({ title: "Stable Diffusion", port: 7860 });
    blobDownload("stable_diffusion_locked_indianode.yaml", sdl);
    gaEvent("download_sdl", { item_id: "sd_sdl" });
  }
  function downloadLLaMASDL() {
    const sdl = makeLockedGpuSDL({ title: "LLaMA", port: 8000 });
    blobDownload("llama_locked_indianode.yaml", sdl);
    gaEvent("download_sdl", { item_id: "llama_sdl" });
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
      </Head>

      <div className="min-h-screen bg-gray-50 text-gray-900">
        <Script src="https://checkout.razorpay.com/v1/checkout.js" />

        <header className="p-6 bg-gray-900 text-white text-center text-2xl font-bold">
          Indianode GPU Cloud
        </header>

        <main className="p-8 max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold mb-3 text-center">
            3090 GPU on demand • India & International payments
          </h1>
          <p className="text-center mb-6 text-lg">
            Current GPU Status: <span className="font-semibold">{status}</span>
          </p>

          {/* HERO: Akash SDL quick actions */}
          <div
            className={`rounded-2xl px-5 py-4 text-center mb-8 ${
              busy
                ? "bg-amber-50 border border-amber-200 text-amber-900"
                : "bg-emerald-50 border border-emerald-200 text-emerald-900"
            }`}
          >
            <p className="mb-3">
              {busy ? (
                <>GPU <b>busy</b>. You can still deploy on Akash; we’ll accept when a slot frees up.</>
              ) : (
                <>GPU <b>available</b>. Deploy now on Akash with our ready SDLs.</>
              )}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={downloadWhisperSDL}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Whisper (SDL)
              </button>
              <button
                onClick={downloadSDSDL}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Stable Diffusion (SDL)
              </button>
              <button
                onClick={downloadLLaMASDL}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                LLaMA (SDL)
              </button>
            </div>
          </div>

          {/* Storage CTA */}
          <div className="max-w-3xl mx-auto mb-8">
            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 text-center">
              <p className="mb-3 text-gray-800">
                Need fast <b>same-host NVMe storage</b> for your Akash lease?
              </p>
              <Link
                href="/storage"
                className="inline-block rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2"
              >
                Explore Storage (200 Gi / 500 Gi / 1 TiB)
              </Link>
            </div>
          </div>

          {/* Buyer inputs */}
          <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow p-6 mb-8">
            <div className="grid md:grid-cols-3 gap-4">
              <label className="flex flex-col">
                <span className="text-sm font-semibold mb-1">
                  Your email (for receipts)
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="border rounded-lg px-3 py-2"
                  disabled={loading}
                />
              </label>

              <label className="flex flex-col">
                <span className="text-sm font-semibold mb-1">Minutes</span>
                <input
                  type="number"
                  min="1"
                  max="240"
                  value={minutes}
                  onChange={(e) =>
                    setMinutes(Math.max(1, Number(e.target.value || 1)))
                  }
                  className="border rounded-lg px-3 py-2"
                  disabled={loading}
                />
              </label>

              <label className="flex flex-col">
                <span className="text-sm font-semibold mb-1">Promo code</span>
                <input
                  value={promo}
                  onChange={(e) => setPromo(e.target.value)}
                  placeholder="TRY / TRY10"
                  className="border rounded-lg px-3 py-2"
                  disabled={loading}
                />
              </label>
            </div>

            {busy && (
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="text-sm text-amber-800 mb-3">
                  GPU is busy. You can still pay now (we’ll queue it) or join the
                  waitlist:
                </div>
                <div className="grid md:grid-cols-3 gap-3">
                  <label className="flex flex-col">
                    <span className="text-xs font-semibold mb-1">Email</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="border rounded-lg px-3 py-2"
                    />
                  </label>
                  <label className="flex flex-col">
                    <span className="text-xs font-semibold mb-1">
                      Interested in
                    </span>
                    <select
                      value={interest}
                      onChange={(e) => setInterest(e.target.value)}
                      className="border rounded-lg px-3 py-2"
                    >
                      <option value="sd">Stable Diffusion</option>
                      <option value="whisper">Whisper ASR</option>
                      <option value="llama">LLaMA Inference</option>
                    </select>
                  </label>
                  <div className="flex items-end">
                    <button
                      onClick={joinWaitlist}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl"
                    >
                      Notify me
                    </button>
                  </div>
                </div>
                {wlMsg && <div className="text-xs text-gray-700 mt-3">{wlMsg}</div>}
              </div>
            )}
          </div>

          {msg && (
            <div className="max-w-xl mx-auto mb-6 text-center text-sm text-amber-700 bg-amber-100 border border-amber-200 rounded-xl px-4 py-2">
              {msg}
            </div>
          )}

          {/* Product cards (pay only; no duplicate Deploy buttons) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {templates.map((t) => {
              const inr = priceInrFor(t.key, minutes);
              const usd = priceUsdFromInr(inr);
              const offInr = promoActive ? PROMO_OFF_INR : 0;
              const offUsd = promoActive ? priceUsdFromInr(PROMO_OFF_INR) : 0;

              return (
                <div
                  key={t.key}
                  className="bg-white shadow-lg rounded-2xl p-6 flex flex-col justify-between"
                >
                  <div>
                    <h2 className="text-xl font-bold mb-2">{t.name}</h2>
                    <p className="text-gray-600 mb-3">{t.desc}</p>

                    <p className="text-gray-800">
                      <span className="font-semibold">
                        Price for {minutes} min:
                      </span>{" "}
                      ₹{inr} / ${usd.toFixed(2)}
                    </p>

                    {promoActive && (
                      <p className="text-xs text-green-700 mt-1">
                        Includes promo: −₹{offInr} (≈${offUsd.toFixed(2)})
                      </p>
                    )}

                    <p className="text-xs text-gray-500 mt-1">
                      (Base: ₹{price60[t.key]} for 60 min)
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-2 mt-4">
                    <button
                      className={`text-white px-4 py-2 rounded-xl ${
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
                        className={`text-white px-4 py-2 rounded-xl ${
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

                    <p className="text-[11px] text-gray-500 mt-1">
                      Billed in INR via Razorpay. USD shown is an approximate
                      amount based on today’s rate.
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </main>

        <section className="mt-16 border-t pt-10 pb-6 text-center text-sm text-gray-700">
          <p className="mb-2">
            💬 Looking for custom pricing, discounts, or rate concessions? Reach
            out:
          </p>
          <p>
            Email:{" "}
            <a
              href="mailto:tvavinash@gmail.com"
              className="text-blue-600 hover:underline"
            >
              tvavinash@gmail.com
            </a>
          </p>
          <p>
            Phone:{" "}
            <a href="tel:+919902818004" className="text-blue-600 hover:underline">
              +919902818004
            </a>
          </p>
          <p className="mt-3 text-xs text-gray-400">
            We usually reply within 24 hours.
          </p>
        </section>

        <footer className="p-4 text-center text-sm text-gray-600">
          <nav className="mb-2 space-x-4">
            <Link href="/whisper-gpu" className="text-blue-600 hover:underline">Whisper</Link>
            <Link href="/sdls" className="text-blue-600 hover:underline">SDLS</Link>
            <Link href="/llm-hosting" className="text-blue-600 hover:underline">LLM</Link>
            <Link href="/storage" className="text-blue-600 hover:underline">Storage</Link>
          </nav>
          © {new Date().getFullYear()} Indianode
        </footer>
      </div>

      {/* Command-only modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-3">
          <div className="w-full max-w-2xl bg-white rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold">Payment verified — next steps</h3>
              <button onClick={() => setShowModal(false)} aria-label="Close">✕</button>
            </div>
            <p className="text-sm text-gray-700 mb-4">
              Run the command below from <b>your laptop or any safe machine</b>
              (do <b>not</b> run on your Akash host VM). It redeems your ORDER_TOKEN and queues the job for <b>{modalMinutes} min</b>.
            </p>

            <div className="rounded-xl bg-gray-900 text-gray-100 p-3 text-sm overflow-x-auto mb-3">
              <code>{commandText || "…"}</code>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => navigator.clipboard.writeText(commandText)}
                className="bg-slate-800 hover:bg-slate-900 text-white rounded-lg px-3 py-2"
              >
                Copy command
              </button>
              <button
                onClick={() => navigator.clipboard.writeText(orderToken)}
                className="bg-gray-200 hover:bg-gray-300 rounded-lg px-3 py-2"
              >
                Copy token only
              </button>
            </div>

            <details className="mt-4 text-xs text-gray-600">
              <summary className="cursor-pointer font-semibold">What about time limits?</summary>
              <div className="mt-2">
                Your token encodes the product (<code>{modalProduct}</code>) and minutes. Our server enforces duration
                (stops the container when time is up). Extra usage requires another token.
              </div>
            </details>
          </div>
        </div>
      )}
    </>
  );
}
