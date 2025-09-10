// pages/compute-sdl.jsx
import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Script from "next/script";
import Link from "next/link";

// GA helper (same as compute.jsx)
const gaEvent = (name, params = {}) => {
  try {
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", name, params);
    }
  } catch {}
};

// Reusable compact modal (same UI/logic as compute.jsx)
function Modal({ open, onClose, children, title = "Next steps" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl mx-2 rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-base">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 hover:bg-gray-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export default function ComputeSDL() {
  // Inputs
  const [email, setEmail] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [promo, setPromo] = useState("");

  // SDL text
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

  // UI state
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // Run command modal (same pattern as compute.jsx)
  function getRunUrl() {
    try {
      if (typeof window !== "undefined") {
        return `${window.location.origin}/api/compute/run-sdl.sh`;
      }
    } catch {}
    return "https://www.indianode.com/api/compute/run-sdl.sh";
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

  // Helper to b64 the SDL textarea
  const sdlB64 = useMemo(() => {
    try {
      return btoa(unescape(encodeURIComponent(String(sdl || ""))));
    } catch {
      return btoa(String(sdl || ""));
    }
  }, [sdl]);

  function buildCommands(token) {
    const url = getRunUrl();
    const posix = `export ORDER_TOKEN='${token}'
export SDL_B64='${sdlB64}'
curl -fsSL ${url} | bash`;
    const win = `$env:ORDER_TOKEN = '${token}'
$env:SDL_B64 = '${sdlB64}'
(Invoke-WebRequest -UseBasicParsing ${url}).Content | bash`;
    return { posix, win };
  }

  // ---- API helpers (same endpoints + shapes as compute.jsx) ----
  async function createOrder({ product, minutes, userEmail }) {
    const r = await fetch("/api/compute/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product, minutes, userEmail, promo }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error || "order_failed");
    return data;
  }

  async function mintAfterPayment({ paymentId, product, minutes, email, promo }) {
    const r = await fetch("/api/compute/mint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentId,
        product,
        minutes: Number(minutes),
        email: (email || "").trim(),
        promo: (promo || "").trim(),
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error || "token_mint_failed");
    return j;
  }

  // ---- Payments (same methodology as compute.jsx) ----
  async function payWithRazorpaySDL() {
    try {
      setMsg("");
      setLoading(true);

      if (!String(sdl).trim()) {
        throw new Error("SDL cannot be empty.");
      }

      const userEmail = (email || "").trim();
      if (!userEmail) {
        setMsg("Tip: add your email so we can send your run command + receipt.");
      }

      // Use product "generic" so server pricing stays consistent with compute.jsx
      const order = await createOrder({
        product: "generic",
        minutes,
        userEmail,
      });

      const valueInr = Number(((order.amount || 0) / 100).toFixed(2));
      const promoCode = (promo || "").trim().toUpperCase();

      gaEvent("begin_checkout", {
        value: valueInr,
        currency: order.currency || "INR",
        coupon: promoCode || undefined,
        items: [
          {
            item_id: "sdl",
            item_name: "Custom SDL",
            item_category: "compute",
            quantity: 1,
            price: valueInr,
          },
        ],
        minutes: Number(minutes),
        payment_method: "razorpay",
      });

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_xxxxxx",
        amount: order.amount,
        currency: order.currency,
        order_id: order.id,
        name: "Indianode Cloud",
        description: `Custom SDL (${minutes} min)`,
        prefill: userEmail ? { email: userEmail } : undefined,
        notes: { minutes: String(minutes), product: "generic", email: userEmail, promo: promoCode, kind: "sdl" },
        theme: { color: "#111827" },
        handler: async (response) => {
          try {
            // Mint ORDER_TOKEN after successful payment (same as compute.jsx flow)
            const result = await mintAfterPayment({
              paymentId: response.razorpay_payment_id,
              product: "generic",
              minutes,
              email: userEmail,
              promo,
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
              coupon: promoCode || undefined,
              items: [
                {
                  item_id: "sdl",
                  item_name: "Custom SDL",
                  item_category: "compute",
                  quantity: 1,
                  price: valueInr,
                },
              ],
              minutes: Number(minutes),
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
        <title>Custom SDL — Indianode</title>
        <meta
          name="description"
          content="Submit your own SDL, pay per minute with Razorpay, and redeem with a one-time ORDER_TOKEN."
        />
        <link rel="canonical" href="https://www.indianode.com/compute-sdl" />
      </Head>

      <div className="min-h-screen bg-gray-50 text-gray-900">
        <Script src="https://checkout.razorpay.com/v1/checkout.js" />

        {/* Compact header (same style as compute.jsx) */}
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

        {/* Main */}
        <main className="max-w-6xl mx-auto px-4 pt-4 pb-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold leading-tight">Custom SDL runner</h1>
              <p className="text-sm text-gray-600">
                Pay per minute and redeem via{" "}
                <code className="font-mono">/api/compute/run-sdl.sh</code>.
              </p>
            </div>

            {/* Buyer inputs toolbar (same compact style) */}
            <div className="bg-white rounded-xl shadow border px-3 py-2">
              <div className="grid grid-cols-3 gap-2 items-end">
                <label className="flex flex-col">
                  <span className="text-[11px] font-semibold">Email</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="border rounded-md px-2 py-1 text-sm"
                    disabled={loading}
                  />
                </label>
                <label className="flex flex-col">
                  <span className="text-[11px] font-semibold">Minutes</span>
                  <input
                    type="number"
                    min="1"
                    max="480"
                    value={minutes}
                    onChange={(e) => setMinutes(Math.max(1, Number(e.target.value || 1)))}
                    className="border rounded-md px-2 py-1 text-sm"
                    disabled={loading}
                  />
                </label>
                <label className="flex flex-col">
                  <span className="text-[11px] font-semibold">Promo</span>
                  <input
                    value={promo}
                    onChange={(e) => setPromo(e.target.value)}
                    placeholder="TRY / TRY10"
                    className="border rounded-md px-2 py-1 text-sm"
                    disabled={loading}
                  />
                </label>
              </div>
            </div>
          </div>

          {msg && (
            <div className="mt-2 text-center text-xs text-emerald-800 bg-emerald-100 border border-emerald-200 rounded-lg px-3 py-1.5">
              {msg}
            </div>
          )}

          {/* SDL editor */}
          <div className="mt-3 grid grid-cols-1 gap-3">
            <div className="bg-white border rounded-2xl shadow p-4">
              <label className="block text-sm font-medium mb-2">SDL (YAML)</label>
              <textarea
                className="w-full border rounded-xl px-3 py-2 font-mono text-sm"
                rows={20}
                spellCheck={false}
                value={sdl}
                onChange={(e) => setSdl(e.target.value)}
                disabled={loading}
              />
              <div className="mt-3">
                <button
                  className={`text-white px-3 py-1.5 text-sm rounded-lg ${
                    loading ? "bg-gray-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"
                  }`}
                  onClick={payWithRazorpaySDL}
                  disabled={loading}
                >
                  Pay & Get Command • Razorpay
                </button>
              </div>
            </div>
          </div>
        </main>

        {/* Compact footer (same) */}
        <footer className="px-4 py-3 text-center text-xs text-gray-600">
          <nav className="mb-1 space-x-3">
            <Link href="/" className="text-blue-600 hover:underline">Home</Link>
            <Link href="/compute" className="text-blue-600 hover:underline">Compute</Link>
            <Link href="/storage" className="text-blue-600 hover:underline">Storage</Link>
          </nav>
          © {new Date().getFullYear()} Indianode
        </footer>
      </div>

      {/* Mint modal (same compact UI as compute.jsx) */}
      <Modal open={mintOpen} onClose={() => setMintOpen(false)} title="Payment verified — run this command">
        <div className="space-y-2">
          <p className="text-sm text-gray-700">
            We minted a one-time <b>ORDER_TOKEN</b>. Run the command below from your own machine
            (not the Akash host VM).
          </p>

          <div className="flex gap-2 text-[11px]">
            <button
              onClick={() => setOsTab("linux")}
              className={`px-2.5 py-1 rounded border ${
                osTab === "linux" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-800 border-gray-200"
              }`}
              title="macOS / Linux (bash or zsh)"
            >
              macOS / Linux
            </button>
            <button
              onClick={() => setOsTab("windows")}
              className={`px-2.5 py-1 rounded border ${
                osTab === "windows" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-800 border-gray-200"
              }`}
              title="Windows PowerShell"
            >
              Windows (PowerShell)
            </button>
          </div>

          <div className="bg-gray-900 text-gray-100 rounded-xl p-3 font-mono text-xs overflow-x-auto">
            {osTab === "windows" ? mintCmdWin || "…" : mintCmd || "…"}
          </div>

          <div className="flex gap-2">
            <button
              className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded-lg text-sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(osTab === "windows" ? mintCmdWin : mintCmd);
                } catch {}
              }}
            >
              Copy command
            </button>
            <button
              className="bg-gray-200 hover:bg-gray-300 text-gray-900 px-3 py-1.5 rounded-lg text-sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(mintToken);
                } catch {}
              }}
            >
              Copy token only
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
