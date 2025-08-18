import { useState, useEffect } from "react";
import Script from "next/script";

export default function Home() {
  const [status, setStatus] = useState("checking...");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/status")
      .then((res) => res.json())
      .then((data) => setStatus(data.status || "offline"))
      .catch(() => setStatus("offline"));
  }, []);

  const templates = [
    { name: "Whisper ASR", price: 100, desc: "Speech-to-text on GPU" },
    { name: "Stable Diffusion", price: 200, desc: "Text-to-Image AI" },
    { name: "LLaMA Inference", price: 300, desc: "Run an LLM on GPU" },
  ];

  const createOrder = async (template, price) => {
    const r = await fetch("/api/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template, amountInRupees: price }),
    });
    const data = await r.json();
    if (!r.ok) {
      if (r.status === 409 && data?.error === "gpu_busy") {
        throw new Error("GPU is busy. Please try again later.");
      }
      throw new Error(data?.error || "Order creation failed");
    }
    return data;
  };

  const openRazorpay = async (template, price) => {
    try {
      setLoading(true);
      const order = await createOrder(template, price);

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_xxxxxx",
        amount: order.amount,
        currency: order.currency,
        order_id: order.id,
        name: "Indianode Cloud",
        description: `Deployment for ${template}`,
        handler: function (response) {
          alert("Payment success: " + response.razorpay_payment_id);
        },
        theme: { color: "#111827" },
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (e) {
      alert(e.message);
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
          Current GPU Status:{" "}
          <span className="font-semibold">{status}</span>
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {templates.map((t) => (
            <div
              key={t.name}
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
                onClick={() => openRazorpay(t.name, t.price)}
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

      {/* New Contact Section */}
      <section className="mt-16 border-t pt-10 pb-6 text-center text-sm text-gray-700">
        <p className="mb-2">
          💬 Looking for custom pricing, discounts, or rate concessions? Reach out:
        </p>
        <p>
          Email:{" "}
          <a
            href="mailto:tvavinash@gmail.com"
            className="text-blue-600 hover:underline"
          >
            tvavinash@gmail.com
          </a>
        </p>
        <p>
          Phone:{" "}
          <a
            href="tel:+91 902818004"
            className="text-blue-600 hover:underline"
          >
            +91 9902818004
          </a>
        </p>
        <p className="mt-3 text-xs text-gray-400">
          We usually reply within 24 hours.
        </p>
      </section>

      <footer className="p-4 text-center text-sm text-gray-600">
        © 2025 Indianode
      </footer>
    </div>
  );
}
