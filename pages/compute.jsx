// pages/compute.jsx
import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Script from "next/script";
import SiteChrome from "../components/SiteChrome";

const gaEvent = (name, params = {}) => { try { if (typeof window !== "undefined" && window.gtag) window.gtag("event", name, params); } catch {} };

function Modal({ open, onClose, children, title = "Next steps" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl mx-4 rounded-2xl bg-white shadow-xl text-slate-900">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-lg">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-gray-100" aria-label="Close">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export default function Compute() {
  const [minutes, setMinutes] = useState(60);
  const [email, setEmail] = useState("");
  const [promo, setPromo] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // modal
  const [mintOpen, setMintOpen] = useState(false);
  const [mintCmd, setMintCmd] = useState("");
  const [mintCmdWin, setMintCmdWin] = useState("");
  const [mintToken, setMintToken] = useState("");
  const [osTab, setOsTab] = useState("linux");
  useEffect(() => { if (typeof navigator !== "undefined") setOsTab(navigator.userAgent.toLowerCase().includes("windows")?"windows":"linux"); }, []);

  // pricing (example INR per 60m)
  const price60 = { cpu1x2: 20, cpu2x4: 40, cpu4x8: 80, cpu8x16: 160, redis4g: 25, pg4g: 30 };
  const PROMO_OFF_INR = 5;
  const promoCode = (promo||"").trim().toUpperCase();
  const promoActive = promoCode === "TRY" || promoCode === "TRY10";

  function inrFor(key, mins) {
    const base = price60[key] || 0;
    const m = Math.max(1, Number(mins||60));
    let total = Math.ceil((base/60)*m);
    if (promoActive) total = Math.max(1, total - PROMO_OFF_INR);
    return total;
  }

  const skus = useMemo(()=>[
    { key:"cpu1x2", name:"CPU 1 vCPU / 2 GB", desc:"Lightweight tasks" },
    { key:"cpu2x4", name:"CPU 2 vCPU / 4 GB", desc:"General use" },
    { key:"cpu4x8", name:"CPU 4 vCPU / 8 GB", desc:"Bigger builds" },
    { key:"cpu8x16", name:"CPU 8 vCPU / 16 GB", desc:"Heavier jobs" },
    { key:"redis4g", name:"Redis 4 GiB", desc:"Managed ephemeral cache" },
    { key:"pg4g",   name:"Postgres 4 GiB", desc:"Managed ephemeral DB" },
  ],[]);

  function getRunUrl() {
    try { if (typeof window!=="undefined") return `${window.location.origin}/compute/run.sh`; } catch {}
    return "https://www.indianode.com/compute/run.sh";
  }
  function buildCommands(token) {
    const url = getRunUrl();
    const posix = `export ORDER_TOKEN='${token}'
curl -fsSL ${url} | bash`;
    const win   = `$env:ORDER_TOKEN = '${token}'
(Invoke-WebRequest -UseBasicParsing ${url}).Content | bash`;
    return { posix, win };
  }

  async function createOrder({ product, minutes, email }) {
    const r = await fetch("/api/compute/order", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ product, minutes, email, promo }) });
    const j = await r.json(); if (!r.ok) throw new Error(j?.error || "order_failed"); return j;
  }
  async function mintToken({ paymentId, product, minutes, email, promo }) {
    const r = await fetch("/api/compute/mint", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ paymentId, product, minutes:Number(minutes), email:(email||"").trim(), promo:(promo||"").trim() }) });
    const j = await r.json(); if (!r.ok) throw new Error(j?.error || "mint_failed"); return j;
  }

  async function payWithRazorpay({ product, display }) {
    try {
      setMsg(""); setLoading(true);
      const userEmail = (email||"").trim();
      const order = await createOrder({ product, minutes, email:userEmail });
      const valueInr = Number(((order.amount||0)/100).toFixed(2));
      gaEvent("begin_checkout", { value:valueInr, currency: order.currency || "INR", minutes:Number(minutes), item_id:product, payment_method:"razorpay" });

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_xxxxxx",
        amount: order.amount, currency: order.currency, order_id: order.id,
        name: "Indianode Compute", description: `${display} (${minutes} min)`,
        prefill: (userEmail ? { email: userEmail } : undefined),
        notes: { minutes:String(minutes), product, email:userEmail, promo:promoCode },
        theme: { color: "#111827" },
        handler: async (response) => {
          try {
            const res = await mintToken({ paymentId: response.razorpay_payment_id, product, minutes, email:userEmail, promo });
            const token = res?.token || ""; if (!token) throw new Error("no_token");
            const { posix, win } = buildCommands(token);
            setMintToken(token); setMintCmd(posix); setMintCmdWin(win); setMintOpen(true);
            gaEvent("purchase", { transaction_id: response.razorpay_payment_id, value:valueInr, currency: order.currency || "INR", minutes:Number(minutes), item_id:product, payment_method:"razorpay" });
          } catch (e) { alert(e.message || "Could not mint token"); }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (resp)=>alert(resp?.error?.description || "Payment failed"));
      rzp.open();
    } catch (e) {
      alert(e.message || "Something went wrong");
    } finally { setLoading(false); }
  }

  return (
    <>
      <Head>
        <title>Indianode — CPU/RAM Compute</title>
        <meta name="description" content="Queue CPU/RAM jobs and managed services (Redis/Postgres) with minute-capped tokens." />
        <link rel="canonical" href="https://www.indianode.com/compute" />
      </Head>

      <Script src="https://checkout.razorpay.com/v1/checkout.js" />
      <SiteChrome title="CPU / RAM Compute" subtle>
        {/* Controls */}
        <div className="max-w-3xl mx-auto bg-white/95 text-slate-900 rounded-2xl shadow p-6 mb-8">
          <div className="grid md:grid-cols-3 gap-4">
            <label className="flex flex-col">
              <span className="text-sm font-semibold mb-1">Email (optional)</span>
              <input value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@example.com" className="border rounded-lg px-3 py-2" disabled={loading} />
            </label>
            <label className="flex flex-col">
              <span className="text-sm font-semibold mb-1">Minutes</span>
              <input type="number" min="1" max="240" value={minutes} onChange={(e)=>setMinutes(Math.max(1, Number(e.target.value||1)))} className="border rounded-lg px-3 py-2" disabled={loading} />
            </label>
            <label className="flex flex-col">
              <span className="text-sm font-semibold mb-1">Promo code</span>
              <input value={promo} onChange={(e)=>setPromo(e.target.value)} placeholder="TRY / TRY10" className="border rounded-lg px-3 py-2" disabled={loading} />
            </label>
          </div>
        </div>

        {/* Plans grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {skus.map((s) => (
            <div key={s.key} className="bg-white/95 text-slate-900 shadow-lg rounded-2xl p-6 flex flex-col justify-between">
              <div>
                <h2 className="text-xl font-bold mb-2">{s.name}</h2>
                <p className="text-gray-600 mb-3">{s.desc}</p>
                <p className="text-gray-800">
                  <span className="font-semibold">Price for {minutes} min:</span> ₹{inrFor(s.key, minutes)}
                </p>
                {promoActive && (
                  <p className="text-xs text-green-700 mt-1">Includes promo: −₹{PROMO_OFF_INR}</p>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2 mt-4">
                <button
                  className={`text-white px-4 py-2 rounded-xl ${loading ? "bg-gray-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"}`}
                  onClick={() => payWithRazorpay({ product: s.key, display: s.name })}
                  disabled={loading}
                >
                  Pay ₹{inrFor(s.key, minutes)} • Razorpay
                </button>
                <p className="text-[11px] text-gray-500 mt-1">
                  After payment, you’ll get an ORDER_TOKEN and a one-line redeem command.
                </p>
              </div>
            </div>
          ))}
        </div>
      </SiteChrome>

      {/* Mint modal with OS-specific commands */}
      <Modal open={mintOpen} onClose={()=>setMintOpen(false)} title="Payment verified — run this command">
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            We minted a one-time <b>ORDER_TOKEN</b>. Run the command below from your own machine.
          </p>
          <div className="flex gap-2 text-xs">
            <button onClick={()=>setOsTab("linux")} className={`px-3 py-1 rounded-lg border ${osTab==="linux"?"bg-gray-900 text-white border-gray-900":"bg-white text-gray-800 border-gray-200"}`}>macOS / Linux</button>
            <button onClick={()=>setOsTab("windows")} className={`px-3 py-1 rounded-lg border ${osTab==="windows"?"bg-gray-900 text-white border-gray-900":"bg-white text-gray-800 border-gray-200"}`}>Windows (PowerShell)</button>
          </div>
          <div className="bg-gray-900 text-gray-100 rounded-xl p-3 font-mono text-xs overflow-x-auto">
            {osTab === "windows" ? (mintCmdWin || "…") : (mintCmd || "…")}
          </div>
          <div className="flex gap-2">
            <button className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl" onClick={async()=>{try{await navigator.clipboard.writeText(osTab==="windows"?mintCmdWin:mintCmd);}catch{}}}>Copy command</button>
            <button className="bg-gray-200 hover:bg-gray-300 text-gray-900 px-4 py-2 rounded-xl" onClick={async()=>{try{await navigator.clipboard.writeText(mintToken);}catch{}}}>Copy token only</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
