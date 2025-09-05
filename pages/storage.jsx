// pages/storage.jsx
import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Script from "next/script";
import Link from "next/link";

const gaEvent = (name, params = {}) => {
  try { if (typeof window !== "undefined" && window.gtag) window.gtag("event", name, params); } catch {}
};

function Modal({ open, onClose, children, title = "Next steps" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl mx-2 rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-base">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-gray-100" aria-label="Close">✕</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export default function Storage() {
  // Inputs
  const [email, setEmail] = useState("");
  const [bucketName, setBucketName] = useState("");
  const [notes, setNotes] = useState("");

  // UI
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // Plans (per month)
  const plans = useMemo(() => ([
    { sku: "s50",  name: "S3 Bucket • 50 GB",   sizeGB: 50,  inr: 99 },
    { sku: "s200", name: "S3 Bucket • 200 GB",  sizeGB: 200, inr: 299 },
    { sku: "s1000",name: "S3 Bucket • 1 TB",    sizeGB: 1000,inr: 999 },
  ]), []);

  // Build run command (same pattern as compute.jsx)
  function getRunUrl() {
    try { if (typeof window !== "undefined") return `${window.location.origin}/api/storage/run.sh`; } catch {}
    return "https://www.indianode.com/api/storage/run.sh";
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

  // API helpers
  async function createOrderStorage({ plan, userEmail, bucketName, notes }) {
    const r = await fetch("/api/storage/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, userEmail, bucketName, notes }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error || "order_failed");
    return j;
  }
  async function mintAfterPaymentStorage({ paymentId, plan, email, bucketName, notes }) {
    const r = await fetch("/api/storage/mint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId, plan, email, bucketName, notes }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error || "token_mint_failed");
    return j;
  }

  // Razorpay payment (uses same env var as compute.jsx)
  async function payWithRazorpay({ plan, displayName }) {
    try {
      setMsg("");
      setLoading(true);
      const userEmail = (email || "").trim();
      const bucket = (bucketName || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 63);
      if (!bucket) {
        setLoading(false);
        return alert("Please enter a bucket name (lowercase letters, numbers, hyphen).");
      }
      const order = await createOrderStorage({ plan, userEmail, bucketName: bucket, notes });
      const valueInr = Number(((order.amount || 0) / 100).toFixed(2));

      gaEvent("begin_checkout", {
        value: valueInr,
        currency: order.currency || "INR",
        items: [{ item_id: plan, item_name: displayName, item_category: "storage", quantity: 1, price: valueInr }],
        payment_method: "razorpay",
      });

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_xxxxxx",
        amount: order.amount,
        currency: order.currency,
        order_id: order.id,
        name: "Indianode Cloud",
        description: `S3 Storage: ${displayName} (monthly)`,
        prefill: userEmail ? { email: userEmail } : undefined,
        notes: { plan, email: userEmail, bucketName: bucket },
        theme: { color: "#111827" },
        handler: async (response) => {
          try {
            const result = await mintAfterPaymentStorage({
              paymentId: response.razorpay_payment_id,
              plan,
              email: userEmail,
              bucketName: bucket,
              notes,
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
              items: [{ item_id: plan, item_name: displayName, item_category: "storage", quantity: 1, price: valueInr }],
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

  return (
    <>
      <Head>
        <title>Object Storage — Indianode</title>
        <meta name="description" content="S3-compatible buckets on demand. Pay monthly with Razorpay; no crypto wallet needed." />
        <link rel="canonical" href="https://www.indianode.com/storage" />
      </Head>

      <div className="min-h-screen bg-gray-50 text-gray-900">
        <Script src="https://checkout.razorpay.com/v1/checkout.js" />

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

        <main className="max-w-6xl mx-auto px-4 pt-4 pb-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold leading-tight">S3 Buckets on demand</h1>
              <p className="text-sm text-gray-600">Pay monthly with Razorpay. We’ll provision a MinIO bucket and give you endpoint + keys.</p>
            </div>

            <div className="bg-white rounded-xl shadow border px-3 py-2">
              <div className="grid grid-cols-3 gap-2 items-end">
                <label className="flex flex-col">
                  <span className="text-[11px] font-semibold">Email (optional)</span>
                  <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)}
                    placeholder="you@example.com" className="border rounded-md px-2 py-1 text-sm" />
                </label>
                <label className="flex flex-col">
                  <span className="text-[11px] font-semibold">Bucket name</span>
                  <input value={bucketName} onChange={(e)=>setBucketName(e.target.value)}
                    placeholder="my-dataset" className="border rounded-md px-2 py-1 text-sm" />
                </label>
                <label className="flex flex-col">
                  <span className="text-[11px] font-semibold">Notes</span>
                  <input value={notes} onChange={(e)=>setNotes(e.target.value)}
                    placeholder="anything useful for you" className="border rounded-md px-2 py-1 text-sm" />
                </label>
              </div>
            </div>
          </div>

          {msg && <div className="mt-2 text-center text-xs text-emerald-800 bg-emerald-100 border border-emerald-200 rounded-lg px-3 py-1.5">{msg}</div>}

          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            {plans.map((p) => (
              <div key={p.sku} className="bg-white border rounded-2xl shadow p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold">{p.name}</h2>
                    <span className="text-[11px] text-gray-500">Monthly</span>
                  </div>
                  <p className="mt-2 text-sm"><span className="font-medium">Price:</span> ₹{p.inr}/mo</p>
                </div>
                <div className="grid gap-2 mt-3">
                  <button
                    className={`text-white px-3 py-1.5 text-sm rounded-lg ${loading ? "bg-gray-400 cursor-not-allowed":"bg-indigo-600 hover:bg-indigo-700"}`}
                    onClick={()=>payWithRazorpay({ plan: p.sku, displayName: p.name })}
                    disabled={loading}
                  >
                    Pay ₹{p.inr} • Razorpay
                  </button>
                </div>
              </div>
            ))}
          </div>
        </main>

        <footer className="px-4 py-3 text-center text-xs text-gray-600">
          <nav className="mb-1 space-x-3">
            <Link href="/" className="text-blue-600 hover:underline">Home</Link>
            <Link href="/compute" className="text-blue-600 hover:underline">Compute</Link>
            <Link href="/storage" className="text-blue-600 hover:underline">Storage</Link>
          </nav>
          © {new Date().getFullYear()} Indianode
        </footer>
      </div>

      <Modal open={mintOpen} onClose={()=>setMintOpen(false)} title="Payment verified — run this command">
        <div className="space-y-2">
          <p className="text-sm text-gray-700">We minted a one-time <b>ORDER_TOKEN</b>. Run this from your machine (not the host VM).</p>
          <div className="flex gap-2 text-[11px]">
            <button onClick={()=>setOsTab("linux")}
              className={`px-2.5 py-1 rounded border ${osTab==="linux"?"bg-gray-900 text-white border-gray-900":"bg-white text-gray-800 border-gray-200"}`}>macOS / Linux</button>
            <button onClick={()=>setOsTab("windows")}
              className={`px-2.5 py-1 rounded border ${osTab==="windows"?"bg-gray-900 text-white border-gray-900":"bg-white text-gray-800 border-gray-200"}`}>Windows (PowerShell)</button>
          </div>
          <div className="bg-gray-900 text-gray-100 rounded-xl p-3 font-mono text-xs overflow-x-auto">
            {osTab === "windows" ? mintCmdWin || "…" : mintCmd || "…"}
          </div>
          <div className="flex gap-2">
            <button className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded-lg text-sm"
              onClick={async()=>{ try{ await navigator.clipboard.writeText(osTab==="windows"?mintCmdWin:mintCmd);}catch{}}}>Copy command</button>
            <button className="bg-gray-200 hover:bg-gray-300 text-gray-900 px-3 py-1.5 rounded-lg text-sm"
              onClick={async()=>{ try{ await navigator.clipboard.writeText(mintToken);}catch{}}}>Copy token only</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
