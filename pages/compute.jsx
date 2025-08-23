// pages/compute.jsx
import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Script from "next/script";

const SKUS = [
  { sku: "cpu2x4",  name: "CPU Worker • 2 vCPU • 4 Gi",  base60: 60,  lock: "org=indianode" },
  { sku: "cpu4x8",  name: "CPU Worker • 4 vCPU • 8 Gi",  base60: 120, lock: "org=indianode" },
  { sku: "cpu8x16", name: "CPU Worker • 8 vCPU • 16 Gi", base60: 240, lock: "org=indianode" },
  { sku: "redis4",  name: "Redis Cache • 4 Gi",          base60: 49,  lock: "org=indianode" },
  { sku: "redis8",  name: "Redis Cache • 8 Gi",          base60: 89,  lock: "org=indianode" },
  { sku: "redis16", name: "Redis Cache • 16 Gi",         base60: 159, lock: "org=indianode" },
];

const PROMO_OFF_INR = 5;
const DEPLOYER_BASE = process.env.NEXT_PUBLIC_DEPLOYER_BASE || "";

function Modal({ open, onClose, title = "Next steps", children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl mx-4 rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-lg">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-gray-100">✕</button>
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
  const promoCode = (promo || "").trim().toUpperCase();
  const promoActive = promoCode === "TRY" || promoCode === "TRY10";

  const [fx, setFx] = useState(0.012);
  useEffect(() => {
    fetch("/api/fx").then(r=>r.json()).then(j=>setFx(Number(j.rate)||0.012)).catch(()=>{});
  }, []);

  const [mintOpen, setMintOpen] = useState(false);
  const [mintCmd, setMintCmd] = useState("");
  const [mintToken, setMintToken] = useState("");
  const [loading, setLoading] = useState(false);

  function inrFor(base60, m) {
    let total = Math.ceil((base60/60) * Math.max(1, Number(m||1)));
    if (promoActive) total = Math.max(1, total - PROMO_OFF_INR);
    return total;
  }
  function usdFromInr(x){ return Math.round((x*fx + Number.EPSILON)*100)/100; }

  function buildRunCommand(token) {
    if (!DEPLOYER_BASE) return "missing_env_DEPLOYER_BASE";
    return `curl -fsSL ${DEPLOYER_BASE}/api/compute/run.sh | ORDER_TOKEN='${token}' bash`;
  }

  // --- API helpers (always send `sku`) ---
  async function createComputeOrder({ sku, minutes, email, promo }) {
    const r = await fetch("/api/compute/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sku, minutes, email, promo }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error || "order_failed");
    return j; // { id, amount, currency }
  }

  async function mintAfterPayment({ paymentId, sku, minutes, email, promo }) {
    const r = await fetch("/api/compute/mint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId, sku, minutes, email, promo }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error || "token_mint_failed");
    return j; // { token }
  }

  async function payWithRazorpay({ sku, displayName, priceInr }) {
    try {
      setLoading(true);
      const userEmail = (email || "").trim();

      const ord = await createComputeOrder({ sku, minutes, email: userEmail, promo });
      const opts = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_xxxxxx",
        amount: ord.amount,
        currency: ord.currency,
        order_id: ord.id,
        name: "Indianode Cloud",
        description: `${displayName} (${minutes} min)`,
        prefill: userEmail ? { email: userEmail } : undefined,
        theme: { color: "#111827" },
        handler: async (resp) => {
          const out = await mintAfterPayment({
            paymentId: resp.razorpay_payment_id,
            sku, minutes, email: userEmail, promo,
          });
          const token = out?.token;
          if (!token) throw new Error("no_token");
          const cmd = buildRunCommand(token);
          setMintToken(token); setMintCmd(cmd); setMintOpen(true);
        }
      };
      const rzp = new window.Razorpay(opts);
      rzp.on("payment.failed", (e)=>alert(e?.error?.description || "Payment failed"));
      rzp.open();
    } catch (e) {
      alert(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // compact card renderer
  const Cards = useMemo(()=>SKUS.map(s=>{
    const inr = inrFor(s.base60, minutes);
    const usd = usdFromInr(inr);
    return (
      <div key={s.sku} className="bg-white rounded-2xl shadow p-5 flex flex-col justify-between">
        <div>
          <div className="text-lg font-semibold">{s.name} <span className="text-xs text-gray-400">lock: {s.lock}</span></div>
          <div className="mt-2 text-gray-700">Price: ₹{inr} (base ₹{s.base60}/60m)</div>
          {promoActive && <div className="text-xs text-green-700 mt-1">Includes promo: −₹{PROMO_OFF_INR}</div>}
        </div>
        <div className="mt-4 grid gap-2">
          <button
            className={`px-4 py-2 rounded-xl text-white ${loading ? "bg-gray-400" : "bg-slate-700 hover:bg-slate-800"}`}
            disabled={loading}
            onClick={()=>payWithRazorpay({ sku: s.sku, displayName: s.name, priceInr: inr })}
          >
            Pay ₹{inr} • Razorpay (INR)
          </button>
          <div className="flex gap-2">
            <a
              href={`https://akash.network/`}// placeholder – your SDL pages
              className="flex-1 text-center bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-xl"
            >
              Deploy on Akash (SDL)
            </a>
            <button
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-900 px-3 py-2 rounded-xl"
              onClick={()=>{
                navigator.clipboard.writeText(`# SDL for ${s.name}\n# …`);
              }}
            >
              Copy SDL
            </button>
          </div>
          <p className="text-[11px] text-gray-500">
            Billed in INR via Razorpay. Prefer Akash? Use SDL.
          </p>
        </div>
      </div>
    );
  }), [minutes, promoActive, loading]);

  return (
    <>
      <Head><title>Indianode — CPU & RAM Services</title></Head>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />
      <div className="min-h-screen bg-gray-50">
        <header className="bg-gray-900 text-white px-6 py-4 text-xl font-bold">Indianode — CPU & RAM</header>

        <main className="max-w-6xl mx-auto p-6">
          <div className="grid md:grid-cols-3 gap-3 bg-white rounded-2xl shadow p-4 mb-6">
            <label className="flex flex-col">
              <span className="text-sm font-semibold mb-1">Email</span>
              <input className="border rounded-lg px-3 py-2" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" />
            </label>
            <label className="flex flex-col">
              <span className="text-sm font-semibold mb-1">Minutes</span>
              <input type="number" min="1" max="240" className="border rounded-lg px-3 py-2"
                     value={minutes} onChange={e=>setMinutes(Math.max(1, Number(e.target.value||1)))} />
            </label>
            <label className="flex flex-col">
              <span className="text-sm font-semibold mb-1">Promo</span>
              <input className="border rounded-lg px-3 py-2" value={promo} onChange={e=>setPromo(e.target.value)} placeholder="TRY / TRY10" />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">{Cards}</div>

          <section className="mt-10 bg-white rounded-2xl shadow p-5">
            <h3 className="text-lg font-semibold mb-2">How do I run the job after payment?</h3>
            <ol className="list-decimal ml-5 text-sm space-y-1">
              <li>After payment, you’ll see a one-time <b>ORDER_TOKEN</b> and a ready command.</li>
              <li><b>macOS/Linux:</b> paste the command in a terminal and hit enter.</li>
              <li><b>Windows PowerShell:</b> 
                <div className="mt-1 font-mono text-xs bg-gray-900 text-gray-100 rounded p-2 overflow-x-auto">
                  $env:ORDER_TOKEN = '&lt;paste token&gt;'<br/>
                  (Invoke-WebRequest -UseBasicParsing https://www.indianode.com/api/compute/run.sh).Content &#124; bash
                </div>
              </li>
              <li>We enqueue the job and email you when it’s queued, started, and done.</li>
              <li>Check live status at: <span className="font-mono">/api/compute/status?id=&lt;job_id&gt;</span></li>
            </ol>
          </section>
        </main>

        <footer className="p-4 text-center text-sm text-gray-600">© {new Date().getFullYear()} Indianode</footer>
      </div>

      <Modal open={mintOpen} onClose={()=>setMintOpen(false)} title="Payment verified — next steps">
        {!DEPLOYER_BASE && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
            Set <code className="font-mono">NEXT_PUBLIC_DEPLOYER_BASE</code> in Vercel.
          </div>
        )}
        <p className="text-sm text-gray-700 mb-3">
          Run the command below from any machine to redeem your ORDER_TOKEN. <b>Do not</b> run it on your Akash host.
        </p>
        <div className="bg-gray-900 text-gray-100 rounded-xl p-3 font-mono text-xs overflow-x-auto">{mintCmd || "…"}</div>
        <div className="flex gap-2 mt-3">
          <button className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl" onClick={()=>navigator.clipboard.writeText(mintCmd)}>Copy command</button>
          <button className="bg-gray-200 hover:bg-gray-300 text-gray-900 px-4 py-2 rounded-xl" onClick={()=>navigator.clipboard.writeText(mintToken)}>Copy token</button>
        </div>
      </Modal>
    </>
  );
}
