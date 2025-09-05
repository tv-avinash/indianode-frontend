// pages/compute-sdl.js
import { useMemo, useState } from "react";
import Script from "next/script";

const RZP_KEY = process.env.NEXT_PUBLIC_RAZORPAY_KEY || "";
const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ||
  (typeof window !== "undefined" ? window.location.origin : "https://www.indianode.com");

// --- helpers ---------------------------------------------------------------
function toBase64Utf8(s) {
  // handle non-ASCII safely in the browser
  try {
    return btoa(unescape(encodeURIComponent(s)));
  } catch {
    return btoa(s);
  }
}
function trimMultiline(s = "") {
  return (s || "").replace(/^\s+|\s+$/g, "");
}
function isTryPromo(p) {
  const v = String(p || "").trim().toUpperCase();
  return v === "TRY" || v === "TRY10";
}
function minutesClamp(n) {
  const m = Number(n || 1) || 1;
  return Math.max(1, Math.min(60 * 24, m)); // 1..1440
}

// Same shape as compute.js: we ask the server to compute final amount.
// We still compute a preview label client-side for the button.
function previewAmountINR(minutes, promo) {
  if (isTryPromo(promo)) return 1; // ₹1 test promo (same UX as compute)
  // default ₹1/min preview (server will authoritatively price)
  return minutesClamp(minutes) * 1;
}

