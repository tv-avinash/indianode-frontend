// pages/compute.jsx
import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Script from "next/script";

// safe GA
const gaEvent = (name, params = {}) => {
  try {
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", name, params);
    }
  } catch {}
};

// tiny modal
function Modal({ open, onClose, title = "Next steps", children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl mx-3 rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded p-2 hover:bg-gray-100">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export default function Compute() {
  // status + fx
  const [status, setStatus] = useState("checking...");
  const [fx, setFx] = useState(0.012);
  useEffect(() => {
    fetch("/api/status").then(r=>r.json()).then(j=>setStatus(j.status||"offline")).catch(()=>setStatus("offline"));
    fetch("/api/fx").then(r=>r.json()).then(j=>setFx(Number(j.rate)||0.012)).catch(()=>{});
  }, []);
  const busy = status !== "available";

  const SHOW_AKASH = String(process.env.NEXT_PUBLIC_SHOW_AKASH || "1") === "1";
  const DEPLOYER_BASE = process.env.NEXT_PUBLIC_DEPLOYER_BASE || "";

  // buyer inputs
  const [email, setEmail] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [promo, setPromo] = useState("");

  // pricing plans (edit INR base/60min to taste)
  const cpuPlans = [
    { key: "cpu2", title: "CPU Worker • 2 vCPU • 4 Gi", cpu: 2, mem: "4Gi", base60: 60 },
    { key: "cpu4", title: "CPU Worker • 4 vCPU • 8 Gi", cpu: 4, mem: "8Gi", base60: 120 },
    { key: "cpu8", title: "CPU Worker • 8 vCPU • 16 Gi", cpu: 8, mem: "16Gi", base60: 240 },
  ];
  const redisPlans = [
    { key: "redis4",  title: "Redis Cache • 4 Gi",  mem: "4Gi",  base60: 49 },
    { key: "redis8",  title: "Redis Cache • 8 Gi",  mem: "8Gi",  base60: 89 },
    { key: "redis16", title: "Redis Cache • 16 Gi", mem: "16Gi", base60: 159 },
  ];

  const allPlans = useMemo(() => [...cpuPlans, ...redisPlans], []);
  const priceMap = useMemo(() => Object.fromEntries(allPlans.map(p => [p.key, p.base60])), [allPlans]);

  // promo (TRY / TRY10 => ₹5 off total)
  const PROMO_OFF_INR = 5;
  const promoCode = (promo || "").trim().toUpperCase();
  const promoActive = promoCode === "TRY" || promoCode === "TRY10";

  const inrFor = (key, mins) => {
    const base = priceMap[key] || 0;
    const m = Math.max(1, Number(mins || 60));
    let total = Math.ceil((base / 60) * m);
    if (promoActive) total = Math.max(1, total - PROMO_OFF_INR);
    return total;
  };
  const toUSD = (inr) => Math.round((inr * fx + Number.EPSILON) * 100) / 100;

  // SDL makers (locked to org=indianode)
  const providerAttrKey = "org";
  const providerAttrVal = "indianode";

  const makeCpuSDL = (cpu, memGi) => `version: "2.0"
services:
  worker:
    image: ubuntu:22.04
    command: ["bash","-lc","sleep infinity"]
    resources:
      cpu: { units: ${cpu} }
      memory: { size: ${memGi} }
      storage:
        - size: 10Gi
profiles:
  compute:
    worker: {}
  placement:
    indianode:
      attributes:
        ${providerAttrKey}: "${providerAttrVal}"
      pricing:
        worker:
          denom: uakt
          amount: 100
deployment:
  worker:
    indianode:
      profile: worker
      count: 1
`;

  const makeRedisSDL = (memGi) => `version: "2.0"
services:
  redis:
    image: redis:7
    command: ["redis-server","--appendonly","no","--maxmemory","${memGi.toLowerCase()}","--maxmemory-policy","allkeys-lru"]
    resources:
      cpu: { units: 1 }
      memory: { size: ${memGi} }
      storage:
        - size: 5Gi
    expose:
      - port: 6379
        as: 6379
        to:
          - global: true
profiles:
  compute:
    redis: {}
  placement:
    indianode:
      attributes:
        ${providerAttrKey}: "${providerAttrVal}"
      pricing:
        redis:
          denom: uakt
          amount: 90
deployment:
  redis:
    indianode:
      profile: redis
      count: 1
`;

  // helpers: download/copy SDL
  const download = (name, text) => {
    const blob = new Blob([text], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };
  const copyText = async (t) => { try { await navigator.clipboard.writeText(t); } catch {} };

  // token modal
  const [mintOpen, setMintOpen] = useState(false);
  const [cmd, setCmd] = useState("");
  const [tokenOnly, setTokenOnly] = useState("");

  // build run command per product
  const buildRunCmd = (productKey, token) => {
    if (!DEPLOYER_BASE) return "missing_env_DEPLOYER_BASE";
    // choose script path by product
    const isRedis = productKey.startsWith("redis");
    const path = isRedis ? "/redis/run.sh" : "/compute/run.sh";
    return `curl -fsSL ${DEPLOYER_BASE}${path} | ORDER_TOKEN='${token}' bash`;
  };

  // --- payments / minting ---
  async function createOrder({ product, minutes, email, promo }) {
    const r = await fetch("/api/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product, minutes, userEmail: email, promo }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error || "order_failed");
    return j; // { id, amount, currency }
  }

  async function mintToken({ paymentId, product, minutes, email, promo }) {
    const payload = { paymentId, product, minutes: Number(minutes), email: (email||"").trim(), promo: (promo||"").trim() };
    // Try generic compute endpoint, fall back to gpu/mint to keep compatibility
    const paths = ["/api/compute/mint", "/api/gpu/mint", "/api/mint"];
    for (const p of paths) {
      try {
        const r = await fetch(p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (r.ok) return await r.json(); // { token }
      } catch {}
    }
    throw new Error("token_mint_failed");
  }

  const [loading, setLoading] = useState(false);

  async function payRazorpay(product, displayName) {
    try {
      setLoading(true);
      const order = await createOrder({ product, minutes, email, promo });

      const valueInr = Number(((order.amount || 0) / 100).toFixed(2));
      gaEvent("begin_checkout", {
        value: valueInr,
        currency: order.currency || "INR",
        coupon: promoCode || undefined,
        items: [{ item_id: product, item_name: displayName, item_category: "compute", quantity: 1, price: valueInr }],
        minutes: Number(minutes),
        payment_method: "razorpay",
      });

      const rzp = new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_xxxxxx",
        amount: order.amount,
        currency: order.currency,
        order_id: order.id,
        name: "Indianode Cloud",
        description: `${displayName} (${minutes} min)`,
        prefill: (email || "").trim() ? { email: (email || "").trim() } : undefined,
        notes: { product, minutes: String(minutes), email, promo: promoCode },
        theme: { color: "#111827" },
        handler: async (resp) => {
          try {
            const res = await mintToken({ paymentId: resp.razorpay_payment_id, product, minutes, email, promo });
            const tok = res?.token || "";
            if (!tok) throw new Error("no_token");
            const c = buildRunCmd(product, tok);
            setTokenOnly(tok);
            setCmd(c);
            setMintOpen(true);

            gaEvent("purchase", {
              transaction_id: resp.razorpay_payment_id,
              value: valueInr,
              currency: order.currency || "INR",
              coupon: promoCode || undefined,
              items: [{ item_id: product, item_name: displayName, item_category: "compute", quantity: 1, price: valueInr }],
              minutes: Number(minutes),
              payment_method: "razorpay",
            });
          } catch (e) {
            alert("Could not mint ORDER_TOKEN (" + (e?.message || "token_mint_failed") + ")");
          }
        },
      });
      rzp.on("payment.failed", (e) => alert(e?.error?.description || "Payment failed"));
      rzp.open();
    } catch (e) {
      alert(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Indianode — CPU & RAM Services</title>
        <meta name="description" content="Monetize idle CPU & memory. CPU Workers and Redis RAM cache — use via Akash SDLs or token-based command." />
        <link rel="canonical" href="https://www.indianode.com/compute" />
      </Head>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />

      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white text-gray-900">
        {/* Top bar */}
        <header className="px-5 py-3 bg-gray-900 text-white">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="font-bold">Indianode — CPU & RAM</div>
            <div className={`text-xs px-2 py-1 rounded ${busy ? "bg-amber-500" : "bg-emerald-600"}`}>
              {busy ? "GPU busy" : "GPU available"}
            </div>
          </div>
        </header>

        {/* Single-screen layout (compact) */}
        <main className="max-w-6xl mx-auto px-5 pt-4 pb-6">
          {/* Compact hero row */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-gray-700">
              Use our <b>Akash-locked SDLs</b> or pay to get a one-time <b>ORDER_TOKEN</b> and run a safe command from anywhere.
            </div>
            <a href="/storage" className="rounded-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-sm">Need same-host NVMe? Storage →</a>
          </div>

          {/* Inputs */}
          <div className="mt-3 bg-white/70 border border-gray-100 rounded-2xl p-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="flex items-center gap-2">
                <span className="text-xs font-semibold w-24">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e)=>setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="flex-1 border rounded-lg px-3 py-2 text-sm"
                />
              </label>
              <label className="flex items-center gap-2">
                <span className="text-xs font-semibold w-24">Minutes</span>
                <input
                  type="number"
                  min="1"
                  max="480"
                  value={minutes}
                  onChange={(e)=>setMinutes(Math.max(1, Number(e.target.value||1)))}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm"
                />
              </label>
              <label className="flex items-center gap-2">
                <span className="text-xs font-semibold w-24">Promo</span>
                <input
                  value={promo}
                  onChange={(e)=>setPromo(e.target.value)}
                  placeholder="TRY / TRY10"
                  className="flex-1 border rounded-lg px-3 py-2 text-sm"
                />
              </label>
            </div>
          </div>

          {/* Two compact rows: CPU & Redis (fits most laptops without scroll) */}
          <section className="mt-4">
            <h2 className="text-sm font-semibold text-gray-800 mb-2">CPU Workers</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {cpuPlans.map(p => {
                const inr = inrFor(p.key, minutes);
                const usd = toUSD(inr);
                const sdl = makeCpuSDL(p.cpu, p.mem);
                return (
                  <div key={p.key} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex flex-col">
                    <div className="text-base font-bold">{p.title}</div>
                    <div className="text-xs text-emerald-700 mt-1">lock: {providerAttrKey}={providerAttrVal}</div>
                    <div className="text-sm mt-2"><b>Price:</b> ₹{inr} / ${usd.toFixed(2)} <span className="text-xs text-gray-500">(base ₹{p.base60}/60m)</span></div>
                    {promoActive && (
                      <div className="text-[11px] text-green-700 mt-1">Includes promo −₹{PROMO_OFF_INR} (~${toUSD(PROMO_OFF_INR).toFixed(2)})</div>
                    )}

                    <div className="mt-3 grid gap-2">
                      {/* Pay & get command */}
                      <button
                        disabled={loading}
                        onClick={()=>payRazorpay(p.key, p.title)}
                        className={`text-white px-4 py-2 rounded-xl text-sm ${loading ? "bg-gray-400" : "bg-indigo-600 hover:bg-indigo-700"}`}
                      >
                        Pay ₹{inr} • Razorpay (INR)
                      </button>

                      {/* Akash SDLs */}
                      {SHOW_AKASH && (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={()=>download(`${p.key}.yaml`, sdl)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-3 py-2 text-sm"
                          >
                            Deploy on Akash (SDL)
                          </button>
                          <button
                            onClick={()=>copyText(sdl)}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl px-3 py-2 text-sm"
                          >
                            Copy SDL
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mt-5">
            <h2 className="text-sm font-semibold text-gray-800 mb-2">RAM Cache (Redis)</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {redisPlans.map(p => {
                const inr = inrFor(p.key, minutes);
                const usd = toUSD(inr);
                const mem = p.mem;
                const sdl = makeRedisSDL(mem);
                return (
                  <div key={p.key} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex flex-col">
                    <div className="text-base font-bold">{p.title}</div>
                    <div className="text-xs text-emerald-700 mt-1">lock: {providerAttrKey}={providerAttrVal}</div>
                    <div className="text-sm mt-2"><b>Price:</b> ₹{inr} / ${usd.toFixed(2)} <span className="text-xs text-gray-500">(base ₹{p.base60}/60m)</span></div>
                    {promoActive && (
                      <div className="text-[11px] text-green-700 mt-1">Includes promo −₹{PROMO_OFF_INR} (~${toUSD(PROMO_OFF_INR).toFixed(2)})</div>
                    )}

                    <div className="mt-3 grid gap-2">
                      <button
                        disabled={loading}
                        onClick={()=>payRazorpay(p.key, p.title)}
                        className={`text-white px-4 py-2 rounded-xl text-sm ${loading ? "bg-gray-400" : "bg-indigo-600 hover:bg-indigo-700"}`}
                      >
                        Pay ₹{inr} • Razorpay (INR)
                      </button>

                      {SHOW_AKASH && (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={()=>download(`${p.key}.yaml`, sdl)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-3 py-2 text-sm"
                          >
                            Deploy on Akash (SDL)
                          </button>
                          <button
                            onClick={()=>copyText(sdl)}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl px-3 py-2 text-sm"
                          >
                            Copy SDL
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* tiny usage note */}
          <div className="mt-4 text-[11px] text-gray-600 text-center">
            Paying here mints a one-time ORDER_TOKEN. You’ll get a single command to redeem it with our backend.
            For Akash users, the SDLs are provider-locked so the leases land on Indianode.
          </div>
        </main>

        <footer className="px-5 py-3 text-center text-[12px] text-gray-600 border-t">
          Contact:{" "}
          <a href="mailto:tvavinash@gmail.com" className="text-blue-600 hover:underline">tvavinash@gmail.com</a>{" "}
          •{" "}
          <a href="tel:+919902818004" className="text-blue-600 hover:underline">+91 99028 18004</a>{" "}
          • © {new Date().getFullYear()} Indianode
        </footer>
      </div>

      {/* Mint modal */}
      <Modal open={!!mintOpen} onClose={()=>setMintOpen(false)} title="Payment verified — run this command">
        {!DEPLOYER_BASE && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
            Set <code className="font-mono">NEXT_PUBLIC_DEPLOYER_BASE</code> in Vercel to show the command.
          </div>
        )}
        <div className="bg-gray-900 text-gray-100 rounded-xl p-3 font-mono text-xs overflow-x-auto">{cmd || "…"}</div>
        <div className="flex gap-2 mt-3">
          <button className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl" onClick={()=>navigator.clipboard.writeText(cmd)}>Copy command</button>
          <button className="bg-gray-200 hover:bg-gray-300 text-gray-900 px-4 py-2 rounded-xl" onClick={()=>navigator.clipboard.writeText(tokenOnly)}>Copy token only</button>
        </div>
        <details className="text-xs text-gray-600 mt-2">
          <summary className="cursor-pointer font-semibold">What happens next?</summary>
          <ol className="list-decimal pl-5 mt-1 space-y-1">
            <li>The command redeems your ORDER_TOKEN with our backend and queues the job.</li>
            <li>Runtime equals the minutes you purchased; the process is stopped automatically when time is up.</li>
            <li>Do <b>not</b> run it on your Akash host VM—use any other machine or a throwaway instance.</li>
          </ol>
        </details>
      </Modal>
    </>
  );
}
