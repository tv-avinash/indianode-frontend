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

  // Provider lock & display
  const ATTR_KEY = process.env.NEXT_PUBLIC_PROVIDER_ATTR_KEY || "org";
  const ATTR_VAL = process.env.NEXT_PUBLIC_PROVIDER_ATTR_VALUE || "indianode";
  const PROVIDER_ADDR =
    process.env.NEXT_PUBLIC_PROVIDER_ADDR || "akash1YOURADDRESSHERE";

  // Razorpay Payment Links (Card/UPI) for storage subscription (per plan)
  const cleanRzp = (u) =>
    (u || "")
      .trim()
      .replace(/^https?:\/\/rzp\.io\/(https?:\/\/rzp\.io\/)+/i, "https://rzp.io/");
  const LINKS = {
    g200: cleanRzp(process.env.NEXT_PUBLIC_RZP_200_MULTI || ""),
    g500: cleanRzp(process.env.NEXT_PUBLIC_RZP_500_MULTI || ""),
    g1tb: cleanRzp(process.env.NEXT_PUBLIC_RZP_1TB_MULTI || ""),
  };

  // Razorpay Payment Links for PRELOAD add-on (per plan)
  const LINKS_PRELOAD = {
    "200Gi": cleanRzp(process.env.NEXT_PUBLIC_RZP_PRELOAD_200 || ""),
    "500Gi": cleanRzp(process.env.NEXT_PUBLIC_RZP_PRELOAD_500 || ""),
    "1TiB": cleanRzp(process.env.NEXT_PUBLIC_RZP_PRELOAD_1TB || ""),
  };

  // ---------- runtime ----------
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

  // ---- Preload price per plan (shown in modal) ----
  const PRELOAD_PRICE = useMemo(
    () => ({
      "200Gi": Number(process.env.NEXT_PUBLIC_PRELOAD_200_INR || 499),
      "500Gi": Number(process.env.NEXT_PUBLIC_PRELOAD_500_INR || 799),
      "1TiB": Number(process.env.NEXT_PUBLIC_PRELOAD_1TB_INR || 1199),
    }),
    []
  );

  const toUSD = (inr) =>
    Math.round(((inr || 0) * fx + Number.EPSILON) * 100) / 100;

  const plans = [
    { key: "g200", title: "200 Gi", price: PRICE.g200, size: "200Gi" },
    { key: "g500", title: "500 Gi", price: PRICE.g500, size: "500Gi" },
    { key: "g1tb", title: "1 TiB", price: PRICE.g1tb, size: "1TiB" },
  ];

  // For preload.sh URL
  const base = process.env.NEXT_PUBLIC_DEPLOYER_BASE || "";
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://www.indianode.com";
  const preloadUrl = base
    ? `${base.replace(/\/+$/, "")}/storage/preload.sh`
    : `${origin}/downloads/scripts/preload.sh`;

  // ---------- SDL generator (locked) ----------
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
      alert("SDL copied");
      gaEvent("select_content", { content_type: "copy_sdl", item_id: sizeStr });
    } catch {
      alert("Could not copy. Please use Download.");
    }
  }

  // ---------- Preload Modal (ORDER_TOKEN flow) ----------
  const [modalOpen, setModalOpen] = useState(false);
  const [modalPlan, setModalPlan] = useState("200Gi");
  const [email, setEmail] = useState("");
  const [ref, setRef] = useState(""); // Razorpay payment_id (pay_...)
  const [token, setToken] = useState("");
  const [tokenMsg, setTokenMsg] = useState("");
  const [loadingToken, setLoadingToken] = useState(false);

  function openPreload(planSize) {
    setModalPlan(planSize);
    setModalOpen(true);
    setToken("");
    setTokenMsg("");
  }

  async function claimToken() {
    setToken("");
    setTokenMsg("");
    const userEmail = (email || "").trim();
    if (!userEmail || !ref) {
      setTokenMsg("Enter your email and Razorpay payment id (starts with pay_).");
      return;
    }
    if (!/^pay_[a-zA-Z0-9]+$/.test(ref)) {
      setTokenMsg("Invalid payment id. Use the Razorpay payment id that starts with pay_.");
      return;
    }
    setLoadingToken(true);
    try {
      const r = await fetch("/api/storage/order-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail, plan: modalPlan, ref }),
      });
      const text = await r.text();
      let j;
      try { j = JSON.parse(text); } catch { j = { error: text || "invalid_response" }; }
      if (!r.ok || !j?.token) throw new Error(j?.error || "token_failed");

      setToken(j.token);
      setTokenMsg("Token issued. Use the command below inside your container.");
      gaEvent("generate_lead", { method: "order_token", plan: modalPlan });
    } catch (e) {
      setTokenMsg(String(e.message || "Server error creating token"));
    } finally {
      setLoadingToken(false);
    }
  }

  function buildPreloadCmd(tok) {
    return `curl -fsSL ${preloadUrl} | ORDER_TOKEN=${tok} bash`;
  }

  async function copyPreloadCmd() {
    if (!token) {
      setTokenMsg("Get a token first.");
      return;
    }
    try {
      await navigator.clipboard.writeText(buildPreloadCmd(token));
      setTokenMsg("Command copied.");
    } catch {
      setTokenMsg("Could not copy. Select and copy manually.");
    }
  }

  const Modal = () =>
    !modalOpen ? null : (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50" onClick={() => setModalOpen(false)} />
        <div className="relative bg-white w-full max-w-xl mx-4 rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Preload Add-on (requires ORDER_TOKEN)</h3>
            <button
              onClick={() => setModalOpen(false)}
              className="text-gray-500 hover:text-gray-800"
            >
              ✕
            </button>
          </div>

          <div className="text-sm text-gray-700">
            <p className="mb-2">
              Plan: <b>{modalPlan}</b> • Price:{" "}
              <b>₹{PRELOAD_PRICE[modalPlan]}</b> (~${toUSD(PRELOAD_PRICE[modalPlan])})
            </p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>
                <b>Pay</b> for Preload{" "}
                {LINKS_PRELOAD[modalPlan] ? (
                  <a
                    href={LINKS_PRELOAD[modalPlan]}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline"
                    onClick={() =>
                      gaEvent("begin_checkout", {
                        value: PRELOAD_PRICE[modalPlan],
                        currency: "INR",
                        items: [
                          {
                            item_id: `preload_${modalPlan}`,
                            item_name: `preload_${modalPlan}`,
                            item_category: "storage",
                            quantity: 1,
                            price: PRELOAD_PRICE[modalPlan],
                          },
                        ],
                        payment_method: "razorpay_link",
                      })
                    }
                  >
                    here
                  </a>
                ) : (
                  <span className="text-red-600">(set link in Vercel)</span>
                )}
                .
              </li>
              <li>
                Enter your <b>email</b> and Razorpay <b>payment id</b> (starts with <code>pay_</code>) to get your <b>ORDER_TOKEN</b>.
              </li>
              <li>
                Inside your container, run the command with <b>ORDER_TOKEN</b> to preload datasets/models into <code>/data</code>.
              </li>
            </ol>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
            <label className="flex flex-col">
              <span className="text-xs font-semibold mb-1">Plan</span>
              <select
                value={modalPlan}
                onChange={(e) => setModalPlan(e.target.value)}
                className="border rounded-lg px-3 py-2"
              >
                <option value="200Gi">200 Gi</option>
                <option value="500Gi">500 Gi</option>
                <option value="1TiB">1 TiB</option>
              </select>
            </label>
            <label className="flex flex-col">
              <span className="text-xs font-semibold mb-1">Email</span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="border rounded-lg px-3 py-2"
              />
            </label>
            <label className="flex flex-col">
              <span className="text-xs font-semibold mb-1">Razorpay payment id</span>
              <input
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                placeholder="pay_XXXXXXXXXXXXXXXX"
                className="border rounded-lg px-3 py-2"
              />
            </label>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={claimToken}
              disabled={loadingToken}
              className={`px-4 py-2 rounded-xl text-white ${
                loadingToken ? "bg-gray-400" : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {loadingToken ? "Verifying…" : "Get ORDER_TOKEN"}
            </button>
            {token && (
              <button
                onClick={copyPreloadCmd}
                className="px-4 py-2 rounded-xl border border-gray-300 hover:bg-gray-50"
              >
                Copy Preload Command
              </button>
            )}
          </div>

          {token && (
            <div className="mt-3">
              <div className="text-xs text-gray-600 mb-1">Your ORDER_TOKEN</div>
              <div className="font-mono text-sm bg-gray-100 rounded-lg p-2 break-all">
                {token}
              </div>
            </div>
          )}

          <div className="mt-3">
            <div className="text-xs text-gray-600 mb-1">Run inside your container</div>
            <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 overflow-x-auto text-xs">
              <code>{`curl -fsSL ${preloadUrl} | ORDER_TOKEN=${token || "<PASTE_TOKEN_HERE>"} bash`}</code>
            </pre>
          </div>

          {tokenMsg && (
            <div className="mt-3 text-sm text-gray-700">{tokenMsg}</div>
          )}

          <div className="mt-4 text-xs text-gray-500">
            The script verifies your <b>ORDER_TOKEN</b> and that the lease runs on{" "}
            <code>{PROVIDER_ADDR}</code>. Without a valid token, preload will refuse.
          </div>
        </div>
      </div>
    );

  // ---------- UI (compact / single screen) ----------
  return (
    <>
      <Head>
        <title>Indianode Storage — Same-host NVMe for Akash</title>
        <meta
          name="description"
          content="Provider-locked SDLs for fast same-host NVMe (/data). Choose 200 Gi / 500 Gi / 1 TiB. Optional Preload with ORDER_TOKEN."
        />
        <link rel="canonical" href="https://www.indianode.com/storage" />
      </Head>

      <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col">
        <header className="px-6 py-4 bg-gray-900 text-white flex items-center justify-between">
          <div className="font-bold text-lg">Indianode — Storage</div>
          <div
            className={`text-xs px-2 py-1 rounded ${busy ? "bg-amber-500" : "bg-emerald-600"}`}
            title="GPU status from /api/status"
          >
            {busy ? "GPU busy" : "GPU available"}
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-6xl mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.map((p) => (
                <div key={p.key} className="bg-white rounded-2xl shadow p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-bold">{p.title}</h3>
                      <span className="text-[11px] text-emerald-700">lock: {ATTR_KEY}={ATTR_VAL}</span>
                    </div>
                    <div className="mt-2 text-2xl font-extrabold">
                      ₹{p.price}{" "}
                      <span className="text-sm text-gray-500">~${toUSD(p.price)}</span>
                      <span className="ml-2 text-[11px] text-gray-500">/mo</span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      Persistent volume at <code>/data</code> (NVMe).
                    </p>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {/* Always show Akash deploy (locked SDL) */}
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
                        Card/UPI disabled{busy && !ALLOW_PAY_WHEN_BUSY ? " • GPU busy" : ""}
                      </div>
                    )}

                    {/* Preload add-on (ORDER_TOKEN) */}
                    <button
                      onClick={() => openPreload(p.size)}
                      className="col-span-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl px-3 py-2"
                      title="Paid dataset/model preload requiring ORDER_TOKEN"
                    >
                      Preload Add-on (ORDER_TOKEN)
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 text-center text-xs text-gray-600">
              Provider: <code>{PROVIDER_ADDR}</code> • Data persists for the lease • No backups/SLA
            </div>
          </div>
        </main>

        <footer className="px-6 py-3 text-center text-xs text-gray-500">
          © {new Date().getFullYear()} Indianode •{" "}
          <a href="/" className="text-blue-600 hover:underline">Home</a>
        </footer>
      </div>

      <Modal />
    </>
  );
}