// --- page ------------------------------------------------------------------
export default function ComputeSDL() {
  const [email, setEmail] = useState("");
  const [minutes, setMinutes] = useState(1);
  const [promo, setPromo] = useState("");
  const [name, setName] = useState("custom-sdl");
  const [notes, setNotes] = useState("");
  const [sdl, setSdl] = useState(
    `version: "2.0"

services:
  web:
    image: nginx:alpine
    expose:
      - port: 80
        as: 80
        to:
          - global: true

deployment:
  web:
    dcloud:
      profile: web
      count: 1
`.replace(/\r\n/g, "\n")
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [orderToken, setOrderToken] = useState(""); // minted after verify
  const [visibleModal, setVisibleModal] = useState(false);

  const sdlB64 = useMemo(() => toBase64Utf8(trimMultiline(sdl)), [sdl]);
  const btnLabel = useMemo(() => {
    const rs = previewAmountINR(minutes, promo);
    return `Pay ₹${rs} · Razorpay`;
  }, [minutes, promo]);

  // ----- backend calls (same endpoints as compute.js) ----------------------
  async function createOrder() {
    // mirror compute.js body shape as closely as possible
    const body = {
      sku: "generic", // worker interprets "generic" the same way your compute.js does
      minutes: minutesClamp(minutes),
      email: String(email || ""),
      promo: String(promo || ""),
      kind: "sdl", // backend may ignore, but harmless hint
      meta: {
        sdlName: String(name || ""),
        sdlNotes: String(notes || ""),
      },
    };
    const r = await fetch("/api/compute/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await r.json().catch(() => ({}));
    if (!r.ok || !json || json.ok === false) {
      throw new Error(json?.error || "Could not create order");
    }
    // expected (same as compute.js): { ok:true, order:{ id, amount, currency }, pay_gateway:'razorpay', ... }
    return json;
  }

  async function verifyPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
    // Same verify endpoint compute.js uses; backend mints ORDER_TOKEN on success.
    const r = await fetch("/api/compute/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        // include what we need in the token claims (server side)
        minutes: minutesClamp(minutes),
        sku: "generic",
        email: String(email || ""),
        kind: "sdl",
        meta: { sdlName: String(name || ""), sdlNotes: String(notes || "") },
      }),
    });
    const json = await r.json().catch(() => ({}));
    if (!r.ok || !json || json.ok === false || !json.token) {
      throw new Error(json?.error || "Payment verify failed");
    }
    return json.token; // ORDER_TOKEN
  }

  // ----- main click --------------------------------------------------------
  async function onPay() {
    setError("");
    setSubmitting(true);
    try {
      // basic validation
      if (!trimMultiline(sdl)) {
        throw new Error("SDL is empty.");
      }

      // 1) create the order (server provides amount, currency, order id)
      const orderResp = await createOrder();

      // If your backend (like compute.js) short-circuits TRY/TRY10 and returns
      // a free development token immediately (no Razorpay), handle it:
      if (orderResp.free === true && orderResp.token) {
        setOrderToken(orderResp.token);
        setVisibleModal(true);
        return;
      }

      const order = orderResp.order || orderResp; // be liberal: {order:{...}} or top-level
      if (!RZP_KEY) {
        throw new Error("Razorpay key missing. Set NEXT_PUBLIC_RAZORPAY_KEY.");
      }
      if (!(window && window.Razorpay)) {
        throw new Error("Razorpay script not loaded yet.");
      }

      // 2) open Razorpay Checkout (same as compute.js)
      const rzp = new window.Razorpay({
        key: RZP_KEY,
        order_id: order.id,
        amount: order.amount, // paise
        currency: order.currency || "INR",
        name: "Indianode Cloud",
        description: name || "Custom SDL",
        prefill: {
          email: email || undefined,
        },
        notes: {
          minutes: String(minutesClamp(minutes)),
          sku: "generic",
          kind: "sdl",
          sdlName: name || "",
        },
        handler: async (response) => {
          try {
            const token = await verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            setOrderToken(token);
            setVisibleModal(true);
          } catch (e) {
            setError(e?.message || "Verify failed");
          }
        },
        modal: {
          ondismiss: () => {
            setSubmitting(false);
          },
        },
      });
      rzp.open();
    } catch (e) {
      setError(e?.message || "Could not create order. Please try again.");
    } finally {
      // don’t reset submitting here – it’s reset by Razorpay ondismiss or after handler work
      // but ensure we drop the spinner if we failed before checkout
      setTimeout(() => setSubmitting(false), 100);
    }
  }

  // ----- command modal rendering ------------------------------------------
  const linuxCommand = useMemo(() => {
    if (!orderToken) return "";
    return [
      `export ORDER_TOKEN='${orderToken}'`,
      `export SDL_B64='${sdlB64}'`,
      `bash <(curl -fsSL ${BASE_URL}/api/compute/run-sdl.sh)`,
    ].join("\n");
  }, [orderToken, sdlB64]);

  const winCommand = useMemo(() => {
    if (!orderToken) return "";
    return [
      `$env:ORDER_TOKEN = '${orderToken}'`,
      `$env:SDL_B64 = '${sdlB64}'`,
      `(Invoke-WebRequest -UseBasicParsing ${BASE_URL}/api/compute/run-sdl.sh).Content | bash`,
    ].join("\n");
  }, [orderToken, sdlB64]);

  function copy(text) {
    navigator.clipboard?.writeText(text);
  }

  // ----- UI ---------------------------------------------------------------
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <h1 className="text-2xl font-semibold mb-6">Custom SDL</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Email (optional)</label>
          <input
            className="w-full border rounded px-3 py-2"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Minutes</label>
          <input
            className="w-full border rounded px-3 py-2"
            type="number"
            min={1}
            max={1440}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Promo</label>
          <input
            className="w-full border rounded px-3 py-2"
            placeholder="TRY / TRY10"
            value={promo}
            onChange={(e) => setPromo(e.target.value)}
          />
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm text-gray-600 mb-1">Name</label>
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="custom-sdl"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="mb-6">
        <label className="block text-sm text-gray-600 mb-1">Notes (optional, not sent to payment)</label>
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="anything useful for you to remember"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">SDL (YAML)</label>
        <textarea
          className="w-full border rounded px-3 py-2 font-mono text-sm"
          rows={18}
          spellCheck={false}
          value={sdl}
          onChange={(e) => setSdl(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={onPay}
          disabled={submitting || (!RZP_KEY && !isTryPromo(promo))}
          className={`px-4 py-2 rounded text-white ${
            submitting || (!RZP_KEY && !isTryPromo(promo))
              ? "bg-gray-400"
              : "bg-indigo-600 hover:bg-indigo-700"
          }`}
        >
          {submitting ? "Processing…" : `Pay & Get Command (${btnLabel})`}
        </button>
        {!RZP_KEY && !isTryPromo(promo) && (
          <div className="text-sm text-gray-600">
            Razorpay key missing. Set <code className="px-1 bg-gray-100 rounded">NEXT_PUBLIC_RAZORPAY_KEY</code>.
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 p-3 rounded border border-red-200 bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Modal */}
      {visibleModal && orderToken && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-semibold">Payment verified — run this command</h2>
              <button
                className="text-gray-500 hover:text-gray-700"
                onClick={() => setVisibleModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              We minted a one-time <strong>ORDER_TOKEN</strong>. Run the command below from your own machine
              (not the Akash host VM).
            </p>

            <div className="flex gap-2 mb-2">
              <span className="px-2 py-1 rounded bg-gray-100 text-xs">macOS / Linux</span>
              <span className="px-2 py-1 rounded bg-gray-100 text-xs">Windows (PowerShell)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <pre className="bg-gray-900 text-gray-100 text-xs p-3 rounded overflow-auto">
{linuxCommand}
                </pre>
                <button
                  onClick={() => copy(linuxCommand)}
                  className="mt-2 px-3 py-1.5 rounded bg-gray-800 text-white text-xs"
                >
                  Copy command
                </button>
              </div>
              <div>
                <pre className="bg-gray-900 text-gray-100 text-xs p-3 rounded overflow-auto">
{winCommand}
                </pre>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => copy(winCommand)}
                    className="px-3 py-1.5 rounded bg-gray-800 text-white text-xs"
                  >
                    Copy command
                  </button>
                  <button
                    onClick={() => copy(orderToken)}
                    className="px-3 py-1.5 rounded bg-gray-100 text-gray-900 text-xs"
                  >
                    Copy token only
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 text-xs text-gray-600">
              This will export <code>ORDER_TOKEN</code> and <code>SDL_B64</code> then pipe&nbsp;
              <code>run-sdl.sh</code> from {BASE_URL}.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
