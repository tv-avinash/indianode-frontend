// pages/compute.jsx
import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Script from "next/script";
import Link from "next/link";

// ---- helpers ----
const gaEvent = (name, params = {}) => {
  try {
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", name, params);
    }
  } catch {}
};

const DEPLOYER = process.env.NEXT_PUBLIC_DEPLOYER_BASE || "https://akash-deployer.vercel.app";
const ATTR_KEY = process.env.NEXT_PUBLIC_PROVIDER_ATTR_KEY || "org";
const ATTR_VAL = process.env.NEXT_PUBLIC_PROVIDER_ATTR_VALUE || "indianode";

// 6 SKUs (match your backend)
const SKUS = [
  // CPU workers
  { sku: "cpu2x4",  title: "CPU Worker • 2 vCPU • 4 Gi",  baseInr60: 1,  cpu: 2, memGi: 4,  kind: "cpu"   },
  { sku: "cpu4x8",  title: "CPU Worker • 4 vCPU • 8 Gi",  baseInr60: 2,  cpu: 4, memGi: 8,  kind: "cpu"   },
  { sku: "cpu8x16", title: "CPU Worker • 8 vCPU • 16 Gi", baseInr60: 4,  cpu: 8, memGi: 16, kind: "cpu"   },
  // RAM cache (Redis)
  { sku: "redis4",  title: "Redis Cache • 4 Gi",          baseInr60: 1,  cpu: 1, memGi: 4,  kind: "redis" },
  { sku: "redis8",  title: "Redis Cache • 8 Gi",          baseInr60: 2,  cpu: 1, memGi: 8,  kind: "redis" },
  { sku: "redis16", title: "Redis Cache • 16 Gi",         baseInr60: 3,  cpu: 1, memGi: 16, kind: "redis" },
];

// SDL builders (simple & valid Akash v2)
function sdlForCpu({ cpu, memGi }) {
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
        units: ${cpu}
      memory:
        size: ${memGi}Gi
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
}

