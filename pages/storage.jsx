import { useEffect, useMemo, useState } from "react";
import Script from "next/script";
import Head from "next/head";
import Link from "next/link";
import SiteChrome from "../components/SiteChrome";

const gaEvent = (name, params = {}) => {
  try {
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", name, params);
    }
  } catch {}
};

const getRunUrl = () => {
  try {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/storage/run.sh`;
    }
  } catch {}
  return "https://www.indianode.com/storage/run.sh";
};

export default function Storage() {
  const [status, setStatus] = useState("checking...");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [promo, setPromo] = useState("");
  const [fx, setFx] = useState(0.012);

  const [mintOpen, setMintOpen] = useState(false);
  const [cmdLinux, setCmdLinux] = useState("");
  const [cmdWin, setCmdWin] = useState("");
  const [tokenStr, setTokenStr] = useState("");
  const [osTab, setOsTab] = useState("linux");

  const enablePayPal =
    String(process.env.NEXT_PUBLIC_ENABLE_PAYPAL || "0") === "1";

  useEffect(() => {
    fetch("/api/fx")
      .then((r) => r.json())
      .then((j) => setFx(Number(j.rate) || 0.012))
      .catch(() => {});
  }, []);
  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((j) => setStatus(j.status || "offline"))
      .catch(() => setStatus("offline"));
  }, []);
  useEffect(() => {
    if (typeof navigator !== "undefined") {
      const ua = navigator.userAgent.toLowerCase();
      setOsTab(ua.includes("windows") ? "windows" : "linux");
    }
  }, []);

  const busy = status !== "available";

  const plans = useMemo(
    () => [
      { key: "nvme200", name: "200 GiB NVMe", base: 40, desc: "Burst, scratch, small datasets" },
      { key: "nvme500", name: "500 GiB NVMe", base: 80, desc: "Models, checkpoints" },
      { key: "nvme1000", name: "1 TiB NVMe", base: 140, desc: "Large corpora, artifacts" },
    ],
    []
  );

  const PROMO_OFF_INR = 5;
  const promoCode = (promo || "").trim().toUpperCase();
  const promoActive = promoCode === "TRY" || promoCode === "TRY10";

  const priceInr = (base, mins) => {
    const m = Math.max(1, Number(mins || 60));
    let total = Math.ceil((base / 60) * m);
    if (promoActive) total = Math.max(1, total - PROMO_OFF_INR);
    return total;
  };
  const inrToUsd = (x) => Math.round((x * fx + Number.EPSILON) * 100) / 100;

  function buildCommands(token) {
    const url = getRunUrl();
    const linux = `export ORDER_TOKEN='${token}'
curl -fsSL ${url} | bash`;
    const win = `$env:ORDER_TOKEN = '${token}'
curl -fsSL ${url} | bash`;
    return { linux, win };
  }

  // --- API helpers (RENAMED) ---
  async function createStorageOrder({ product, minutes, userEmail }) {
    const r = await fetch("/api/storage/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product, minutes, userEmail, promo }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error || "order_failed");
    return j;
  }

  async function mintStorageToken({ paymentId, product, minutes, email, promo }) {
    const r = await fetch("/api/storage/mint", {
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

  async function payWithRazorpay({ product, displayName, priceInrVal }) {
    try {
      setLoading(true);
      const userEmail = (email || "").trim();

      const order = await createStorageOrder({ product, minutes, userEmail });

      const valueInr = Number(((order.amount || 0) / 100).toFixed(2));
      gaEvent("begin_checkout", {
        value: valueInr,
        currency: order.currency || "INR",
        coupon: promoCode || undefined,
        items: [{ item_id: product, item_name: displayName, item_category: "storage", quantity: 1, price: valueInr }],
        minutes: Number(minutes),
        payment_method: "razorpay",
      });

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_xxxxxx",
        amount: order.amount,
        currency: order.currency,
        order_id: order.id,
        name: "Indianode Storage",
        description: `Storage token for ${displayName} (${minutes} min)`,
        prefill: userEmail ? { email: userEmail } : undefined,
        notes: { minutes: String(minutes), product, email: userEmail, promo: promoCode },
        theme: { color: "#0b1220" },
        handler: async (resp) => {
          try {
            const res = await mintStorageToken({
              paymentId: resp.razorpay_payment_id,
              product,
              minutes,
              email: userEmail,
              promo,
            });
            const token = res?.token || "";
            const { linux, win } = buildCommands(token);
            setTokenStr(token);
            setCmdLinux(linux);
            setCmdWin(win);
            setMintOpen(true);

            gaEvent("purchase", {
              transaction_id: resp.razorpay_payment_id,
              value: valueInr,
              currency: order.currency || "INR",
              coupon: promoCode || undefined,
              items: [{ item_id: product, item_name: displayName, item_category: "storage", quantity: 1, price: valueInr }],
              minutes: Number(minutes),
              payment_method: "razorpay",
            });
          } catch (e) {
            alert(e.message || "Could not mint token");
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (r) => alert(r?.error?.description || "Payment failed"));
      rzp.open();
    } catch (e) {
      alert(e.message || "Checkout failed");
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

      gaEvent("begin_checkout", {
        value: Number(Number(amountUsd || 0).toFixed(2)),
        currency: "USD",
        coupon: promoCode || undefined,
        items: [{ item_id: product, item_name: product, item_category: "storage", quantity: 1, price: Number(amountUsd || 0) }],
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

  return (
    <>
      <Head>
        <title>Storage — Indianode</title>
      </Head>

      <Script src="https://checkout.razorpay.com/v1/checkout.js" />
      <SiteChrome active="storage">
        <div className="max-w-6xl mx-auto p-6">
          <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 p-6 mb-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl font-bold">Same-host NVMe Storage</h1>
                <p className="text-gray-600">
                  Status: <span className="font-semibold">{status}</span>{" "}
                  {busy ? "• provisioning queued" : "• instant provisioning"}
                </p>
              </div>
              <div className="text-sm text-gray-600">
                <Link className="text-indigo-700 hover:underline" href="/compute">
                  Need CPU compute?
                </Link>
              </div>
            </div>
          </div>

          {/* Inputs */}
          <div className="bg-white rounded-2xl shadow p-5 mb-6">
            <div className="grid md:grid-cols-3 gap-4">
              <label className="flex flex-col">
                <span className="text-sm font-semibold mb-1">Email (optional)</span>
                <input
                  className="border rounded-lg px-3 py-2"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </label>
              <label className="flex flex-col">
                <span className="text-sm font-semibold mb-1">Minutes</span>
                <input
                  className="border rounded-lg px-3 py-2"
                  type="number"
                  min="1"
                  max="240"
                  value={minutes}
                  onChange={(e) => setMinutes(Math.max(1, Number(e.target.value || 1)))}
                  disabled={loading}
                />
              </label>
              <label className="flex flex-col">
                <span className="text-sm font-semibold mb-1">Promo</span>
                <input
                  className="border rounded-lg px-3 py-2"
                  placeholder="TRY / TRY10"
                  value={promo}
                  onChange={(e) => setPromo(e.target.value)}
                  disabled={loading}
                />
              </label>
            </div>
          </div>

          {/* Plans */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((p) => {
              const inr = priceInr(p.base, minutes);
              const usd = inrToUsd(inr);
              return (
                <div key={p.key} className="bg-white rounded-2xl shadow p-6 flex flex-col justify-between">
                  <div>
                    <h2 className="font-bold text-lg">{p.name}</h2>
                    <p className="text-gray-600 text-sm mb-3">{p.desc}</p>
                    <p className="text-gray-900">
                      <span className="font-semibold">Price for {minutes} min:</span> ₹{inr} / ${usd.toFixed(2)}
                    </p>
                    {promoActive && (
                      <p className="text-xs text-green-700 mt-1">Includes promo: −₹{PROMO_OFF_INR} (~${inrToUsd(PROMO_OFF_INR).toFixed(2)})</p>
                    )}
                  </div>

                  <div className="mt-4 space-y-2">
                    <button
                      onClick={() => payWithRazorpay({ product: p.key, displayName: p.name, priceInrVal: inr })}
                      className={`w-full text-white px-4 py-2 rounded-xl ${
                        loading ? "bg-gray-400 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700"
                      }`}
                      disabled={loading}
                    >
                      Pay ₹{inr} • Razorpay
                    </button>
                    {enablePayPal && (
                      <button
                        onClick={() => payWithPayPal({ product: p.key, amountUsd: usd })}
                        className={`w-full text-white px-4 py-2 rounded-xl ${
                          loading ? "bg-gray-400 cursor-not-allowed" : "bg-slate-700 hover:bg-slate-800"
                        }`}
                        disabled={loading}
                      >
                        Pay ${usd.toFixed(2)} • PayPal
                      </button>
                    )}
                    <p className="text-[11px] text-gray-500">You’ll get an ORDER_TOKEN to provision storage via a one-liner.</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </SiteChrome>

      {/* Mint modal */}
      {mintOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMintOpen(false)} />
          <div className="relative w-full max-w-2xl mx-4 rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-semibold text-lg">Payment verified — run this</h3>
              <button onClick={() => setMintOpen(false)} className="rounded-lg p-2 hover:bg-gray-100">✕</button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-gray-700">
                We minted a one-time <b>ORDER_TOKEN</b>. Run the command below from your machine.
              </p>

              <div className="flex gap-2 text-xs">
                <button
                  onClick={() => setOsTab("linux")}
                  className={`px-3 py-1 rounded-lg border ${osTab === "linux" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-800 border-gray-200"}`}
                >
                  macOS / Linux
                </button>
                <button
                  onClick={() => setOsTab("windows")}
                  className={`px-3 py-1 rounded-lg border ${osTab === "windows" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-800 border-gray-200"}`}
                >
                  Windows (PowerShell)
                </button>
              </div>

              <div className="bg-gray-900 text-gray-100 rounded-xl p-3 font-mono text-xs overflow-x-auto">
                {osTab === "windows" ? cmdWin : cmdLinux}
              </div>

              <div className="flex gap-2">
                <button
                  className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(osTab === "windows" ? cmdWin : cmdLinux);
                    } catch {}
                  }}
                >
                  Copy command
                </button>
                <button
                  className="bg-gray-200 hover:bg-gray-300 text-gray-900 px-4 py-2 rounded-xl"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(tokenStr);
                    } catch {}
                  }}
                >
                  Copy token only
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
