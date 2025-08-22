// pages/index.js
import { useState, useEffect, useMemo } from "react";
import Script from "next/script";
import Head from "next/head";
import Link from "next/link";

// --- Analytics helper (safe if gtag isn't ready) ---
const gaEvent = (name, params = {}) => {
  try {
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", name, params);
    }
  } catch {}
};

// --- Small modal component ---
function Modal({ open, onClose, children, title = "Next steps" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl mx-4 rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-lg">{title}</h3>
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

  // Promo: TRY / TRY10 => ₹5 off total
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

  // --- Minting modal state ---
  const [mintOpen, setMintOpen] = useState(false);
  const [mintCmd, setMintCmd] = useState(""); // macOS/Linux version
  const [mintCmdWin, setMintCmdWin] = useState(""); // Windows (PowerShell) version
  const [mintToken, setMintToken] = useState("");

  // Detect OS to preselect correct tab
  const [osTab, setOsTab] = useState("linux");
  useEffect(() => {
    if (typeof navigator !== "undefined") {
      const ua = navigator.userAgent.toLowerCase();
      if (ua.includes("windows")) setOsTab("windows");
      else setOsTab("linux"); // macOS/Linux default
    }
  }, []);

  // Build run.sh URL on this same site (no /api)
  function getRunUrl() {
    try {
      if (typeof window !== "undefined") {
        return `${window.location.origin}/compute/run.sh`;
      }
    } catch {}
    return "https://www.indianode.com/compute/run.sh";
  }

  function buildCommands(token) {
    const url = getRunUrl();
    // macOS/Linux (bash/zsh)
    const posix = `export ORDER_TOKEN='${token}'
curl -fsSL ${url} | bash`;

    // Windows PowerShell
    const win = `$env:ORDER_TOKEN = '${token}'
curl -fsSL ${url} | bash`;

    return { posix, win };
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
      if (r.status === 409 && data && data.error === "gpu_busy") {
        throw new Error("GPU is busy. Please try again later.");
      }
      throw new Error(data && data.error ? data.error : "Order creation failed");
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
    return j; // { token: "v1.…" }
  }

  // --- Payments (Razorpay + PayPal optional) ---
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
            // 1) Mint token on backend (validates Razorpay payment)
            const result = await mintAfterPayment({
              paymentId: response.razorpay_payment_id,
              productKey: product,
              minutes,
              email: userEmail,
              promo,
            });

            const token = result?.token || "";
            if (!token) throw new Error("no_token");

            // 2) Build OS-specific commands and open modal
            const { posix, win } = buildCommands(token);
            setMintToken(token);
            setMintCmd(posix);
            setMintCmdWin(win);
            setMintOpen(true);

            // 3) GA purchase
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

      window.location.href = j.approveUrl; // capture handled on success page
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

        {/* OG / Twitter */}
        <meta property="og:title" content="Indianode — GPU Hosting on RTX 3090" />
        <meta
          property="og:description"
          content="GPU hosting for SDLS, Whisper, and LLM workloads on 24GB RTX 3090."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.indianode.com/" />
        <meta name="twitter:card" content="summary_large_image" />

        {/* JSON-LD */}
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

      <div className="min-h-screen bg-gray-50 text-gray-900">
        <Script src="https://checkout.razorpay.com/v1/checkout.js" />

        <header className="p-6 bg-gray-900 text-white text-center text-2xl font-bold">
          Indianode GPU Cloud
        </header>

        <main className="p-8 max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold mb-2 text-center">
            3090 GPU on demand • India & International payments
          </h1>
          <p className="text-center mb-6 text-lg">
            Current GPU Status: <span className="font-semibold">{status}</span>
          </p>

          {/* Storage cross-promo */}
          <div className="max-w-3xl mx-auto mb-6">
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

          {/* Hero Akash buttons (locked SDLs live on those pages) */}
          {SHOW_AKASH_HERO && (
            <div
              className={`${
                busy ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"
              } border rounded-2xl p-4 text-center mb-6`}
            >
              <div className="mb-3">
                {busy ? (
                  <>GPU busy. You can still deploy via Akash; we’ll queue you.</>
                ) : (
                  <>GPU available. Deploy now on Akash with our ready SDLs.</>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link href="/whisper-gpu" className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl">
                  Whisper (SDL)
                </Link>
                <Link href="/sdls" className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl">
                  Stable Diffusion (SDL)
                </Link>
                <Link href="/llm-hosting" className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl">
                  LLaMA (SDL)
                </Link>
              </div>
            </div>
          )}

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

          {/* Product cards (only pay buttons; Akash links are in the hero) */}
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
                      amount based on today’s rate. Prefer Akash? Use the SDL
                      buttons at the top.
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
            <Link href="/whisper-gpu" className="text-blue-600 hover:underline">
              Whisper
            </Link>
            <Link href="/sdls" className="text-blue-600 hover:underline">
              SDLS
            </Link>
            <Link href="/llm-hosting" className="text-blue-600 hover:underline">
              LLM
            </Link>
            <Link href="/storage" className="text-blue-600 hover:underline">
              Storage
            </Link>
          </nav>
          © {new Date().getFullYear()} Indianode
        </footer>
      </div>

      {/* Mint modal with OS-specific commands */}
      <Modal
        open={mintOpen}
        onClose={() => setMintOpen(false)}
        title="Payment verified — run this command"
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            We minted a one-time <b>ORDER_TOKEN</b>. Run the command below from
            your own machine (not the Akash host VM).
          </p>

          {/* OS tabs */}
          <div className="flex gap-2 text-xs">
            <button
              onClick={() => setOsTab("linux")}
              className={`px-3 py-1 rounded-lg border ${
                osTab === "linux"
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-800 border-gray-200"
              }`}
              title="macOS / Linux (bash or zsh)"
            >
              macOS / Linux
            </button>
            <button
              onClick={() => setOsTab("windows")}
              className={`px-3 py-1 rounded-lg border ${
                osTab === "windows"
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-800 border-gray-200"
              }`}
              title="Windows PowerShell"
            >
              Windows (PowerShell)
            </button>
          </div>

          {/* Command block */}
          <div className="bg-gray-900 text-gray-100 rounded-xl p-3 font-mono text-xs overflow-x-auto">
            {osTab === "windows" ? mintCmdWin || "…" : mintCmd || "…"}
          </div>

          <div className="flex gap-2">
            <button
              className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    osTab === "windows" ? mintCmdWin : mintCmd
                  );
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
              Your token encodes the product and minutes you purchased. Our
              server enforces the duration (e.g. stops the container when time
              is up). Extra usage requires another token.
            </p>
          </details>
        </div>
      </Modal>
    </>
  );
}