function sdlForRedis({ memGi }) {
  return `version: "2.0"
services:
  app:
    image: redis:7-alpine
    expose:
      - port: 6379
        as: 6379
        to:
          - global: true
    resources:
      cpu:
        units: 1
      memory:
        size: ${memGi}Gi
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
}

function sdlForSku(sku) {
  const item = SKUS.find((x) => x.sku === sku);
  if (!item) return "";
  if (item.kind === "redis") return sdlForRedis({ memGi: item.memGi });
  return sdlForCpu({ cpu: item.cpu, memGi: item.memGi });
}

function getRunUrl() {
  if (typeof window !== "undefined") return `${window.location.origin}/api/compute/run.sh`;
  return "https://www.indianode.com/api/compute/run.sh";
}

export default function Compute() {
  const [status, setStatus] = useState("checking…");
  const [email, setEmail] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [promo, setPromo] = useState("");
  const [fx, setFx] = useState(0.012);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // Mint modal
  const [open, setOpen] = useState(false);
  const [osTab, setOsTab] = useState("linux");
  const [cmdPosix, setCmdPosix] = useState("");
  const [cmdWin, setCmdWin] = useState("");
  const [mintToken, setMintToken] = useState("");

  useEffect(() => {
    fetch("/api/status").then(r => r.json()).then(j => setStatus(j.status || "offline")).catch(()=>setStatus("offline"));
    fetch("/api/fx").then(r => r.json()).then(j => setFx(Number(j.rate) || 0.012)).catch(()=>{});
    if (typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("windows")) setOsTab("windows");
  }, []);

  const busy = status !== "available";

  const promoCode = (promo || "").trim().toUpperCase();
  const PROMO_OFF_INR = 5;
  const promoActive = promoCode === "TRY" || promoCode === "TRY10";

  const items = useMemo(() => SKUS, []);

  function priceInr(baseInr60, mins) {
    const m = Math.max(1, Number(mins || 60));
    let total = Math.ceil((baseInr60 / 60) * m);
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
    const r = await fetch("/api/compute/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product, minutes, userEmail, promo }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error || "order_failed");
    return j;
  }

  async function mintComputeToken({ paymentId, product, minutes, email, promo }) {
    const r = await fetch("/api/compute/mint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId, product, minutes, email, promo }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error || "token_mint_failed");
    return j; // { token }
  }

  async function payRazorpay({ item }) {
    try {
      setLoading(true);
      setMsg("");

      const userEmail = (email || "").trim();
      if (!userEmail) setMsg("Tip: add your email so we can send your receipt + status link.");

      const order = await createOrder({ product: item.sku, minutes, userEmail });
      const valueInr = Number(((order.amount || 0) / 100).toFixed(2));

      gaEvent("begin_checkout", {
        value: valueInr,
        currency: order.currency || "INR",
        coupon: promoCode || undefined,
        items: [{ item_id: item.sku, item_name: item.title, item_category: item.kind, quantity: 1, price: valueInr }],
        minutes: Number(minutes),
        payment_method: "razorpay",
      });

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_xxxxxx",
        amount: order.amount,
        currency: order.currency,
        order_id: order.id,
        name: "Indianode Cloud",
        description: `Compute: ${item.title} (${minutes} min)`,
        prefill: userEmail ? { email: userEmail } : undefined,
        notes: { minutes: String(minutes), product: item.sku, email: userEmail, promo: promoCode },
        handler: async (resp) => {
          try {
            const res = await mintComputeToken({
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
              items: [{ item_id: item.sku, item_name: item.title, item_category: item.kind, quantity: 1, price: valueInr }],
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

  function deployLinkFor(sku) {
    const sdl = sdlForSku(sku);
    return `${DEPLOYER}?sdl=${encodeURIComponent(sdl)}`;
  }

  return (
    <>
      <Head>
        <title>Compute — Indianode</title>
      </Head>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />

      <div className="max-w-7xl mx-auto py-10">
        <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/20 p-6 mb-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">On-demand CPU Compute</h1>
              <p className="text-sm text-gray-700 mt-1">
                Status: <b>{busy ? "busy" : "available"}</b> • queued execution
              </p>
            </div>

            <Link href="/storage" className="text-indigo-600 hover:text-indigo-700 font-medium">
              Need NVMe storage?
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mt-4">
            <label className="flex flex-col">
              <span className="text-xs font-semibold mb-1">Email (for receipt)</span>
              <input
                className="border rounded-lg px-3 py-2"
                type="email"
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

          {msg && <div className="mt-3 text-sm text-amber-700 bg-amber-100 border border-amber-200 rounded-lg px-3 py-2">{msg}</div>}
        </div>

        {/* CPU section */}
        <h2 className="text-white/90 font-semibold mb-3">CPU Workers</h2>
        <div className="grid md:grid-cols-3 gap-6 mb-10">
          {items.filter(i => i.kind === "cpu").map((item) => {
            const inr = priceInr(item.baseInr60, minutes);
            const dollars = usd(inr).toFixed(2);
            const sdl = sdlForSku(item.sku);
            return (
              <div key={item.sku} className="bg-white rounded-2xl p-6 shadow">
                <div className="text-xs text-gray-500 mb-1">lock: {ATTR_KEY}={ATTR_VAL}</div>
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="text-sm text-gray-700 mt-1">Price: ₹{inr} <span className="text-gray-400">(base ₹{item.baseInr60}/60m)</span></p>

                <div className="mt-4 flex flex-col gap-2">
                  <button
                    onClick={() => payRazorpay({ item })}
                    className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2"
                    disabled={loading}
                  >
                    Pay ₹{inr} • Razorpay (INR)
                  </button>

                  <a
                    href={deployLinkFor(item.sku)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-center"
                  >
                    Deploy on Akash (SDL)
                  </a>

                  <button
                    onClick={() => navigator.clipboard.writeText(sdl).catch(()=>{})}
                    className="rounded-xl bg-gray-900 hover:bg-black text-white px-4 py-2"
                  >
                    Copy SDL
                  </button>

                  <p className="text-[11px] text-gray-500">
                    You’ll receive a one-time ORDER_TOKEN after payment. Run it locally to queue your job.
                    USD ≈ ${dollars}.
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* RAM cache section */}
        <h2 className="text-white/90 font-semibold mb-3">RAM Cache (Redis)</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {items.filter(i => i.kind === "redis").map((item) => {
            const inr = priceInr(item.baseInr60, minutes);
            const dollars = usd(inr).toFixed(2);
            const sdl = sdlForSku(item.sku);
            return (
              <div key={item.sku} className="bg-white rounded-2xl p-6 shadow">
                <div className="text-xs text-gray-500 mb-1">lock: {ATTR_KEY}={ATTR_VAL}</div>
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="text-sm text-gray-700 mt-1">Price: ₹{inr} <span className="text-gray-400">(base ₹{item.baseInr60}/60m)</span></p>

                <div className="mt-4 flex flex-col gap-2">
                  <button
                    onClick={() => payRazorpay({ item })}
                    className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2"
                    disabled={loading}
                  >
                    Pay ₹{inr} • Razorpay (INR)
                  </button>

                  <a
                    href={deployLinkFor(item.sku)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-center"
                  >
                    Deploy on Akash (SDL)
                  </a>

                  <button
                    onClick={() => navigator.clipboard.writeText(sdl).catch(()=>{})}
                    className="rounded-xl bg-gray-900 hover:bg-black text-white px-4 py-2"
                  >
                    Copy SDL
                  </button>

                  <p className="text-[11px] text-gray-500">
                    You’ll receive a one-time ORDER_TOKEN after payment. Run it locally to queue your job.
                    USD ≈ ${dollars}.
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
              <button className="rounded-lg p-2 hover:bg-gray-100" onClick={() => setOpen(false)}>✕</button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-gray-700">
                We minted a one-time <b>ORDER_TOKEN</b>. Run the command below from your own machine.
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
                {osTab === "windows" ? (cmdWin || "…") : (cmdPosix || "…")}
              </div>

              <div className="flex gap-2">
                <button
                  className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl"
                  onClick={() => navigator.clipboard.writeText(osTab === "windows" ? cmdWin : cmdPosix).catch(()=>{})}
                >
                  Copy command
                </button>
                <button
                  className="bg-gray-200 hover:bg-gray-300 text-gray-900 px-4 py-2 rounded-xl"
                  onClick={() => navigator.clipboard.writeText(mintToken).catch(()=>{})}
                >
                  Copy token only
                </button>
              </div>

              <details className="text-xs text-gray-600">
                <summary className="cursor-pointer font-semibold">Time limits</summary>
                <p className="mt-1">
                  The token encodes the product and minutes you purchased. The worker enforces duration server-side.
                </p>
              </details>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
