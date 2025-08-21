import { useEffect, useMemo, useState } from "react";
import Head from "next/head";

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
  const [email, setEmail] = useState("");
  const [size, setSize] = useState("200Gi"); // waitlist
  const [wlMsg, setWlMsg] = useState("");

  // Prices (INR)
  const PRICE = useMemo(
    () => ({ g200: 399, g500: 799, g1tb: 1499, preload: 499 }),
    []
  );

  // FX rate (USD per INR) — try /api/fx, else env, else default
  const [fx, setFx] = useState(
    Number(process.env.NEXT_PUBLIC_USD_INR ? 1 / Number(process.env.NEXT_PUBLIC_USD_INR) : 0.0116)
  );
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
  const busy = status !== "available";

  // Toggles
  const SALES_OPEN = String(process.env.NEXT_PUBLIC_SALES_OPEN || "1") !== "0";
  const SHOW_AKASH = String(process.env.NEXT_PUBLIC_SHOW_AKASH || "1") === "1";
  const ALLOW_PAY_WHEN_BUSY =
    String(process.env.NEXT_PUBLIC_ALLOW_PAY_WHEN_BUSY || "0") === "1";
  const canSell = SALES_OPEN && (ALLOW_PAY_WHEN_BUSY || !busy);

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

  // Provider lock (attribute + address shown to renters)
  const ATTR_KEY = process.env.NEXT_PUBLIC_PROVIDER_ATTR_KEY || "org";
  const ATTR_VAL = process.env.NEXT_PUBLIC_PROVIDER_ATTR_VALUE || "indianode";
  const PROVIDER_ADDR = process.env.NEXT_PUBLIC_PROVIDER_ADDR || "akash1YOURADDRESSHERE";

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
      gaEvent("generate_lead", { method: "waitlist", product: "storage", size });
    } catch {
      setWlMsg("Could not join waitlist. Please try again.");
    }
  }

  // SDL links (keep filenames; content should include the attribute lock)
  const plans = [
    {
      key: "g200",
      title: "200 Gi",
      desc: "Great for checkpoints & HF snapshots",
      price: PRICE.g200,
      href: LINKS.g200,
      // these SDLs should include: placement.attributes: { [ATTR_KEY]: ATTR_VAL }
      sdl: "/downloads/sdl/app-200Gi.yaml",
    },
    {
      key: "g500",
      title: "500 Gi",
      desc: "Roomy training & fine-tuning cache",
      price: PRICE.g500,
      href: LINKS.g500,
      sdl: "/downloads/sdl/app-500Gi.yaml",
    },
    {
      key: "g1tb",
      title: "1 TiB",
      desc: "Big datasets & multi-model workflows",
      price: PRICE.g1tb,
      href: LINKS.g1tb,
      sdl: "/downloads/sdl/app-1Ti.yaml",
    },
  ];

  const handlePayClick = (planKey, inr) => {
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
          content="Same-host NVMe storage for your Akash lease. 200 Gi / 500 Gi / 1 TiB + optional preload script. SDLs are locked to our provider."
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
              <b>At capacity:</b> Card/UPI buttons are disabled. You can still deploy via Akash SDL.
            </div>
          )}
          {SALES_OPEN && busy && !ALLOW_PAY_WHEN_BUSY && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-900">
              <b>GPU busy:</b> Please deploy via Akash and/or join the waitlist below; we’ll notify you as soon as it’s free.
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
            <p className="mt-2 text-sm text-emerald-700">
              <b>Provider-locked SDLs:</b> our templates require{" "}
              <code>{ATTR_KEY}={ATTR_VAL}</code> so bids match our node only.
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
                    <div className="mt-2 text-xs text-emerald-700">
                      Locked to <code>{ATTR_KEY}={ATTR_VAL}</code>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col sm:flex-row gap-2">
                    {SHOW_AKASH && (
                      <a
                        href={p.sdl}
                        className="flex-1 text-center bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl"
                      >
                        Deploy on Akash (SDL)
                      </a>
                    )}

                    {canSell ? (
                      p.href ? (
                        <a
                          href={p.href}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => handlePayClick(p.key, p.price)}
                          className="flex-1 text-center bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl"
                        >
                          Pay with Card/UPI
                        </a>
                      ) : (
                        <button
                          disabled
                          className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-xl cursor-not-allowed"
                        >
                          Set link in Vercel
                        </button>
                      )
                    ) : (
                      <div className="flex-1 text-sm text-gray-600 text-center">
                        Card/UPI not available right now
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-gray-500 mt-2">
                    <b>Tip:</b> Deploy first, then pay once your lease lands on our node.
                  </p>
                </div>
              ))}
            </div>

            <p className="text-gray-600 mt-3">
              Request the size you want in your SDL. The volume is mounted at{" "}
              <code>/data</code>. Keep ~10–15% free space for safety.
            </p>
          </section>

          {/* CLI deploy helper */}
          <section className="mt-10">
            <h2 className="text-2xl font-semibold mb-3">Deploy via CLI (auto-select our bid)</h2>
            <p className="text-gray-700 mb-3">
              Prefer the CLI? Use our helper that waits for a bid from{" "}
              <code>{PROVIDER_ADDR}</code> and accepts only that bid.
            </p>
            <pre className="bg-gray-900 text-gray-100 rounded-xl p-3 overflow-x-auto text-sm">
              <code>{`curl -fsSL ${origin}/downloads/scripts/deploy-indianode.sh | bash -s -- /path/to/app-200Gi.yaml`}</code>
            </pre>
            <p className="text-gray-600">
              Or download:{" "}
              <a
                href="/downloads/scripts/deploy-indianode.sh"
                className="text-blue-600 hover:underline"
              >
                deploy-indianode.sh
              </a>
            </p>
          </section>

          {/* What’s inside the SDL */}
          <section className="mt-10">
            <h3 className="font-semibold mb-2">What’s inside the SDL (provider lock)</h3>
            <pre className="bg-gray-100 text-gray-800 rounded-xl p-3 overflow-x-auto text-sm">
{`placement:
  akash:
    attributes:
      ${ATTR_KEY}: ${ATTR_VAL}   # <- only match our provider
    pricing:
      app: { denom: uakt, amount: 1000 } # example price
`}
            </pre>
          </section>

          {/* preload add-on */}
          <section className="mt-10">
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
                      onClick={() =>
                        gaEvent("begin_checkout", {
                          value: PRICE.preload,
                          currency: "INR",
                          items: [
                            {
                              item_id: "preload",
                              item_name: "preload",
                              item_category: "storage",
                              quantity: 1,
                              price: PRICE.preload,
                            },
                          ],
                          payment_method: "razorpay_link",
                        })
                      }
                      className="block text-center bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl"
                    >
                      Pay for Preload
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
                  <div className="text-sm text-gray-600">Card/UPI not available right now</div>
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
                  GPU + 200 Gi (locked to {ATTR_KEY}={ATTR_VAL})
                </a>
              </li>
              <li>
                <a href="/downloads/sdl/app-500Gi.yaml" className="hover:underline">
                  GPU + 500 Gi (locked to {ATTR_KEY}={ATTR_VAL})
                </a>
              </li>
              <li>
                <a href="/downloads/sdl/app-1Ti.yaml" className="hover:underline">
                  GPU + 1 TiB (locked to {ATTR_KEY}={ATTR_VAL})
                </a>
              </li>
              <li>
                <a href="/downloads/sdl/storage-only-1Ti.yaml" className="hover:underline">
                  Storage-only 1 TiB (locked to {ATTR_KEY}={ATTR_VAL})
                </a>
              </li>
            </ul>
          </section>

          {/* Waitlist section (when Card/UPI not available or busy) */}
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
