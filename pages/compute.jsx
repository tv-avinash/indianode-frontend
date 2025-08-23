// pages/compute.jsx
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

// Reusable compact modal (same logic, tighter UI)
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
            ✕
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export default function Compute() {
  // Inputs
  const [email, setEmail] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [promo, setPromo] = useState("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // Optional USD
  const enablePayPal =
    String(process.env.NEXT_PUBLIC_ENABLE_PAYPAL || "0") === "1";

  // FX
  const [fx, setFx] = useState(0.012);
  useEffect(() => {
    fetch("/api/fx")
      .then((r) => r.json())
      .then((j) => setFx(Number(j.rate) || 0.012))
      .catch(() => {});
  }, []);

  // Promo
  const PROMO_OFF_INR = 5;
  const promoCode = (promo || "").trim().toUpperCase();
  const promoActive = promoCode === "TRY" || promoCode === "TRY10";

  // 6 SKUs (unchanged)
  const items = useMemo(
    () => [
      { sku: "cpu2x4", name: "Compute Small", desc: "2 vCPU • 4 GiB", cpuUnits: 2, mem: "4Gi" },
      { sku: "cpu4x8", name: "Compute Medium", desc: "4 vCPU • 8 GiB", cpuUnits: 4, mem: "8Gi" },
      { sku: "cpu8x16", name: "Compute Large", desc: "8 vCPU • 16 GiB", cpuUnits: 8, mem: "16Gi" },
      { sku: "redis", name: "Redis Cache", desc: "redis:7-alpine • 2 vCPU • 4 GiB", cpuUnits: 2, mem: "4Gi" },
      { sku: "nginx", name: "Static HTTP", desc: "nginx:alpine • 1 vCPU • 1 GiB", cpuUnits: 1, mem: "1Gi" },
      { sku: "generic", name: "Generic Job", desc: "Alpine shell • bring your cmd", cpuUnits: 1, mem: "1Gi" },
    ],
    []
  );

  // Prices (unchanged)
  const price60 = {
    cpu2x4: 60,
    cpu4x8: 100,
    cpu8x16: 180,
    redis: 80,
    nginx: 40,
    generic: 30,
  };
  function priceInrFor(sku, mins) {
    const base = price60[sku] || 0;
    const m = Math.max(1, Number(mins || 60));
    let total = Math.ceil((base / 60) * m);
    if (promoActive) total = Math.max(1, total - PROMO_OFF_INR);
    return total;
  }
  function priceUsdFromInr(inr) {
    const val = inr * fx;
    return Math.round((val + Number.EPSILON) * 100) / 100;
  }

  // run.sh URL + modal command builder (unchanged behavior)
  function getRunUrl() {
    try {
      if (typeof window !== "undefined") {
        return `${window.location.origin}/api/compute/run.sh`;
      }
    } catch {}
    return "https://www.indianode.com/api/compute/run.sh";
  }
  const [mintOpen, setMintOpen] = useState(false);
  const [mintToken, setMintToken] = useState("");
  const [mintCmd, setMintCmd] = useState("");
  const [mintCmdWin, setMintCmdWin] = useState("");
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

  // API helpers (unchanged endpoints)
  async function createOrderCompute({ product, minutes, userEmail }) {
    const r = await fetch("/api/compute/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product, minutes, userEmail, promo }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error || "order_failed");
    return data;
  }
  async function mintAfterPaymentCompute({ paymentId, product, minutes, email, promo }) {
    const r = await fetch("/api/compute/mint", {
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
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error || "token_mint_failed");
    return j;
  }

  // Payments (unchanged logic)
  async function payWithRazorpay({ product, displayName }) {
    try {
      setMsg("");
      setLoading(true);
      const userEmail = (email || "").trim();
      if (!userEmail) {
        setMsg("Tip: add your email so we can send your run command + receipt.");
      }
      const order = await createOrderCompute({ product, minutes, userEmail });
      const valueInr = Number(((order.amount || 0) / 100).toFixed(2));
      gaEvent("begin_checkout", {
        value: valueInr,
        currency: order.currency || "INR",
        coupon: promoCode || undefined,
        items: [{ item_id: product, item_name: displayName, item_category: "compute", quantity: 1, price: valueInr }],
        minutes: Number(minutes),
        payment_method: "razorpay",
      });
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_xxxxxx",
        amount: order.amount,
        currency: order.currency,
        order_id: order.id,
        name: "Indianode Cloud",
        description: `Compute: ${displayName} (${minutes} min)`,
        prefill: userEmail ? { email: userEmail } : undefined,
        notes: { minutes: String(minutes), product, email: userEmail, promo: promoCode },
        theme: { color: "#111827" },
        handler: async (response) => {
          try {
            const result = await mintAfterPaymentCompute({
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
              items: [{ item_id: product, item_name: displayName, item_category: "compute", quantity: 1, price: valueInr }],
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
        items: [{ item_id: product, item_name: displayName || product, item_category: "compute", quantity: 1, price: valueUsd }],
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

  // SDLs (unchanged behavior)
  function sdlFor(sku) {
    const common = (image, cpuUnits, mem) => `version: "2.0"
services:
  app:
    image: ${image}
    resources:
      cpu: { units: ${cpuUnits} }
      memory: { size: ${mem} }
      storage:
        - size: 2Gi
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
          amount: 50
deployment:
  app:
    anywhere:
      profile: app
      count: 1
`;
    switch (sku) {
      case "cpu2x4":
        return common("alpine:latest", 2, "4Gi");
      case "cpu4x8":
        return common("alpine:latest", 4, "8Gi");
      case "cpu8x16":
        return common("alpine:latest", 8, "16Gi");
      case "redis":
        return common("redis:7-alpine", 2, "4Gi");
      case "nginx":
        return common("nginx:alpine", 1, "1Gi");
      case "generic":
      default:
        return `version: "2.0"
services:
  job:
    image: alpine:latest
    command:
      - /bin/sh
      - -lc
      - "echo 'Hello from Indianode'; sleep 600"
    resources:
      cpu: { units: 1 }
      memory: { size: 1Gi }
      storage:
        - size: 2Gi
profiles:
  compute:
    job: {}
  placement:
    anywhere:
      attributes:
        org: indianode
      pricing:
        job:
          denom: uakt
          amount: 35
deployment:
  job:
    anywhere:
      profile: job
      count: 1
`;
    }
  }
  async function copySDL(sku) {
    try {
      await navigator.clipboard.writeText(sdlFor(sku));
      setMsg("SDL copied to clipboard!");
      setTimeout(() => setMsg(""), 2000);
      gaEvent("select_content", { content_type: "button", item_id: `copy_sdl_${sku}` });
    } catch {
      alert("Could not copy SDL. Please copy manually.");
    }
  }

  return (
    <>
      <Head>
        <title>Compute — Indianode</title>
        <meta
          name="description"
          content="CPU & memory compute on demand. Pay per minute, copy provider-bound SDLs, redeem with a one-time token."
        />
        <link rel="canonical" href="https://www.indianode.com/compute" />
      </Head>

      <div className="min-h-screen bg-gray-50 text-gray-900">
        <Script src="https://checkout.razorpay.com/v1/checkout.js" />

        {/* Compact header */}
        <header className="px-4 py-3 bg-gray-900 text-white">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="text-lg font-semibold tracking-tight">Indianode Cloud</div>
            <nav className="text-xs space-x-3">
              <Link href="/" className="hover:underline">Home</Link>
              <Link href="/compute" className="hover:underline">Compute</Link>
              <Link href="/storage" className="hover:underline">Storage</Link>
            </nav>
          </div>
        </header>

        {/* Main compressed to fit one screen */}
        <main className="max-w-6xl mx-auto px-4 pt-4 pb-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold leading-tight">CPU Compute on demand</h1>
              <p className="text-sm text-gray-600">
                Copy provider-bound SDLs or pay per minute and redeem via <code className="font-mono">/api/compute/run.sh</code>.
              </p>
            </div>

            {/* Buyer inputs as a compact toolbar */}
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
                    onChange={(e) => setMinutes(Math.max(1, Number(e.target.value || 1)))}
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

          {/* 6 compact cards: 2 rows x 3 cols typically */}
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            {items.map((item) => {
              const inr = priceInrFor(item.sku, minutes);
              const usd = priceUsdFromInr(inr);
              const offInr = promoActive ? PROMO_OFF_INR : 0;
              const offUsd = promoActive ? priceUsdFromInr(PROMO_OFF_INR) : 0;

              return (
                <div key={item.sku} className="bg-white border rounded-2xl shadow p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <h2 className="text-base font-semibold">{item.name}</h2>
                      <span className="text-[11px] text-gray-500">
                        Base ₹{price60[item.sku] || 0}/60m
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{item.desc}</p>

                    <p className="mt-2 text-sm">
                      <span className="font-medium">For {minutes} min:</span>{" "}
                      ₹{inr} / ${usd.toFixed(2)}
                    </p>
                    {promoActive && (
                      <p className="text-[11px] text-green-700 mt-0.5">
                        Promo −₹{offInr} (≈${offUsd.toFixed(2)})
                      </p>
                    )}
                  </div>

                  <div className="grid gap-2 mt-3">
                    <button
                      onClick={() => copySDL(item.sku)}
                      className="rounded-lg bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 text-sm"
                      title="Copy provider-bound SDL to clipboard"
                    >
                      Copy SDL
                    </button>

                    <button
                      className={`text-white px-3 py-1.5 text-sm rounded-lg ${
                        loading ? "bg-gray-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"
                      }`}
                      onClick={() =>
                        payWithRazorpay({ product: item.sku, displayName: item.name })
                      }
                      disabled={loading}
                    >
                      Pay ₹{inr} • Razorpay
                    </button>

                    {enablePayPal && (
                      <button
                        className={`text-white px-3 py-1.5 text-sm rounded-lg ${
                          loading ? "bg-gray-400 cursor-not-allowed" : "bg-slate-700 hover:bg-slate-800"
                        }`}
                        onClick={() =>
                          payWithPayPal({ product: item.sku, amountUsd: usd, displayName: item.name })
                        }
                        disabled={loading}
                      >
                        Pay ${usd.toFixed(2)} • PayPal
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </main>

        {/* Compact footer */}
        <footer className="px-4 py-3 text-center text-xs text-gray-600">
          <nav className="mb-1 space-x-3">
            <Link href="/" className="text-blue-600 hover:underline">Home</Link>
            <Link href="/compute" className="text-blue-600 hover:underline">Compute</Link>
            <Link href="/storage" className="text-blue-600 hover:underline">Storage</Link>
          </nav>
          © {new Date().getFullYear()} Indianode
        </footer>
      </div>

      {/* Mint modal (unchanged logic, compact UI) */}
      <Modal open={mintOpen} onClose={() => setMintOpen(false)} title="Payment verified — run this command">
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
            {osTab === "windows" ? mintCmdWin || "…" : mintCmd || "…"}
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
