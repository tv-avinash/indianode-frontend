// pages/storage.jsx
import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Script from "next/script";

const gaEvent = (name, params = {}) => {
  try {
    if (typeof window !== "undefined" && window.gtag) window.gtag("event", name, params);
  } catch {}
};

const ATTR_KEY = process.env.NEXT_PUBLIC_PROVIDER_ATTR_KEY || "org";
const ATTR_VAL = process.env.NEXT_PUBLIC_PROVIDER_ATTR_VALUE || "indianode";

// NVMe SKUs (match your backend)
const SKUS = [
  { sku: "nvme200", title: "NVMe Storage • 200 Gi", baseInr60: 49, sizeGi: 200 },
  { sku: "nvme500", title: "NVMe Storage • 500 Gi", baseInr60: 99, sizeGi: 500 },
  { sku: "nvme1tb", title: "NVMe Storage • 1 TiB", baseInr60: 149, sizeGi: 1024 },
];

// simple persistent-volume SDL (Akash v2: storage profile)
function sdlForSize(sizeGi) {
  return `version: "2.0"
services:
  app:
    image: debian:stable-slim
    command:
      - /bin/sh
      - -lc
      - "sleep infinity"
    resources:
      cpu:
        units: 1
      memory:
        size: 1Gi
      storage:
        - size: 1Gi
    params:
      storage:
        data: ${sizeGi}Gi
    mounts:
      - volume: data
        path: /data
profiles:
  compute:
    app: {}
  storage:
    data:
      size: ${sizeGi}Gi
      attributes:
        persistent: true
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
}

function getRunUrl() {
  if (typeof window !== "undefined") return `${window.location.origin}/api/storage/run.sh`;
  return "https://www.indianode.com/api/storage/run.sh";
}

export default function Storage() {
  const [email, setEmail] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [promo, setPromo] = useState("");
  const [fx, setFx] = useState(0.012);
  const [loading, setLoading] = useState(false);

  // Mint modal
  const [open, setOpen] = useState(false);
  const [osTab, setOsTab] = useState("linux");
  const [cmdPosix, setCmdPosix] = useState("");
  const [cmdWin, setCmdWin] = useState("");
  const [mintToken, setMintToken] = useState("");

  useEffect(() => {
    fetch("/api/fx")
      .then((r) => r.json())
      .then((j) => setFx(Number(j.rate) || 0.012))
      .catch(() => {});
    if (typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("windows"))
      setOsTab("windows");
  }, []);

  const items = useMemo(() => SKUS, []);
  const promoCode = (promo || "").trim().toUpperCase();
  const PROMO_OFF_INR = 5;
  const promoActive = promoCode === "TRY" || promoCode === "TRY10";

  function priceInr(base, mins) {
    const m = Math.max(1, Number(mins || 60));
    let total = Math.ceil((base / 60) * m);
    if (promoActive) total = Math.max(1, total - PROMO_OFF_INR);
    return total;
  }
  const usd = (inr) => Math.round((inr * fx + Number.EPSILON) * 100) / 100;

  function buildCommands(token) {
    const url = getRunUrl();
    const posix = `export ORDER_TOKEN='${token}'
curl -fsSL ${url} | bash`;
    const win = `$env:ORDER_TOKEN = '${token}'
(Invoke-WebRequest -UseBasicParsing ${url}).Content | bash`;
    return { posix, win };
  }

  async function createOrder({ product, minutes, userEmail }) {
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
      body: JSON.stringify({ paymentId, product, minutes, email, promo }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error || "token_mint_failed");
    return j;
  }

  async function payRazorpay({ item }) {
    try {
      setLoading(true);
      const userEmail = (email || "").trim();
      const order = await createOrder({ product: item.sku, minutes, userEmail });
      const valueInr = Number(((order.amount || 0) / 100).toFixed(2));

      gaEvent("begin_checkout", {
        value: valueInr,
        currency: order.currency || "INR",
        coupon: promoCode || undefined,
        items: [
          { item_id: item.sku, item_name: item.title, item_category: "nvme", quantity: 1, price: valueInr },
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
        description: `Storage: ${item.title} (${minutes} min)`,
        prefill: userEmail ? { email: userEmail } : undefined,
        notes: { minutes: String(minutes), product: item.sku, email: userEmail, promo: promoCode },
        handler: async (resp) => {
          try {
            const res = await mintStorageToken({
              paymentId: resp.razorpay_payment_id,
              product: item.sku,
              minutes,
              email: userEmail,
              promo,
            });
            const token = res?.token;
            if (!token) throw new Error("no_token");
            const { posix, win } = buildCommands(token);
            setMintToken(token);
            setCmdPosix(posix);
            setCmdWin(win);
            setOpen(true);

            gaEvent("purchase", {
              transaction_id: resp.razorpay_payment_id,
              value: valueInr,
              currency: order.currency || "INR",
              coupon: promoCode || undefined,
              items: [
                { item_id: item.sku, item_name: item.title, item_category: "nvme", quantity: 1, price: valueInr },
              ],
              minutes: Number(minutes),
              payment_method: "razorpay",
            });
          } catch (e) {
            alert(e.message || "Could not mint ORDER_TOKEN");
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (e) => alert(e?.error?.description || "Payment Failed"));
      rzp.open();
    } catch (e) {
      alert(e.message || "Something went wrong");
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

      <div className="max-w-7xl mx-auto py-10">
        <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/20 p-6 mb-6">
          <h1 className="text-2xl font-bold">Same-host NVMe Storage</h1>
          <p className="text-sm text-gray-700 mt-1">Attach fast persistent volumes to your Akash lease.</p>

          <div className="grid md:grid-cols-3 gap-4 mt-4">
            <label className="flex flex-col">
              <span className="text-xs font-semibold mb-1">Email (for receipt)</span>
              <input
                className="border rounded-lg px-3 py-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <label className="flex flex-col">
              <span className="text-xs font-semibold mb-1">Minutes</span>
              <input
                className="border rounded-lg px-3 py-2"
                type="number"
                min={1}
                max={240}
                value={minutes}
                onChange={(e) => setMinutes(Math.max(1, Number(e.target.value || 1)))}
              />
            </label>
            <label className="flex flex-col">
              <span className="text-xs font-semibold mb-1">Promo</span>
              <input
                className="border rounded-lg px-3 py-2"
                value={promo}
                onChange={(e) => setPromo(e.target.value)}
                placeholder="TRY / TRY10"
              />
            </label>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {items.map((item) => {
            const inr = priceInr(item.baseInr60, minutes);
            const sdl = sdlForSize(item.sizeGi);
            return (
              <div key={item.sku} className="bg-white rounded-2xl p-6 shadow">
                <div className="text-xs text-gray-500 mb-1">
                  lock: {ATTR_KEY}={ATTR_VAL}
                </div>
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="text-sm text-gray-700 mt-1">
                  Price: ₹{inr} <span className="text-gray-400">(base ₹{item.baseInr60}/60m)</span>
                </p>

                <div className="mt-4 flex flex-col gap-2">
                  <button
                    onClick={() => payRazorpay({ item })}
                    className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2"
                    disabled={loading}
                  >
                    Pay ₹{inr} • Razorpay (INR)
                  </button>

                  {/* Removed "Deploy on Akash (SDL)" button */}

                  <button
                    onClick={() => navigator.clipboard.writeText(sdl).catch(() => {})}
                    className="rounded-xl bg-gray-900 hover:bg-black text-white px-4 py-2"
                  >
                    Copy SDL
                  </button>

                  <p className="text-[11px] text-gray-500">
                    You’ll receive a one-time ORDER_TOKEN after payment. Run it locally to queue your storage job.
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mint modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-2xl mx-4 rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-semibold text-lg">Payment verified — run this command</h3>
              <button className="rounded-lg p-2 hover:bg-gray-100" onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-gray-700">Run from your own machine to queue the storage job.</p>

              <div className="flex gap-2 text-xs">
                <button
                  onClick={() => setOsTab("linux")}
                  className={`px-3 py-1 rounded-lg border ${
                    osTab === "linux" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-800 border-gray-200"
                  }`}
                >
                  macOS / Linux
                </button>
                <button
                  onClick={() => setOsTab("windows")}
                  className={`px-3 py-1 rounded-lg border ${
                    osTab === "windows" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-800 border-gray-200"
                  }`}
                >
                  Windows (PowerShell)
                </button>
              </div>

              <div className="bg-gray-900 text-gray-100 rounded-xl p-3 font-mono text-xs overflow-x-auto">
                {osTab === "windows" ? (cmdWin || "…") : (cmdPosix || "…")}
              </div>

              <div className="flex gap-2">
                <button
                  className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl"
                  onClick={() =>
                    navigator.clipboard
                      .writeText(osTab === "windows" ? cmdWin : cmdPosix)
                      .catch(() => {})
                  }
                >
                  Copy command
                </button>
                <button
                  className="bg-gray-200 hover:bg-gray-300 text-gray-900 px-4 py-2 rounded-xl"
                  onClick={() => navigator.clipboard.writeText(mintToken).catch(() => {})}
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
