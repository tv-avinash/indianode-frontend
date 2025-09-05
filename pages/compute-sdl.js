// pages/compute-sdl.js
import { useEffect, useMemo, useState } from "react";

const BASE =
  process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ||
  "https://www.indianode.com";
const RZP_KEY = process.env.NEXT_PUBLIC_RAZORPAY_KEY || ""; // same as compute.js

function loadRazorpay() {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

// utf8 → b64 (browser-safe)
function toB64Utf8(str) {
  try {
    return btoa(unescape(encodeURIComponent(str)));
  } catch {
    return "";
  }
}

export default function ComputeSDLPage() {
  // keep these parallel to compute.js so the server sees the same keys
  const [minutes, setMinutes] = useState(1);
  const [email, setEmail] = useState("");
  const [promo, setPromo] = useState("");
  const [sdlName, setSdlName] = useState("custom-sdl");
  const [sdlNotes, setSdlNotes] = useState("");
  const [sdlText, setSdlText] = useState(
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
`
  );

  const sdlB64 = useMemo(() => toB64Utf8(sdlText), [sdlText]);

  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState(""); // same UX as compute.js
  const [orderId, setOrderId] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [orderToken, setOrderToken] = useState("");

  // match compute.js: create order → open Razorpay → verify → get ORDER_TOKEN
  async function onPayClick() {
    setBanner("");
    if (!sdlText.trim()) {
      setBanner("Please paste a valid SDL YAML.");
      return;
    }
    if (!RZP_KEY) {
      setBanner("Razorpay key missing. Set NEXT_PUBLIC_RAZORPAY_KEY.");
      return;
    }

    setBusy(true);
    try {
      // 1) create order (EXACT same body shape compute.js uses)
      const co = await fetch("/api/compute/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: "generic",
          minutes: Number(minutes || 1),
          email: email || "",
          promo: promo || "",
        }),
      }).then((r) => r.json());

      if (!co?.ok || !co?.order?.id) {
        throw new Error(co?.error || "Could not create order");
      }
      setOrderId(co.order.id);

      // 2) ensure Razorpay is loaded
      const ok = await loadRazorpay();
      if (!ok) throw new Error("Could not load Razorpay");

      // 3) open Razorpay (mirrors compute.js)
      const opts = {
        key: RZP_KEY,
        amount: co.order.amount,
        currency: co.order.currency || "INR",
        name: "Indianode Cloud",
        description: `Custom SDL · ${minutes} min`,
        order_id: co.order.id,
        prefill: { email },
        notes: { sku: "generic", minutes: String(minutes || 1) },
        handler: async (payload) => {
          try {
            // 4) verify (EXACT same body shape compute.js uses)
            const vr = await fetch("/api/compute/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sku: "generic",
                minutes: Number(minutes || 1),
                razorpay_payment_id: payload.razorpay_payment_id,
                razorpay_order_id: payload.razorpay_order_id,
                razorpay_signature: payload.razorpay_signature,
              }),
            }).then((r) => r.json());

            if (!vr?.ok || !vr?.token) {
              throw new Error(vr?.error || "Payment verification failed");
            }

            setOrderToken(vr.token);
            setShowModal(true);
          } catch (e) {
            setBanner(e.message || "Payment verification failed");
          }
        },
        modal: {
          ondismiss: () => setBusy(false),
        },
        theme: { color: "#6D28D9" },
      };

      const rzp = new window.Razorpay(opts);
      rzp.on("payment.failed", (e) => {
        setBanner(e?.error?.description || "Payment failed");
        setBusy(false);
      });
      rzp.open();
    } catch (e) {
      setBanner(e.message || "Could not create order. Please try again.");
      setBusy(false);
    }
  }

  // modal command builders (identical style to compute.js)
  const cmdBash = useMemo(() => {
    if (!orderToken) return "";
    const lines = [
      `export MINUTES='${Number(minutes || 1)}'`,
      `export ORDER_TOKEN='${orderToken}'`,
      sdlB64 ? `export SDL_B64='${sdlB64}'` : `export SDL='${sdlText.replace(/'/g, "'\\''")}'`,
      sdlName ? `export SDL_NAME='${sdlName}'` : "",
      sdlNotes ? `export SDL_NOTES='${sdlNotes}'` : "",
      `bash <(curl -fsSL ${BASE}/api/compute/run-sdl.sh)`,
    ].filter(Boolean);
    return lines.join("\n");
  }, [orderToken, sdlB64, sdlText, minutes, sdlName, sdlNotes]);

  const cmdPS = useMemo(() => {
    if (!orderToken) return "";
    const lines = [
      `$env:MINUTES='${Number(minutes || 1)}'`,
      `$env:ORDER_TOKEN='${orderToken}'`,
      sdlB64
        ? `$env:SDL_B64='${sdlB64}'`
        : `$env:SDL=@'\n${sdlText.replace(/'/g, "''")}\n'@`,
      sdlName ? `$env:SDL_NAME='${sdlName}'` : "",
      sdlNotes ? `$env:SDL_NOTES='${sdlNotes}'` : "",
      `(Invoke-WebRequest -UseBasicParsing ${BASE}/api/compute/run-sdl.sh).Content | bash`,
    ].filter(Boolean);
    return lines.join("\n");
  }, [orderToken, sdlB64, sdlText, minutes, sdlName, sdlNotes]);

  function copy(txt) {
    navigator.clipboard.writeText(txt).then(
      () => setBanner("Copied!"),
      () => setBanner("Copy failed")
    );
  }

  return (
    <div className="container" style={{ maxWidth: 980, margin: "32px auto", padding: "0 16px" }}>
      <h1>Custom SDL</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, margin: "16px 0 24px" }}>
        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Email (optional)</div>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{ width: "100%" }}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Minutes</div>
          <input
            type="number"
            min={1}
            value={minutes}
            onChange={(e) => setMinutes(Math.max(1, Number(e.target.value || 1)))}
            style={{ width: "100%" }}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Promo</div>
          <input
            value={promo}
            onChange={(e) => setPromo(e.target.value)}
            placeholder="TRY / TRY10"
            style={{ width: "100%" }}
          />
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, opacity: 0.8 }}>Name</div>
        <input value={sdlName} onChange={(e) => setSdlName(e.target.value)} style={{ width: "100%" }} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, opacity: 0.8 }}>Notes (optional, not sent to payment)</div>
        <input
          value={sdlNotes}
          onChange={(e) => setSdlNotes(e.target.value)}
          placeholder="anything useful for you to remember"
          style={{ width: "100%" }}
        />
      </div>

      <div>
        <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>SDL (YAML)</div>
        <textarea
          value={sdlText}
          onChange={(e) => setSdlText(e.target.value)}
          rows={18}
          style={{ width: "100%", fontFamily: "monospace" }}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
        <button disabled={busy} onClick={onPayClick} style={btn}>
          {busy ? "Processing…" : "Pay & Get Command"}
        </button>
        {banner && <div style={{ fontSize: 13, color: "#666" }}>{banner}</div>}
      </div>

      {/* Verified modal (same UX as compute.js) */}
      {showModal && (
        <div style={modalWrap}>
          <div style={modalCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Payment verified — run this command</h3>
              <button onClick={() => setShowModal(false)} style={xbtn}>×</button>
            </div>
            <p style={{ margin: "8px 0 16px" }}>
              We minted a one-time <b>ORDER_TOKEN</b>. Run the command below from your own machine (not the Akash host VM).
            </p>

            <div style={tabsWrap}>
              <div style={{ fontSize: 12, marginBottom: 6 }}>macOS / Linux</div>
              <textarea readOnly value={cmdBash} rows={8} style={codearea} />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => copy(cmdBash)} style={btnSm}>Copy command</button>
                <button onClick={() => copy(orderToken)} style={btnSm}>Copy token only</button>
              </div>
            </div>

            <div style={{ ...tabsWrap, marginTop: 18 }}>
              <div style={{ fontSize: 12, marginBottom: 6 }}>Windows (PowerShell)</div>
              <textarea readOnly value={cmdPS} rows={8} style={codearea} />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => copy(cmdPS)} style={btnSm}>Copy command</button>
                <button onClick={() => copy(orderToken)} style={btnSm}>Copy token only</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const btn = {
  background: "#4F46E5",
  color: "#fff",
  border: 0,
  padding: "10px 14px",
  borderRadius: 8,
  cursor: "pointer",
};
const btnSm = { ...btn, padding: "8px 12px" };
const xbtn = { ...btn, background: "#e5e7eb", color: "#111827" };
const codearea = { width: "100%", fontFamily: "monospace", fontSize: 12 };
const tabsWrap = { border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 };
const modalWrap = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.3)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  zIndex: 1000,
};
const modalCard = {
  background: "#fff",
  width: "min(900px, 100%)",
  padding: 16,
  borderRadius: 10,
  boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
};
