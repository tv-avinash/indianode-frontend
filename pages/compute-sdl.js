import { useEffect, useMemo, useState } from "react";

export default function ComputeSDL() {
  const [minutes, setMinutes] = useState(60);
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

profiles:
  compute:
    web:
      resources:
        cpu:
          units: 0.1
        memory:
          size: 128Mi
        storage:
          size: 512Mi
  placement:
    dcloud:
      attributes:
        organization: akash
      signedBy:
        anyOf:
          - "akash1vz375dkt0c30t3g5pxh3e4se0zqyz8qhjx8nyd"
      pricing:
        web:
          denom: uakt
          amount: 1000

deployment:
  web:
    dcloud:
      profile: web
      count: 1
`
  );
  const [sdlName, setSdlName] = useState("custom-sdl");
  const [sdlNotes, setSdlNotes] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  // After successful payment:
  const [orderToken, setOrderToken] = useState("");
  const [bashCmd, setBashCmd] = useState("");
  const [psCmd, setPsCmd] = useState("");

  // Load Razorpay checkout script once on client
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.Razorpay) return;
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    document.body.appendChild(s);
  }, []);

  const sdlB64 = useMemo(() => {
    try {
      // robust utf-8 safe base64 in the browser
      const utf8 = new TextEncoder().encode(sdl);
      let bin = "";
      utf8.forEach((b) => (bin += String.fromCharCode(b)));
      return btoa(bin);
    } catch {
      try {
        // fallback for older browsers
        // eslint-disable-next-line no-undef
        return btoa(unescape(encodeURIComponent(sdl)));
      } catch {
        return "";
      }
    }
  }, [sdl]);

  const BASE = useMemo(() => {
    if (typeof window !== "undefined") {
      return window.location.origin;
    }
    return "https://www.indianode.com";
  }, []);

  const clearOutput = () => {
    setOrderToken("");
    setBashCmd("");
    setPsCmd("");
  };

  const validate = () => {
    if (!sdl || sdl.trim().length < 10) {
      setStatus("Please paste a valid SDL first.");
      return false;
    }
    if (!minutes || minutes < 1) {
      setStatus("Minutes must be at least 1.");
      return false;
    }
    return true;
  };

  async function createOrder() {
    // This mirrors compute.js: server decides final amount/currency.
    // Adjust the endpoint name if your compute.js uses a different one.
    const res = await fetch("/api/compute/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "sdl",       // helps backend tag this flow
        sku: "generic",
        minutes: Number(minutes),
        notes: sdlNotes || "",
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || "order_create_failed");
    }
    // expected shape (same as compute.js):
    // { ok: true, order: { id, amount, currency }, key: "<rzp_key>", name, desc }
    return data;
  }

  async function verifyPayment(payload) {
    // Same contract as compute.js (adjust if your endpoint differs).
    const res = await fetch("/api/compute/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "sdl",
        sku: "generic",
        minutes: Number(minutes),
        razorpay_payment_id: payload.razorpay_payment_id,
        razorpay_order_id: payload.razorpay_order_id,
        razorpay_signature: payload.razorpay_signature,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok || !data?.token) {
      throw new Error(data?.error || "verify_failed");
    }
    return data.token; // v1 token to be used as ORDER_TOKEN
  }

  function buildCommands(token) {
    const tok = token.trim();
    const b64 = sdlB64.trim();
    const notes = sdlNotes?.trim() || "";

    const bash = [
      `export ORDER_TOKEN='${tok}'`,
      `export SDL_B64='${b64}'`,
      notes ? `export SDL_NOTES='${notes.replace(/'/g, "\\'")}'` : "",
      `bash <(curl -fsSL ${BASE}/api/compute/run-sdl.sh)`,
    ]
      .filter(Boolean)
      .join("\n");

    const ps = [
      `$env:ORDER_TOKEN='${tok}'`,
      `$env:SDL_B64='${b64}'`,
      notes ? `$env:SDL_NOTES='${notes.replace(/'/g, "''")}'` : "",
      `(Invoke-WebRequest -UseBasicParsing ${BASE}/api/compute/run-sdl.sh).Content | bash`,
    ]
      .filter(Boolean)
      .join("\n");

    setOrderToken(tok);
    setBashCmd(bash);
    setPsCmd(ps);
  }

  async function handlePay() {
    clearOutput();
    if (!validate()) return;

    try {
      setBusy(true);
      setStatus("Creating order…");

      const { order, key, name, desc } = await createOrder();

      if (!window.Razorpay) {
        setBusy(false);
        setStatus("Razorpay is not loaded. Please refresh and try again.");
        return;
      }

      const options = {
        key,
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        name: name || "Indianode Compute",
        description: desc || `Custom SDL • ${minutes} minute(s)`,
        notes: {
          kind: "sdl",
          minutes: String(minutes),
          sdlName: sdlName || "custom-sdl",
        },
        handler: async function (response) {
          try {
            setStatus("Verifying payment…");
            const token = await verifyPayment(response);
            setStatus("Payment verified. Generating command…");
            buildCommands(token);
            setStatus("Ready. Copy & run the command.");
          } catch (e) {
            console.error(e);
            setStatus("Payment verification failed. Please contact support.");
          } finally {
            setBusy(false);
          }
        },
        modal: {
          ondismiss: function () {
            setBusy(false);
            setStatus("Payment cancelled.");
          },
        },
        theme: { color: "#111827" },
        prefill: {}, // optional
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
      setStatus("Opening Razorpay…");
    } catch (e) {
      console.error(e);
      setStatus("Could not create order. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px" }}>
      <h1 style={{ marginBottom: 8 }}>Deploy a Custom SDL</h1>
      <p style={{ marginTop: 0, color: "#6b7280" }}>
        Paste your YAML SDL below. You&apos;ll receive a copy-paste command after payment.
      </p>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr", marginTop: 16 }}>
        <label style={{ display: "block" }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Minutes</div>
          <input
            type="number"
            min={1}
            step={1}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value || 0))}
            style={{
              width: 160,
              padding: "8px 12px",
              border: "1px solid #d1d5db",
              borderRadius: 8,
            }}
          />
        </label>

        <label style={{ display: "block" }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>SDL Name (optional)</div>
          <input
            type="text"
            value={sdlName}
            onChange={(e) => setSdlName(e.target.value)}
            placeholder="custom-sdl"
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #d1d5db",
              borderRadius: 8,
            }}
          />
        </label>

        <label style={{ display: "block" }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Notes (optional, not sent to payment)</div>
          <input
            type="text"
            value={sdlNotes}
            onChange={(e) => setSdlNotes(e.target.value)}
            placeholder="anything useful for you to remember"
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #d1d5db",
              borderRadius: 8,
            }}
          />
        </label>

        <label style={{ display: "block" }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>SDL (YAML)</div>
          <textarea
            value={sdl}
            onChange={(e) => setSdl(e.target.value)}
            spellCheck={false}
            rows={20}
            style={{
              width: "100%",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
              fontSize: 13,
              padding: 12,
              border: "1px solid #d1d5db",
              borderRadius: 8,
              whiteSpace: "pre",
            }}
          />
        </label>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button
            onClick={handlePay}
            disabled={busy}
            style={{
              background: "#111827",
              color: "white",
              border: 0,
              padding: "10px 16px",
              borderRadius: 8,
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "Processing…" : "Pay & Get Command"}
          </button>
          <div style={{ color: "#6b7280" }}>{status}</div>
        </div>

        {orderToken && (
          <div
            style={{
              marginTop: 16,
              padding: 16,
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              background: "#fafafa",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Your command</h3>

            <details open style={{ marginBottom: 12 }}>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>Bash / Linux / macOS</summary>
              <pre
                style={{
                  background: "white",
                  border: "1px solid #e5e7eb",
                  padding: 12,
                  borderRadius: 8,
                  overflowX: "auto",
                }}
              >
{bashCmd}
              </pre>
              <button
                onClick={() => navigator.clipboard.writeText(bashCmd)}
                style={{ marginTop: 8, padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db" }}
              >
                Copy bash
              </button>
            </details>

            <details>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>PowerShell (Windows)</summary>
              <pre
                style={{
                  background: "white",
                  border: "1px solid #e5e7eb",
                  padding: 12,
                  borderRadius: 8,
                  overflowX: "auto",
                }}
              >
{psCmd}
              </pre>
              <button
                onClick={() => navigator.clipboard.writeText(psCmd)}
                style={{ marginTop: 8, padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db" }}
              >
                Copy PowerShell
              </button>
            </details>

            <p style={{ color: "#6b7280", marginTop: 12 }}>
              The command posts your SDL only after payment verification. The worker then runs the container and
              reports the public URL via progress updates.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
