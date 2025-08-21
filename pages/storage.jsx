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
  // ---------- env toggles ----------
  const SHOW_AKASH = String(process.env.NEXT_PUBLIC_SHOW_AKASH || "1") === "1";
  const SALES_OPEN = String(process.env.NEXT_PUBLIC_SALES_OPEN || "1") !== "0";
  const ALLOW_PAY_WHEN_BUSY =
    String(process.env.NEXT_PUBLIC_ALLOW_PAY_WHEN_BUSY || "0") === "1";

  // Provider lock (attribute) + optional address display
  const ATTR_KEY = process.env.NEXT_PUBLIC_PROVIDER_ATTR_KEY || "org";
  const ATTR_VAL = process.env.NEXT_PUBLIC_PROVIDER_ATTR_VALUE || "indianode";
  const PROVIDER_ADDR =
    process.env.NEXT_PUBLIC_PROVIDER_ADDR || "akash1YOURADDRESSHERE";

  // Razorpay Payment Links (Card/UPI)
  const cleanRzp = (u) =>
    (u || "")
      .trim()
      .replace(/^https?:\/\/rzp\.io\/(https?:\/\/rzp\.io\/)+/i, "https://rzp.io/");
  const LINKS = {
    g200: cleanRzp(process.env.NEXT_PUBLIC_RZP_200_MULTI || ""),
    g500: cleanRzp(process.env.NEXT_PUBLIC_RZP_500_MULTI || ""),
    g1tb: cleanRzp(process.env.NEXT_PUBLIC_RZP_1TB_MULTI || ""),
  };

  // ---------- runtime state ----------
  const [status, setStatus] = useState("checking...");
  const [fx, setFx] = useState(
    Number(process.env.NEXT_PUBLIC_USD_INR ? 1 / Number(process.env.NEXT_PUBLIC_USD_INR) : 0.0116)
  );

  useEffect(() => {
    fetch("/api/fx")
      .then((r) => r.json())
      .then((j) => j?.rate && setFx(Number(j.rate)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((j) => setStatus(j?.status || "offline"))
      .catch(() => setStatus("offline"));
  }, []);
  const busy = status !== "available";
  const canSell = SALES_OPEN && (ALLOW_PAY_WHEN_BUSY || !busy);

  const PRICE = useMemo(
    () => ({ g200: 399, g500: 799, g1tb: 1499 }),
    []
  );
  const toUSD = (inr) =>
    Math.round(((inr || 0) * fx + Number.EPSILON) * 100) / 100;

  const plans = [
    { key: "g200", title: "200 Gi", price: PRICE.g200, size: "200Gi" },
    { key: "g500", title: "500 Gi", price: PRICE.g500, size: "500Gi" },
    { key: "g1tb", title: "1 TiB", price: PRICE.g1tb, size: "1TiB" },
  ];

  // ---------- SDL generator (locked to your provider) ----------
  function buildLockedSDL(sizeStr) {
    return `version: "2.0"

services:
  app:
    image: nvidia/cuda:12.4.1-runtime-ubuntu22.04
    command: ["bash","-lc","sleep infinity"]
    params:
      storage:
        data:
          mount: /data
    expose:
      - port: 8080
        as: 80
        to:
          - global: true

profiles:
  compute:
    app:
      resources:
        cpu:
          units: 1
        memory:
          size: 4Gi
        gpu:
          units: 1
          attributes:
            vendor:
              nvidia:
                - model: rtx3090
        storage:
          - size: 10Gi
          - name: data
            size: ${sizeStr}
            attributes:
              persistent: true
              class: beta3
  placement:
    indianode:
      attributes:
        ${ATTR_KEY}: ${ATTR_VAL}
      pricing:
        app:
          denom: uakt
          amount: 800

deployment:
  app:
    indianode:
      profile: app
      count: 1
`;
  }

  function downloadSDL(sizeStr) {
    const yml = buildLockedSDL(sizeStr);
    const blob = new Blob([yml], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `indianode-${sizeStr}.yaml`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    gaEvent("select_content", { content_type: "download_sdl", item_id: sizeStr });
  }

  async function copySDL(sizeStr) {
    try {
      await navigator.clipboard.writeText(buildLockedSDL(sizeStr));
      alert("SDL copied to clipboard");
      gaEvent("select_content", { content_type: "copy_sdl", item_id: sizeStr });
    } catch {
      alert("Could not copy. Please use Download.");
    }
  }

  // ---------- UI ----------
  return (
    <>
      <Head>
        <title>Indianode Storage — Same-host NVMe for Akash</title>
        <meta
          name="description"
          content="Provider-locked SDLs for fast same-host NVMe (/data). Choose 200 Gi / 500 Gi / 1 TiB. Optional Card/UPI."
        />
        <link rel="canonical" href="https://www.indianode.com/storage" />
      </Head>

      {/* Single-screen layout */}
      <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col">
        <header className="px-6 py-4 bg-gray-900 text-white flex items-center justify-between">
          <div className="font-bold text-lg">Indianode — Storage</div>
          <div
            className={`text-xs px-2 py-1 rounded ${
              busy ? "bg-amber-500" : "bg-emerald-600"
            }`}
            title="GPU status from /api/status"
          >
            {busy ? "GPU busy" : "GPU available"}
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-6xl mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.map((p) => (
                <div
                  key={p.key}
                  className="bg-white rounded-2xl shadow p-5 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-bold">{p.title}</h3>
                      <span className="text-[11px] text-emerald-700">
                        lock: {ATTR_KEY}={ATTR_VAL}
                      </span>
                    </div>
                    <div className="mt-2 text-2xl font-extrabold">
                      ₹{p.price}{" "}
                      <span className="text-sm text-gray-500">
                        ~${toUSD(p.price)}
                      </span>
                      <span className="ml-2 text-[11px] text-gray-500">/mo</span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      Persistent volume at <code>/data</code> (NVMe).
                    </p>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {/* Akash deploy buttons — ALWAYS visible if SHOW_AKASH */}
                    {SHOW_AKASH && (
                      <>
                        <button
                          onClick={() => downloadSDL(p.size)}
                          className="col-span-2 md:col-span-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-3 py-2"
                          title="Download provider-locked SDL"
                        >
                          Deploy on Akash (SDL)
                        </button>
                        <button
                          onClick={() => copySDL(p.size)}
                          className="col-span-2 md:col-span-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl px-3 py-2"
                          title="Copy SDL to clipboard"
                        >
                          Copy SDL
                        </button>
                      </>
                    )}

                    {/* Card/UPI — gated by sales/busy */}
                    {canSell ? (
                      LINKS[p.key] ? (
                        <a
                          href={LINKS[p.key]}
                          target="_blank"
                          rel="noreferrer"
                          className="col-span-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-3 py-2 text-center"
                          onClick={() =>
                            gaEvent("begin_checkout", {
                              value: p.price,
                              currency: "INR",
                              items: [
                                {
                                  item_id: p.key,
                                  item_name: p.title,
                                  item_category: "storage",
                                  quantity: 1,
                                  price: p.price,
                                },
                              ],
                              payment_method: "razorpay_link",
                            })
                          }
                          title="Pay with Card/UPI"
                        >
                          Pay with Card/UPI
                        </a>
                      ) : (
                        <button
                          disabled
                          className="col-span-2 bg-gray-200 text-gray-600 rounded-xl px-3 py-2"
                          title="Set your Razorpay link in Vercel env"
                        >
                          Set payment link
                        </button>
                      )
                    ) : (
                      <div className="col-span-2 text-center text-sm text-gray-600">
                        Card/UPI disabled
                        {busy && !ALLOW_PAY_WHEN_BUSY ? " • GPU busy" : ""}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 text-center text-xs text-gray-600">
              Provider address: <code>{PROVIDER_ADDR}</code> • Data persists for the lease • No backups/SLA
            </div>
          </div>
        </main>

        <footer className="px-6 py-3 text-center text-xs text-gray-500">
          © {new Date().getFullYear()} Indianode •{" "}
          <a href="/" className="text-blue-600 hover:underline">
            Home
          </a>
        </footer>
      </div>
    </>
  );
}
