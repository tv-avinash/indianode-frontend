import { useState, useEffect } from "react";
import Script from "next/script";

export default function Home() {
  const [status, setStatus] = useState("checking...");
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [promo, setPromo] = useState("");

  const [interest, setInterest] = useState("sd");
  const [wlMsg, setWlMsg] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/status")
      .then((res) => res.json())
      .then((data) => setStatus(data.status || "offline"))
      .catch(() => setStatus("offline"));
  }, []);

  // “Price for 60 minutes” (₹)
  const price60 = { whisper: 100, sd: 200, llama: 300 };
  // Keep UI discount consistent with backend (env or default 5)
  const DISCOUNT_RUPEES = Number(process.env.NEXT_PUBLIC_PROMO_FLAT_OFF_RUPEES || 5);

  function computeBase(key, mins) {
    const base = price60[key];
    if (!base) return 0;
    const m = Math.max(1, Number(mins || 60));
    return Math.ceil((base / 60) * m);
  }
  function computeDiscount(key, mins, promoCode) {
    const code = String(promoCode || "").trim().toUpperCase();
    if ((code === "TRY" || code === "TRY10") && DISCOUNT_RUPEES > 0) {
      const base = computeBase(key, mins);
      return Math.min(DISCOUNT_RUPEES, Math.max(0, base - 1)); // never go below ₹1 total
    }
    return 0;
  }
  function computePrice(key, mins, promoCode) {
    const base = computeBase(key, mins);
    const off = computeDiscount(key, mins, promoCode);
    return Math.max(1, base - off);
  }

  const templates = [
    { key: "whisper", name: "Whisper ASR",      desc: "Speech-to-text on GPU" },
    { key: "sd",      name: "Stable Diffusion", desc: "Text-to-Image AI" },
    { key: "llama",   name: "LLaMA Inference",  desc: "Run an LLM on GPU" },
  ];

  async function createOrder({ product, minutes, userEmail, promo }) {
    const r = await fetch("/api/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product, minutes, userEmail, promo }),
    });
    const data = await r.json();
    if (!r.ok) {
      if (r.status === 409 && data?.error === "gpu_busy") {
        throw new Error("GPU is busy. Please try again later.");
      }
      throw new Error(data?.error || "Order creation failed");
    }
    return data;
  }

  async function openRazorpay({ product, displayName }) {
    try {
      setMsg("");
      setLoading(true);

      const userEmail = (email || "").trim();
      if (!userEmail) setMsg("Tip: add your email so we can send your deploy URL + receipt.");

      const order = await createOrder({ product, minutes, userEmail, promo });

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_xxxxxx",
        amount: order.amount,
        currency: order.currency,
        order_id: order.id,
        name: "Indianode Cloud",
        description: `Deployment for ${displayName} (${minutes} min)`,
        prefill: userEmail ? { email: userEmail } : undefined,
        notes: { minutes: String(minutes), product, email: userEmail, promo: (promo || "").trim() },
        theme: { color: "#111827" },
        handler: function (response) {
          alert("Payment success: " + response.razorpay_payment_id);
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (resp) {
        alert(resp?.error?.description || "Payment failed");
      });
      rzp.open();
    } catch (e) {
      alert(e.message || "Something went wrong");
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
          note: (promo?.trim().toUpperCase() === "TRY" || promo?.trim().toUpperCase() === "TRY10") ? "Promo applied" : "",
        }),
      });
      if (!r.ok) throw new Error("waitlist_failed");
      setWlMsg("Thanks! We’ll email you as soon as the GPU is free.");
    } catch {
      setWlMsg("Could not join waitlist. Please try again.");
    }
  }

  const busy = status !== "available";
  const disabled = loading;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />
      <header className="p-6 bg-gray-900 text-white text-center text-2xl font-bold">Indianode GPU Cloud</header>

      <main className="p-8 max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-3 text-center">3090 GPU on demand • India billing • deploy in minutes</h1>
        <p className="text-center mb-6 text-lg">
          Current GPU Status: <span className="font-semibold">{status}</span>
        </p>

        {/* Buyer inputs */}
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow p-6 mb-8">
          <div className="grid md:grid-cols-3 gap-4">
            <label className="flex flex-col">
              <span className="text-sm font-semibold mb-1">Your email (for receipts)</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="border rounded-lg px-3 py-2" disabled={loading} />
            </label>
            <label className="flex flex-col">
              <span className="text-sm font-semibold mb-1">Minutes</span>
              <input type="number" min="1" max="240" value={minutes} onChange={(e) => setMinutes(Math.max(1, Number(e.target.value || 1)))} className="border rounded-lg px-3 py-2" disabled={loading} />
            </label>
            <label className="flex flex-col">
              <span className="text-sm font-semibold mb-1">Promo code</span>
              <input value={promo} onChange={(e) => setPromo(e.target.value)} placeholder="TRY or TRY10" className="border rounded-lg px-3 py-2" disabled={loading} />
            </label>
          </div>

          {busy && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="text-sm text-amber-800 mb-3">
                GPU is busy. You can still open checkout (we’ll start your job when it’s free), or join the waitlist:
              </div>
              <div className="grid md:grid-cols-3 gap-3">
                <label className="flex flex-col">
                  <span className="text-xs font-semibold mb-1">Email</span>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="border rounded-lg px-3 py-2" />
                </label>
                <label className="flex flex-col">
                  <span className="text-xs font-semibold mb-1">Interested in</span>
                  <select value={interest} onChange={(e) => setInterest(e.target.value)} className="border rounded-lg px-3 py-2">
                    <option value="sd">Stable Diffusion</option>
                    <option value="whisper">Whisper ASR</option>
                    <option value="llama">LLaMA Inference</option>
                  </select>
                </label>
                <div className="flex items-end">
                  <button onClick={joinWaitlist} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl">Notify me</button>
                </div>
              </div>
              {wlMsg && <div className="text-xs text-gray-700 mt-3">{wlMsg}</div>}
            </div>
          )}
        </div>

        {msg ? <div className="max-w-xl mx-auto mb-6 text-center text-sm text-amber-700 bg-amber-100 border border-amber-200 rounded-xl px-4 py-2">{msg}</div> : null}

        {/* Product cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {templates.map((t) => {
            const base = computeBase(t.key, minutes);
            const off  = computeDiscount(t.key, minutes, promo);
            const total = Math.max(1, base - off);
            return (
              <div key={t.key} className="bg-white shadow-lg rounded-2xl p-6 flex flex-col justify-between">
                <div>
                  <h2 className="text-xl font-bold mb-2">{t.name}</h2>
                  <p className="text-gray-600 mb-3">{t.desc}</p>
                  {off > 0 ? (
                    <p className="text-gray-800">
                      <span className="font-semibold">Price for {minutes} min:</span>{" "}
                      <span className="line-through text-gray-500">₹{base}</span>{" "}
                      <span className="font-semibold">₹{total}</span>{" "}
                      <span className="text-green-700 text-sm">(₹{off} off)</span>
                    </p>
                  ) : (
                    <p className="text-gray-800">
                      <span className="font-semibold">Price for {minutes} min:</span> ₹{total}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">(₹{price60[t.key]} for 60 min)</p>
                </div>
                <button
                  className={`mt-4 text-white px-4 py-2 rounded-xl ${disabled ? "bg-gray-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"}`}
                  onClick={() => openRazorpay({ product: t.key, displayName: t.name })}
                  disabled={disabled}
                >
                  {loading ? "Opening Checkout..." : `Pay ₹${total} • Deploy ${t.name}`}
                </button>
              </div>
            );
          })}
        </div>
      </main>

      <section className="mt-16 border-t pt-10 pb-6 text-center text-sm text-gray-700">
        <p className="mb-2">💬 Looking for custom pricing, discounts, or rate concessions? Reach out:</p>
        <p>Email: <a href="mailto:tvavinash@gmail.com" className="text-blue-600 hover:underline">tvavinash@gmail.com</a></p>
        <p>Phone: <a href="tel:+919902818004" className="text-blue-600 hover:underline">+919902818004</a></p>
        <p className="mt-3 text-xs text-gray-400">We usually reply within 24 hours.</p>
      </section>

      <footer className="p-4 text-center text-sm text-gray-600">© 2025 Indianode</footer>
    </div>
  );
}
