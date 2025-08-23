// pages/gpu.jsx
import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Script from "next/script";
import Link from "next/link";

// GA helper
const gaEvent = (name, params = {}) => {
  try {
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", name, params);
    }
  } catch {}
};

// Compact modal (same behavior as other pages)
function Modal({ open, onClose, children, title = "Next steps" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl mx-2 rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-base">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 hover:bg-gray-100"
            aria-label="Close"
          >
            {"\u00D7"}
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export default function GPU() {
  const RS = "\u20B9"; // Rupee

  // Status (available/busy)
  const [status, setStatus] = useState("checking...");
  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((j) => setStatus(j.status || "offline"))
      .catch(() => setStatus("offline"));
  }, []);
  const busy = status !== "available";

  // Inputs
  const [email, setEmail] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [promo, setPromo] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Optional PayPal
  const enablePayPal =
    String(process.env.NEXT_PUBLIC_ENABLE_PAYPAL || "0") === "1";

  // FX for USD display
  const [fx, setFx] = useState(0.012);
  useEffect(() => {
    fetch("/api/fx")
      .then((r) => r.json())
      .then((j) => setFx(Number(j.rate) || 0.012))
      .catch(() => {});
  }, []);

  // Products
  const products = useMemo(
    () => [
      { key: "whisper", name: "Whisper ASR", desc: "Speech-to-text on GPU" },
      { key: "sd", name: "Stable Diffusion", desc: "Text-to-Image AI" },
      { key: "llama", name: "LLaMA Inference", desc: "Run an LLM on GPU" },
    ],
    []
  );

  // Pricing (per 60 min, in INR)
  const price60 = { whisper: 100, sd: 200, llama: 300 };

  // Promo
  const PROMO_OFF_INR = 5;
  const promoCode = (promo || "").trim().toUpperCase();
  const promoActive = promoCode === "TRY" || promoCode === "TRY10";

  function priceInrFor(key, mins) {
    const base = price60[key] || 0;
    const m = Math.max(1, Number(mins || 60));
    let total = Math.ceil((base / 60) * m);
    if (promoActive) total = Math.max(1, total - PROMO_OFF_INR);
    return total;
  }
  function priceUsdFromInr(inr) {
    const val = inr * fx;
    return Math.round((val + Number.EPSILON) * 100) / 100;
  }

  // Build run.sh URL (static path, not /api)
  function getRunUrl() {
    try {
      if (typeof window !== "undefined") {
        return `${window.location.origin}/api/gpu/run.sh`;
      }
    } catch {}
    return "https://www.indianode.com/api/gpu/run.sh";
  }

  // Modal + OS commands
  const [mintOpen, setMintOpen] = useState(false);
  const [mintToken, setMintToken] = useState("");
  const [mintCmd, setMintCmd] = useState(""); // macOS/Linux
  const [mintCmdWin, setMintCmdWin] = useState(""); // Windows

  const [osTab, setOsTab] = useState("linux");
  useEffect(() => {
    if (typeof navigator !== "undefined") {
      const ua = navigator.userAgent.toLowerCase();
      setOsTab(ua.includes("windows") ? "windows" : "linux");
    }
  }, []);

  function buildCommands(token) {
    const url = getRunUrl();
    const posix = `export ORDER_TOKEN='${token}'
curl -fsSL ${url} | bash`;
    const win = `$env:ORDER_TOKEN = '${token}'
(Invoke-WebRequest -UseBasicParsing ${url}).Content | bash`;
    return { posix, win };
  }

  // ---------- API helpers (point to working /api/order) ----------
  async function parseJsonSafe(res) {
    // Avoid "Unexpected end of JSON input"
    const text = await res.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      return { _raw: text };
    }
  }

  async function createOrderGPU({ product, minutes, userEmail }) {
    const res = await fetch("/api/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product, minutes, userEmail, promo }),
    });
    const data = await parseJsonSafe(res);
    if (!res.ok) {
      const msg =
        data?.error ||
        data?._raw ||
        `order_failed (status ${res.status})`;
      throw new Error(msg);
    }
    return data;
  }

  async function mintAfterPaymentGPU({ paymentId, product, minutes, email, promo }) {
    const res = await fetch("/api/gpu/mint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentId,
        product,
        minutes: Number(minutes),
        email: (email || "").trim(),
        promo: (promo || "").trim(),
      }),
    });
    const data = await parseJsonSafe(res);
    if (!res.ok) {
      const msg =
        data?.error ||
        data?._raw ||
        `token_mint_failed (status ${res.status})`;
      throw new Error(msg);
    }
    return data; // { token: "v1...." }
  }
  // ---------------------------------------------------------------

  // Payments
  async function payWithRazorpay({ product, displayName }) {
    try {
      setMsg("");
      setLoading(true);
      const userEmail = (email || "").trim();
      if (!userEmail) {
        setMsg("Tip: add your email so we can send your run command + receipt.");
      }

      const order = await createOrderGPU({ product, minutes, userEmail });

      const valueInr = Number(((order.amount || 0) / 100).toFixed(2));
      gaEvent("begin_checkout", {
        value: valueInr,
        currency: order.currency || "INR",
        coupon: promoCode || undefined,
        items: [{ item_id: product, item_name: displayName, item_category: "gpu", quantity: 1, price: valueInr }],
        minutes: Number(minutes),
        payment_method: "razorpay",
      });

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_xxxxxx",
        amount: order.amount,
        currency: order.currency,
        order_id: order.id,
        name: "Indianode Cloud",
        description: `GPU: ${displayName} (${minutes} min)`,
        prefill: userEmail ? { email: userEmail } : undefined,
        notes: { minutes: String(minutes), product, email: userEmail, promo: promoCode },
        theme: { color: "#111827" },
        handler: async (response) => {
          try {
            const result = await mintAfterPaymentGPU({
              paymentId: response.razorpay_payment_id,
              product,
              minutes,
              email: userEmail,
              promo,
            });
            const token = result?.token || "";
            if (!token) throw new Error("no_token");

            const { posix, win } = buildCommands(token);
            setMintToken(token);
            setMintCmd(posix);
            setMintCmdWin(win);
            setMintOpen(true);

            gaEvent("purchase", {
              transaction_id: response.razorpay_payment_id,
              value: valueInr,
              currency: order.currency || "INR",
              coupon: promoCode || undefined,
              items: [{ item_id: product, item_name: displayName, item_category: "gpu", quantity: 1, price: valueInr }],
              minutes: Number(minutes),
              payment_method: "razorpay",
            });
          } catch (e) {
            alert("Could not mint ORDER_TOKEN (" + (e.message || "token_mint_failed") + ")");
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (resp) => alert(resp?.error?.description || "Payment failed"));
      rzp.open();
    } catch (e) {
      alert(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function payWithPayPal({ product, amountUsd, displayName }) {
    try {
      setLoading(true);
      const res = await fetch("/api/paypal/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product, minutes, amountUsd }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "paypal_create_failed");

      const valueUsd = Number(Number(amountUsd || 0).toFixed(2));
      gaEvent("begin_checkout", {
        value: valueUsd,
        currency: "USD",
        coupon: promoCode || undefined,
        items: [{ item_id: product, item_name: displayName || product, item_category: "gpu", quantity: 1, price: valueUsd }],
        minutes: Number(minutes),
        payment_method: "paypal",
      });

      window.location.href = data.approveUrl; // capture handled on success page
    } catch (e) {
      alert(e.message || "PayPal error");
    } finally {
      setLoading(false);
    }
  }

  // --- DISTINCT, PROVIDER-BOUND SDLS ---
  function sdlFor(key) {
    if (key === "whisper") {
      return `version: "2.0"
services:
  whisper:
    image: ghcr.io/ggerganov/whisper.cpp:latest
    expose:
      - port: 8080
        as: 80
        to:
          - global: true
        accept:
          - "*"
    resources:
      cpu: { units: 4 }
      memory: { size: 8Gi }
      gpu: { units: 1 }
      storage:
        - size: 10Gi
profiles:
  compute:
    whisper: {}
  placement:
    akash:
      attributes:
        org: indianode
      pricing:
        whisper:
          denom: uakt
          amount: 100
deployment:
  whisper:
    akash:
      profile: whisper
      count: 1
`;
    }
    if (key === "sd") {
      return `version: "2.0"
services:
  webui:
    image: pytorch/pytorch:2.2.0-cuda12.1-cudnn8-runtime
    expose:
      - port: 7860
        as: 80
        to:
          - global: true
        accept:
          - "*"
    resources:
      cpu: { units: 6 }
      memory: { size: 12Gi }
      gpu: { units: 1 }
      storage:
        - size: 20Gi
profiles:
  compute:
    webui: {}
  placement:
    akash:
      attributes:
        org: indianode
      pricing:
        webui:
          denom: uakt
          amount: 100
deployment:
  webui:
    akash:
      profile: webui
      count: 1
`;
    }
    // llama
    return `version: "2.0"
services:
  llama:
    image: pytorch/pytorch:2.2.0-cuda12.1-cudnn8-runtime
    expose:
      - port: 8000
        as: 80
        to:
          - global: true
        accept:
          - "*"
    resources:
      cpu: { units: 8 }
      memory: { size: 16Gi }
      gpu: { units: 1 }
      storage:
        - size: 20Gi
profiles:
  compute:
    llama: {}
  placement:
    akash:
      attributes:
        org: indianode
      pricing:
        llama:
          denom: uakt
          amount: 100
deployment:
  llama:
    akash:
      profile: llama
      count: 1
`;
  }

  async function copySDL(key) {
    try {
      await navigator.clipboard.writeText(sdlFor(key));
      setMsg("SDL copied to clipboard!");
      setTimeout(() => setMsg(""), 2000);
      gaEvent("select_content", { content_type: "button", item_id: `copy_sdl_${key}` });
    } catch {
      alert("Could not copy SDL. Please copy manually.");
    }
  }

  return (
    <>
      <Head>
        <title>GPU - Indianode</title>
        <meta
          name="description"
          content="GPU on demand for Whisper, SD, and LLaMA. Pay per minute and redeem with a one-time token, or copy provider-bound SDLs."
        />
        <link rel="canonical" href="https://www.indianode.com/gpu" />
      </Head>

      <div className="min-h-screen bg-gray-50 text-gray-900">
        <Script src="https://checkout.razorpay.com/v1/checkout.js" />

        {/* Header */}
        <header className="px-4 py-3 bg-gray-900 text-white">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="text-lg font-semibold tracking-tight">Indianode Cloud</div>
            <nav className="text-xs space-x-3">
              <Link href="/" className="hover:underline">Home</Link>
              <Link href="/gpu" className="hover:underline">GPU</Link>
              <Link href="/compute" className="hover:underline">Compute</Link>
              <Link href="/storage" className="hover:underline">Storage</Link>
            </nav>
          </div>
        </header>

        {/* Main */}
        <main className="max-w-6xl mx-auto px-4 pt-4 pb-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold leading-tight">GPU on demand (RTX 3090)</h1>
              <p className="text-sm text-gray-600">
                Status:&nbsp;
                <span
                  className={`px-1.5 py-0.5 rounded text-white ${
                    busy ? "bg-amber-600" : "bg-emerald-600"
                  }`}
                >
                  {status}
                </span>
                <span className="ml-2 text-gray-500">
                  Pay per minute & redeem via <code className="font-mono">/api/gpu/run.sh</code>.
                </span>
              </p>
            </div>

            {/* Inputs toolbar */}
            <div className="bg-white rounded-xl shadow border px-3 py-2">
              <div className="grid grid-cols-3 gap-2 items-end">
                <label className="flex flex-col">
                  <span className="text-[11px] font-semibold">Email</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="border rounded-md px-2 py-1 text-sm"
                    disabled={loading}
                  />
                </label>
                <label className="flex flex-col">
                  <span className="text-[11px] font-semibold">Minutes</span>
                  <input
                    type="number"
                    min="1"
                    max="480"
                    value={minutes}
                    onChange={(e) =>
                      setMinutes(Math.max(1, Number(e.target.value || 1)))
                    }
                    className="border rounded-md px-2 py-1 text-sm"
                    disabled={loading}
                  />
                </label>
                <label className="flex flex-col">
                  <span className="text-[11px] font-semibold">Promo</span>
                  <input
                    value={promo}
                    onChange={(e) => setPromo(e.target.value)}
                    placeholder="TRY / TRY10"
                    className="border rounded-md px-2 py-1 text-sm"
                    disabled={loading}
                  />
                </label>
              </div>
            </div>
          </div>

          {msg && (
            <div className="mt-2 text-center text-xs text-emerald-800 bg-emerald-100 border border-emerald-200 rounded-lg px-3 py-1.5">
              {msg}
            </div>
          )}

          {/* Cards */}
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            {products.map((p) => {
              const inr = priceInrFor(p.key, minutes);
              const usd = priceUsdFromInr(inr);
              const offInr = promoActive ? PROMO_OFF_INR : 0;
              const offUsd = promoActive ? priceUsdFromInr(PROMO_OFF_INR) : 0;

              return (
                <div key={p.key} className="bg-white border rounded-2xl shadow p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <h2 className="text-base font-semibold">{p.name}</h2>
                      <span className="text-[11px] text-gray-500">
                        Base {RS}{price60[p.key]}/60m
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{p.desc}</p>

                    <p className="mt-2 text-sm">
                      <span className="font-medium">For {minutes} min:</span>{" "}
                      {RS}{inr} / ${usd.toFixed(2)}
                    </p>
                    {promoActive && (
                      <p className="text-[11px] text-green-700 mt-0.5">
                        Promo -{RS}{offInr} (~${offUsd.toFixed(2)})
                      </p>
                    )}
                  </div>

                  <div className="grid gap-2 mt-3">
                    <button
                      onClick={() => copySDL(p.key)}
                      className="rounded-lg bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 text-sm"
                      title="Copy provider-bound SDL to clipboard"
                    >
                      Copy SDL
                    </button>

                    <button
                      className={`text-white px-3 py-1.5 text-sm rounded-lg ${
                        loading ? "bg-gray-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"
                      }`}
                      onClick={() => payWithRazorpay({ product: p.key, displayName: p.name })}
                      disabled={loading}
                    >
                      Pay {RS}{inr} {"\u2022"} Razorpay
                    </button>

                    {enablePayPal && (
                      <button
                        className={`text-white px-3 py-1.5 text-sm rounded-lg ${
                          loading ? "bg-gray-400 cursor-not-allowed" : "bg-slate-700 hover:bg-slate-800"
                        }`}
                        onClick={() => payWithPayPal({ product: p.key, amountUsd: usd, displayName: p.name })}
                        disabled={loading}
                      >
                        Pay ${usd.toFixed(2)} {"\u2022"} PayPal
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </main>

        {/* Footer */}
        <footer className="px-4 py-3 text-center text-xs text-gray-600">
          <nav className="mb-1 space-x-3">
            <Link href="/" className="text-blue-600 hover:underline">Home</Link>
            <Link href="/gpu" className="text-blue-600 hover:underline">GPU</Link>
            <Link href="/compute" className="text-blue-600 hover:underline">Compute</Link>
            <Link href="/storage" className="text-blue-600 hover:underline">Storage</Link>
          </nav>
          {"\u00A9"} {new Date().getFullYear()} Indianode
        </footer>
      </div>

      {/* Mint modal */}
      <Modal open={mintOpen} onClose={() => setMintOpen(false)} title="Payment verified - run this command">
        <div className="space-y-2">
          <p className="text-sm text-gray-700">
            We minted a one-time <b>ORDER_TOKEN</b>. Run the command below from your own machine (not the Akash host VM).
          </p>

          <div className="flex gap-2 text-[11px]">
            <button
              onClick={() => setOsTab("linux")}
              className={`px-2.5 py-1 rounded border ${
                osTab === "linux" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-800 border-gray-200"
              }`}
              title="macOS / Linux (bash or zsh)"
            >
              macOS / Linux
            </button>
            <button
              onClick={() => setOsTab("windows")}
              className={`px-2.5 py-1 rounded border ${
                osTab === "windows" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-800 border-gray-200"
              }`}
              title="Windows PowerShell"
            >
              Windows (PowerShell)
            </button>
          </div>

          <div className="bg-gray-900 text-gray-100 rounded-xl p-3 font-mono text-xs overflow-x-auto">
            {osTab === "windows" ? mintCmdWin || "..." : mintCmd || "..."}
          </div>

          <div className="flex gap-2">
            <button
              className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded-lg text-sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(osTab === "windows" ? mintCmdWin : mintCmd);
                } catch {}
              }}
            >
              Copy command
            </button>
            <button
              className="bg-gray-200 hover:bg-gray-300 text-gray-900 px-3 py-1.5 rounded-lg text-sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(mintToken);
                } catch {}
              }}
            >
              Copy token only
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
