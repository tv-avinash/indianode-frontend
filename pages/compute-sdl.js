// pages/compute-sdl.js
import { useEffect, useMemo, useState } from "react";
import Script from "next/script";
import Link from "next/link";
import SEO from "@/components/SEO";

// GA helper
const gaEvent = (name, params = {}) => {
  try {
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", name, params);
    }
  } catch {}
};

// Compact modal (unchanged)
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

profiles:
  compute:
    web:
      resources:
        cpu:
          units: 1
        memory:
          size: 512Mi

deployment:
  web:
    dcloud:
      profile: web
      count: 1`.replace(/\r\n/g, "\n")
  );

  // UI state
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [mintOpen, setMintOpen] = useState(false);
  const [mintToken, setMintToken] = useState("");
  const [mintCmd, setMintCmd] = useState("");
  const [mintCmdWin, setMintCmdWin] = useState("");
  const [osTab, setOsTab] = useState("linux");

  useEffect(() => {
    try {
      const ua = (navigator.userAgent || "").toLowerCase();
      setOsTab(ua.includes("windows") ? "windows" : "linux");
    } catch {}
  }, []);

  // b64 for SDL
  const sdlB64 = useMemo(() => {
    try {
      return btoa(unescape(encodeURIComponent(String(sdl || ""))));
    } catch {
      return btoa(String(sdl || ""));
    }
  }, [sdl]);

  function getRunUrl() {
    try {
      if (typeof window !== "undefined") {
        return `${window.location.origin}/api/compute/run-sdl.sh`;
      }
    } catch {}
    return "https://www.indianode.com/api/compute/run-sdl.sh";
  }

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

  async function payWithRazorpaySDL() {
    try {
      setMsg("");
      setLoading(true);

      if (!String(sdl).trim()) throw new Error("SDL cannot be empty.");

      const userEmail = (email || "").trim();
      if (!userEmail) {
        setMsg("Tip: add your email so we can send your run command + receipt.");
      }

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

      const openCheckout = () => {
        const options = {
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_xxxxxx",
          amount: order.amount,
          currency: order.currency,
          order_id: order.id,
          name: "Indianode Cloud",
          description: `Custom SDL (${minutes} min)`,
          prefill: userEmail ? { email: userEmail } : undefined,
          notes: {
            minutes: String(minutes),
            product: "generic",
            email: userEmail,
            promo: promoCode,
            kind: "sdl",
          },
          theme: { color: "#111827" },
          handler: async (response) => {
            try {
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
              alert(
                "Could not mint ORDER_TOKEN (" +
                  (e.message || "token_mint_failed") +
                  ")"
              );
            }
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.on("payment.failed", (resp) =>
          alert(resp?.error?.description || "Payment failed")
        );
        rzp.open();
      };

      if (typeof window.Razorpay === "undefined") {
        const check = setInterval(() => {
          if (typeof window.Razorpay !== "undefined") {
            clearInterval(check);
            openCheckout();
          }
        }, 50);
        setTimeout(() => clearInterval(check), 4000);
      } else {
        openCheckout();
      }
    } catch (e) {
      alert(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const origin = useMemo(() => {
    try {
      if (typeof window !== "undefined") return window.location.origin;
    } catch {}
    return "https://www.indianode.com";
  }, []);

  // --- JSON-LD (Service + FAQ) ---
  const service = {
    "@type": "Service",
    name: "Custom SDL & Non-GPU Compute",
    provider: {
      "@type": "Organization",
      name: "Indianode",
      url: "https://www.indianode.com",
    },
    areaServed: "India",
    description:
      "Submit your own SDL or run non-GPU compute jobs. Pay per minute and redeem with one-time tokens.",
    offers: { "@type": "Offer", priceCurrency: "INR", price: "Contact" },
    url: "https://www.indianode.com/compute-sdl",
  };

  const faq = {
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How do I deploy with SDL?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Buy minutes, receive an ORDER_TOKEN, then run the command that posts your base64 SDL to /api/compute/run-sdl.sh.",
        },
      },
      {
        "@type": "Question",
        name: "Do I need a crypto wallet?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "No. You can pay via Razorpay (UPI/cards). We mint a one-time ORDER_TOKEN to redeem from your terminal.",
        },
      },
    ],
  };

  const schema = { "@context": "https://schema.org", "@graph": [service, faq] };

  return (
    <>
      <SEO
        title="Run Non-GPU Compute & Custom SDL Deployments | Indianode"
        description="Submit your own SDL or run non-GPU compute jobs. Pay per minute, redeem with one-time tokens. Built for developers who need quick deployments."
        canonical="https://www.indianode.com/compute-sdl"
        keywords="non gpu compute, custom sdl, akash compute deployment, cpu ram on demand"
        schema={schema}
      />

      <div className="min-h-screen bg-gray-50 text-gray-900">
        <Script src="https://checkout.razorpay.com/v1/checkout.js" />

        {/* Header */}
        <header className="px-4 py-3 bg-gray-900 text-white">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="text-lg font-semibold tracking-tight">
              Indianode Cloud
            </div>
            <nav className="text-xs space-x-3">
              <Link href="/" className="hover:underline">
                Home
              </Link>
              <Link href="/compute" className="hover:underline">
                Compute
              </Link>
              <Link href="/pricing" className="hover:underline">
                Pricing
              </Link>
            </nav>
          </div>
        </header>

        {/* Main */}
        <main className="max-w-6xl mx-auto px-4 pt-4 pb-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold leading-tight">
                Custom SDL runner
              </h1>
              <p className="text-sm text-gray-600">
                Pay per minute and redeem via{" "}
                <code className="font-mono">/api/compute/run-sdl.sh</code>. For
                quick automation, see{" "}
                <Link href="/compute" className="text-blue-600 underline">
                  Compute
                </Link>
                .
              </p>
            </div>

            {/* Buyer inputs */}
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
                    onChange={(e) =>
                      setMinutes(Math.max(1, Number(e.target.value || 1)))
                    }
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
                    loading
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-indigo-600 hover:bg-indigo-700"
                  }`}
                  onClick={payWithRazorpaySDL}
                  disabled={loading}
                >
                  Pay &amp; Get Command • Razorpay
                </button>
              </div>
            </div>
          </div>

          {/* Invisible FAQ content for SEO (no visual impact) */}
          <section className="sr-only" aria-hidden="true">
            <h2>FAQ</h2>
            <div>
              <h3>How do I deploy with SDL?</h3>
              <p>
                Purchase minutes, receive an ORDER_TOKEN, then use the provided
                command to post your base64 SDL to /api/compute/run-sdl.sh.
              </p>
              <h3>Do I need a crypto wallet?</h3>
              <p>
                No. Pay with Razorpay (UPI/cards). We mint a one-time token to
                redeem from your terminal.
              </p>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="px-4 py-3 text-center text-xs text-gray-600">
          <nav className="mb-1 space-x-3">
            <Link href="/" className="text-blue-600 hover:underline">
              Home
            </Link>
            <Link href="/compute" className="text-blue-600 hover:underline">
              Compute
            </Link>
            <Link href="/pricing" className="text-blue-600 hover:underline">
              Pricing
            </Link>
          </nav>
          © {new Date().getFullYear()} Indianode
        </footer>
      </div>

      {/* Mint modal */}
      <Modal
        open={mintOpen}
        onClose={() => setMintOpen(false)}
        title="Payment verified — run this command"
      >
        <div className="space-y-2">
          <p className="text-sm text-gray-700">
            We minted a one-time <b>ORDER_TOKEN</b>. Run the command below from
            your own machine (not the Akash host VM).
          </p>

          <div className="flex gap-2 text-[11px]">
            <button
              onClick={() => setOsTab("linux")}
              className={`px-2.5 py-1 rounded border ${
                osTab === "linux"
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-800 border-gray-200"
              }`}
              title="macOS / Linux (bash or zsh)"
            >
              macOS / Linux
            </button>
            <button
              onClick={() => setOsTab("windows")}
              className={`px-2.5 py-1 rounded border ${
                osTab === "windows"
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-800 border-gray-200"
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
                  await navigator.clipboard.writeText(
                    osTab === "windows" ? mintCmdWin : mintCmd
                  );
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

          <div className="mt-3 border border-amber-200 bg-amber-50 text-amber-900 rounded-lg p-3">
            <p className="text-sm font-medium">How to check your job status</p>
            <ol className="list-decimal ml-5 text-xs mt-1 space-y-1">
              <li>
                Run the command above. It will print a <code>job_id</code> like{" "}
                <code>job_123...</code>.
              </li>
              <li>Open this URL in your browser (replace the id):</li>
            </ol>
            <div className="mt-2 font-mono text-xs bg-white rounded border px-2 py-1 overflow-x-auto">
              {origin}/api/compute/status?id=&lt;job_id&gt;
            </div>
            <div className="mt-2">
              <button
                className="bg-white hover:bg-gray-50 border border-gray-300 text-gray-800 px-2 py-1 rounded text-xs"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      `${origin}/api/compute/status?id=`
                    );
                  } catch {}
                }}
                title="Copies the base URL; paste your job_id after ="
              >
                Copy status URL base
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
