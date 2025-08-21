import { useEffect, useMemo, useState } from "react";
import Head from "next/head";

// Safe GA helper (same idea as index.js)
const gaEvent = (name, params = {}) => {
  try {
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", name, params);
    }
  } catch {}
};

export default function StoragePage() {
  // ----------------- state -----------------
  const [status, setStatus] = useState("checking...");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [size, setSize] = useState("200Gi"); // for waitlist
  const [wlMsg, setWlMsg] = useState("");

  // Prices (INR)
  const PRICE = useMemo(
    () => ({ g200: 399, g500: 799, g1tb: 1499, preload: 499 }),
    []
  );

  // FX rate (for USD display) — try /api/fx, else env, else default
  const [fx, setFx] = useState(
    Number(process.env.NEXT_PUBLIC_USD_INR ? 1 / Number(process.env.NEXT_PUBLIC_USD_INR) : 0.0116)
  ); // USD per INR
  useEffect(() => {
    fetch("/api/fx")
      .then((r) => r.json())
      .then((j) => {
        if (j && j.rate) setFx(Number(j.rate));
      })
      .catch(() => {});
  }, []);
  const toUSD = (inr) =>
    Math.round(((inr || 0) * fx + Number.EPSILON) * 100) / 100;

  // GPU status
  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((j) => setStatus(j?.status || "offline"))
      .catch(() => setStatus("offline"));
  }, []);

  // Sales switch (env)
  const SALES_OPEN =
    String(process.env.NEXT_PUBLIC_SALES_OPEN || "1") !== "0";
  const busy = status !== "available";
  const canSell = SALES_OPEN && !busy;

  // Preload script URL: backend if provided, else static
  const base = process.env.NEXT_PUBLIC_DEPLOYER_BASE || "";
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://www.indianode.com";
  const preloadUrl = base
    ? `${base.replace(/\/+$/, "")}/storage/preload.sh`
    : `${origin}/downloads/scripts/preload.sh`;

  // Razorpay Payment Links from env (single source of truth)
  const cleanRzp = (u) =>
    (u || "")
      .trim()
      .replace(/^https?:\/\/rzp\.io\/(https?:\/\/rzp\.io\/)+/i, "https://rzp.io/");
  const LINKS = {
    g200: cleanRzp(process.env.NEXT_PUBLIC_RZP_200_MULTI || ""),
    g500: cleanRzp(process.env.NEXT_PUBLIC_RZP_500_MULTI || ""),
    g1tb: cleanRzp(process.env.NEXT_PUBLIC_RZP_1TB_MULTI || ""),
    preload: cleanRzp(process.env.NEXT_PUBLIC_RZP_PRELOAD_MULTI || ""),
  };

  // Waitlist (same pattern as index.js)
  async function joinWaitlist() {
    setWlMsg("");
    try {
      const r = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          product: "storage",
          minutes: 0,
          note: `Requested: ${size}`,
        }),
      });
      if (!r.ok) throw new Error("waitlist_failed");
      setWlMsg("Thanks! We’ll email you as soon as the GPU is free.");
      gaEvent("generate_lead", {
        method: "waitlist",
        product: "storage",
        size,
      });
    } catch {
      setWlMsg("Could not join waitlist. Please try again.");
    }
  }

  const plans = [
    {
      key: "g200",
      title: "200 Gi",
      desc: "Great for checkpoints & HF snapshots",
      price: PRICE.g200,
      href: LINKS.g200,
    },
    {
      key: "g500",
      title: "500 Gi",
      desc: "Roomy training & fine-tuning cache",
      price: PRICE.g500,
      href: LINKS.g500,
    },
    {
      key: "g1tb",
      title: "1 TiB",
      desc: "Big datasets & multi-model workflows",
      price: PRICE.g1tb,
      href: LINKS.g1tb,
    },
  ];

  const handleBuyClick = (planKey, inr) => {
    gaEvent("begin_checkout", {
      value: inr,
      currency: "INR",
      items: [{ item_id: planKey, item_name: planKey, item_category: "storage", quantity: 1, price: inr }],
      payment_method: "razorpay_link",
    });
  };

  return (
    <>
      <Head>
        <title>Storage — Indianode</title>
        <meta
          name="description"
          content="Same-host NVMe storage for your Akash lease. 200 Gi / 500 Gi / 1 TiB + optional preload script."
        />
        <link rel="canonical" href="https://www.indianode.com/storage" />
      </Head>

      <div className="min-h-screen bg-gray-50 text-gray-900">
        <header className="p-6 bg-gray-900 text-white text-center text-2xl font-bold">
          Indianode Storage
        </header>

        <main className="p-8 max-w-5xl mx-auto">
          {/* capacity/status banner */}
          {!SALES_OPEN && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-900">
              <b>At capacity:</b> Our GPU is currently leased. Buy buttons are
              disabled. Join the waitlist below.
            </div>
          )}
          {SALES_OPEN && busy && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-900">
              <b>GPU busy:</b> Please join the waitlist and we’ll notify you as soon as it’s free.
            </div>
          )}

          {/* hero */}
          <section className="bg-white border rounded-2xl shadow p-6 mb-6">
            <h1 className="text-3xl font-bold mb-2">
              Local NVMe Storage for Your Akash Lease
            </h1>
            <p className="text-gray-700">
              Fast, same-host storage for checkpoints, HuggingFace snapshots, and
              preprocessed data. Zero server changes on your side.
            </p>
          </section>

          {/* plans */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">
              Dataset Cache (persistent volume)
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((p) => (
                <div
                  key={p.key}
                  className="bg-white rounded-2xl shadow p-6 flex flex-col justify-between"
                >
                  <div>
                    <h3 className="text-xl font-bold">{p.title}</h3>
                    <p className="text-gray-600 mb-3">{p.desc}</p>
                    <div className="text-2xl font-extrabold">
                      ₹{p.price}{" "}
                      <span className="text-sm text-gray-500">
                        ~${toUSD(p.price)}/mo
                      </span>
                    </div>
                  </div>

                  <div className="mt-4">
                    {canSell ? (
                      p.href ? (
                        <a
                          href={p.href}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => handleBuyClick(p.key, p.price)}
                          className="block text-center bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl"
                        >
                          Buy now
                        </a>
                      ) : (
                        <button
                          disabled
                          className="w-full bg-gray-300 text-gray-700 px-4 py-2 rounded-xl cursor-not-allowed"
                        >
                          Set link in Vercel
                        </button>
                      )
                    ) : (
                      <div className="text-sm text-gray-600">
                        Not available right now.
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <p className="text-gray-600 mt-3">
              Request the size you want in your SDL. The volume is mounted at{" "}
              <code>/data</code>. Keep ~10–15% free space for safety.
            </p>
          </section>

          {/* preload add-on */}
          <section className="mt-8">
            <div className="bg-white rounded-2xl shadow p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">Self-serve Preload (one-time)</h3>
                <p className="text-gray-600">
                  Script to pull popular models/datasets into <code>/data</code>.
                </p>
              </div>
              <div className="text-2xl font-extrabold">
                ₹{PRICE.preload}{" "}
                <span className="text-sm text-gray-500">
                  ~${toUSD(PRICE.preload)}
                </span>
              </div>
              <div className="min-w-[180px]">
                {canSell ? (
                  LINKS.preload ? (
                    <a
                      href={LINKS.preload}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => handleBuyClick("preload", PRICE.preload)}
                      className="block text-center bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl"
                    >
                      Buy preload
                    </a>
                  ) : (
                    <button
                      disabled
                      className="w-full bg-gray-300 text-gray-700 px-4 py-2 rounded-xl cursor-not-allowed"
                    >
                      Set link in Vercel
                    </button>
                  )
                ) : (
                  <div className="text-sm text-gray-600">Not available right now.</div>
                )}
              </div>
            </div>

            <p className="text-gray-600 mt-3">Run inside your container after purchase:</p>
            <pre className="bg-gray-900 text-gray-100 rounded-xl p-3 overflow-x-auto text-sm">
              <code>{`curl -fsSL ${preloadUrl} | bash`}</code>
            </pre>
            <p className="text-gray-600">
              Or download:{" "}
              <a
                href="/downloads/scripts/preload.sh"
                className="text-blue-600 hover:underline"
              >
                preload.sh
              </a>
            </p>
          </section>

          {/* SDL downloads */}
          <section className="mt-10">
            <h2 className="text-2xl font-semibold mb-3">Download SDL Templates</h2>
            <ul className="list-disc pl-6 text-blue-700">
              <li>
                <a href="/downloads/sdl/app-200Gi.yaml" className="hover:underline">
                  GPU + 200 Gi
                </a>
              </li>
              <li>
                <a href="/downloads/sdl/app-500Gi.yaml" className="hover:underline">
                  GPU + 500 Gi
                </a>
              </li>
              <li>
                <a href="/downloads/sdl/app-1Ti.yaml" className="hover:underline">
                  GPU + 1 TiB
                </a>
              </li>
              <li>
                <a href="/downloads/sdl/storage-only-1Ti.yaml" className="hover:underline">
                  Storage-only 1 TiB
                </a>
              </li>
            </ul>
          </section>

          {/* How it works (deploy → pay → preload) */}
          <section className="mt-10">
            <h2 className="text-2xl font-semibold mb-2">How it works</h2>
            <ol className="list-decimal pl-6 text-gray-800">
              <li>
                <b>Deploy on Indianode</b> using an SDL that requests 200 Gi / 500 Gi / 1 TiB.
              </li>
              <li>
                <b>Pay</b> using the button for your size (cards / UPI supported).
              </li>
              <li>
                <b>Preload (optional)</b> — open a shell in your container and run the one-liner.
              </li>
            </ol>
          </section>

          {/* Waitlist section (shown when cannot sell) */}
          {!canSell && (
            <section className="mt-10 bg-white rounded-2xl shadow p-6">
              <h3 className="text-lg font-semibold mb-2">Join the waitlist</h3>
              <div className="grid md:grid-cols-3 gap-3">
                <label className="flex flex-col">
                  <span className="text-sm font-semibold mb-1">Email</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="border rounded-lg px-3 py-2"
                  />
                </label>
                <label className="flex flex-col">
                  <span className="text-sm font-semibold mb-1">Requested size</span>
                  <select
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    className="border rounded-lg px-3 py-2"
                  >
                    <option value="200Gi">200 Gi</option>
                    <option value="500Gi">500 Gi</option>
                    <option value="1TiB">1 TiB</option>
                  </select>
                </label>
                <div className="flex items-end">
                  <button
                    onClick={joinWaitlist}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl"
                  >
                    Notify me
                  </button>
                </div>
              </div>
              {wlMsg && <div className="text-sm text-gray-700 mt-3">{wlMsg}</div>}
            </section>
          )}

          {/* Notes */}
          <section className="mt-10 text-sm text-gray-700">
            <h3 className="font-semibold mb-1">Notes</h3>
            <ul className="list-disc pl-6">
              <li>Data lives on a local persistent volume at <code>/data</code> and is removed when the lease ends.</li>
              <li>No backups / No SLA — keep your own copies.</li>
              <li>Large downloads may incur egress from the source; manage responsibly.</li>
            </ul>
          </section>
        </main>

        <footer className="p-6 text-center text-sm text-gray-600">
          © {new Date().getFullYear()} Indianode
        </footer>
      </div>
    </>
  );
}
