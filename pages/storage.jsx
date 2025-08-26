// pages/storage.jsx
import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Script from "next/script";

const gaEvent = (name, params = {}) => {
  try {
    if (typeof window !== "undefined" && window.gtag) window.gtag("event", name, params);
  } catch {}
};

const ATTR_KEY = process.env.NEXT_PUBLIC_PROVIDER_ATTR_KEY || "org";
const ATTR_VAL = process.env.NEXT_PUBLIC_PROVIDER_ATTR_VALUE || "indianode";

// NVMe SKUs (match your backend)
const SKUS = [
  { sku: "nvme200",  title: "NVMe Storage • 200 Gi", baseInr60: 49,  sizeGi: 200 },
  { sku: "nvme500",  title: "NVMe Storage • 500 Gi", baseInr60: 99,  sizeGi: 500 },
  { sku: "nvme1tb",  title: "NVMe Storage • 1 TiB",  baseInr60: 149, sizeGi: 1024 },
];

// simple persistent-volume SDL (Akash v2: storage profile)
function sdlForSize(sizeGi) {
  return `version: "2.0"
services:
  app:
    image: debian:stable-slim
    command:
      - /bin/sh
      - -lc
      - "sleep infinity"
    resources:
      cpu:
        units: 1
      memory:
        size: 1Gi
      storage:
        - size: 1Gi
    params:
      storage:
        data: ${sizeGi}Gi
    mounts:
      - volume: data
        path: /data
profiles:
  compute:
    app: {}
  storage:
    data:
      size: ${sizeGi}Gi
      attributes:
        persistent: true
  placement:
    anywhere:
      attributes:
        ${ATTR_KEY}: ${ATTR_VAL}
      pricing:
        app:
          denom: uakt
          amount: 50
deployment:
  app:
    anywhere:
      profile: app
      count: 1
`;
}

function getRunUrl() {
  if (typeof window !== "undefined") return `${window.location.origin}/api/storage/run.sh`;
  return "https://www.indianode.com/api/storage/run.sh";
}

export default function Storage() {
  const [email, setEmail] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [promo, setPromo] = useState("");
  const [fx, setFx] = useState(0.012);
  const [loading, setLoading] = useState(false);

  // Mint modal
  const [open, setOpen] = useState(false);
  const [osTab, setOsTab] = useState("linux");
  const [cmdPosix, setCmdPosix] = useState("");
  const [cmdWin, setCmdWin] = useState("");
  const [mintToken, setMintToken] = useState("");

  useEffect(() => {
    fetch("/api/fx").then(r => r.json()).then(j => setFx(Number(j.rate) || 0.012)).catch(()=>{});
    if (typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("windows")) setOsTab("windows");
  }, []);

  const items = useMemo(() => SKUS, []);
  const promoCode = (promo || "").trim().toUpperCase();
  const PROMO_OFF_INR = 5;
  const promoActive = promoCode === "TRY" || promoCode === "TRY10";

  function priceInr(base, mins) {
    const m = Math.max(1, Number(mins || 60));
    let total = Math.ceil((base / 60) * m);
    if (promoActive) total = Math.max(1, total - PROMO_OFF_INR);
    return total;
  }
  const usd = (inr) => Math.round((inr * fx + Number.EPSILON) * 100) / 100;

  function buildCommands(token) {
    const url = getRunUrl();
    const posix = `export ORDER_TOKEN='${token}'
curl -fsSL ${url} | bash`;
    const win = `$env:ORDER_TOKEN = '${token}'
(Invoke-WebRequest -UseBasicParsing ${url}).Content | bash`;
    return { posix, win };
  }

  async function createOrder({ product, minutes, userEmail }) {
    const r = await fetch("/api/storage/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product, minutes, userEmail, promo }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error || "order_failed");
    return j;
  }

  async function mintStorageToken({ paymentId, product, minutes, email, promo }) {
    const r = await fetch("/api/storage/mint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId, product, minutes, email, promo }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error || "token_mint_failed");
    return j;
  }

  async function payRazorpay({ item }) {
    try {
      setLoading(true);
      const userEmail = (email || "").trim();
      const order = await createOrder({ product: item.sku, minutes, userEmail });
      const valueInr = Number(((order.amount || 0) / 100).toFixed(2));

      gaEvent("begin_checkout", {
        value: valueInr,
        currency: order.currency || "INR",
        coupon: promoCode || undefined,
        items: [{ item_id: item.sku, item_name: item.title, item_category: "nvme", quantity: 1, price: valueInr }],
        minutes: Number(minutes),
        payment_method: "razorpay",
      });

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_xxxxxx",
        amount: order.amount,
        currency: order.currency,
        order_id: order.id,
        name: "Indianode Cloud",
        description: `Storage: ${item.title} (${minutes} min)`,
        prefill: userEmail ? { email: userEmail } : undefined,
        notes: { minutes: String(minutes), product: item.sku, email: userEmail, promo: promoCode },
        handler: async (resp) => {
          try
