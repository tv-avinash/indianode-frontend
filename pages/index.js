import { useState, useEffect } from "react";
import Script from "next/script";

export default function Home() {
  const [status, setStatus] = useState("checking...");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");     // NEW: capture buyer email
  const [minutes, setMinutes] = useState(60); // NEW: rental duration (mins)
  const [msg, setMsg] = useState("");         // NEW: small message banner

  useEffect(() => {
    fetch("/api/status")
      .then((res) => res.json())
      .then((data) => setStatus(data.status || "offline"))
      .catch(() => setStatus("offline"));
  }, []);

  // Display cards, but also carry the product "key" your backend expects
  const templates = [
    { key: "whisper", name: "Whisper ASR",      price: 100, desc: "Speech-to-text on GPU" },
    { key: "sd",      name: "Stable Diffusion", price: 200, desc: "Text-to-Image AI" },
    { key: "llama",   name: "LLaMA Inference",  price: 300, desc: "Run an LLM on GPU" },
  ];

  // Create a Razorpay order on the server with proper notes {product, minutes, userEmail}
  const createOrder = async ({ product, minutes, userEmail }) => {
    const r = await fetch("/api/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product, minutes, userEmail }),
    });
    const data = await r.json();
    if (!r.ok) {
      if (r.status === 409 && data?.error === "gpu_busy") {
        throw new Error("GPU is busy. Please try again later.");
      }
      throw new Error(data?.error || "Order creation failed");
    }
    return data; // { id, amount, currency, notes, ... }
  };

  const openRazorpay = async ({ product, displayName }) => {
    try {
      setMsg("");
      setLoading(true);

      // gentle email check (optional)
      const userEmail = email?.trim() || "";
      if (!userEmail) {
        setMsg("Tip: add your email so we can send the deploy URL.");
      }

      // Create the order with metadata (backend derives price)
      const order = await createOrder({ product, minutes, userEmail });

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_xxxxxx",
        amount: order.amount,
        currency: order.currency,
        order_id: order.id,
        name: "Indianode Cloud",
        description: `Deployment for ${displayName} (${minutes} min)`,
        prefill: userEmail ? { email: userEmail } : undefined,
        theme: { color: "#111827" },
        handler: function (response) {
          // Razorpay captured -> webhook will run -> deployer will start job.
          // You can show a success toast here.
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
  };

  const disabledUI = status !== "available" || loading;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />

      <header className="p-6 bg-gray-900 text-white text-center text-2xl font-bold">
        Indianode GPU Cloud
      </header>

      <main className="p-8 max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center">
          Rent Powerful GPUs on Demand
        </h1>

        <p className="text-center mb-6 text-lg">
          Current GPU Status: <span className="font-semibold">{status}</span>
        </p>

        {/* NEW: Buyer info / duration row */}
        <div className="max-w-xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
          <input
            type="email"
            className="col-span-2 border rounded-xl px-4 py-2"
            placeholder="Your email (optional, for receipt/status)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
          <select
            className="border rounded-xl px-4 py-2"
            value={minutes}
            onChange={(e) => setMinutes(parseInt(e.target.value || "60", 10))}
            disabled={loading}
          >
            {[30, 60, 90, 120].map((m) => (
              <option key={m} value={m}>{m} minutes</option>
            ))}
          </select>
        </div>

        {msg ? (
          <div className="max-w-xl mx-auto mb-6 text-center text-sm text-amber-700 bg-amber-100 border border-amber-200 rounded-xl px-4 py-2">
            {msg}
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {templates.map((t) => (
            <div
              key={t.key}
              className="bg-white shadow-lg rounded-2xl p-6 flex flex-col justify-between"
            >
              <div>
                <h2 className="text-xl font-bold mb-2">{t.name}</h2>
                <p className="text-gray-600 mb-4">{t.desc}</p>
              </div>
              <button
                className={`mt-4 text-white px-4 py-2 rounded-xl ${
                  disabledUI
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-700"
                }`}
                onClick={() => openRazorpay({ product: t.key, displayName: t.name })}
                disabled={disabledUI}
              >
                {status === "available"
                  ? loading
                    ? "Opening Checkout..."
                    : `Deploy for ₹${t.price}`
                  : "GPU Busy"}
              </button>
            </div>
          ))}
        </div>
      </main>

      {/* Contact Section */}
      <section className="mt-16 border-t pt-10 pb-6 text-center text-sm text-gray-700">
        <p className="mb-2">
          💬 Looking for custom pricing, discounts, or rate concessions? Reach out:
        </p>
        <p>
          Email:{" "}
          <a href="mailto:tvavinash@gmail.com" className="text-blue-600 hover:underline">
            tvavinash@gmail.com
          </a>
        </p>
        <p>
          Phone:{" "}
          <a href="tel:+919902818004" className="text-blue-600 hover:underline">
            +919902818004
          </a>
        </p>
        <p className="mt-3 text-xs text-gray-400">We usually reply within 24 hours.</p>
      </section>

      <footer className="p-4 text-center text-sm text-gray-600">© 2025 Indianode</footer>
    </div>
  );
}
