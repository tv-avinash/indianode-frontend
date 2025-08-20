// pages/api/order.js — Razorpay via REST (minute-based pricing + TRY/TRY10 => ₹5 off)

function getSiteOrigin(req) {
  if (process.env.NEXT_PUBLIC_SITE_ORIGIN) return process.env.NEXT_PUBLIC_SITE_ORIGIN;
  const host = req?.headers?.host || "localhost:3000";
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  return `http${isLocal ? "" : "s"}://${host}`;
}

async function isGpuBusy(req) {
  const origin = getSiteOrigin(req);
  try {
    const r = await fetch(`${origin}/api/status`, { cache: "no-store" });
    const j = await r.json();
    return j.status !== "available";
  } catch {
    return true; // fail-safe
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const { product, minutes, userEmail, promo } = req.body || {};

  // Price for 60 minutes (₹)
  const PRICE_60 = { whisper: 100, sd: 200, llama: 300 };
  const base60 = PRICE_60[product];
  if (!product || !base60) {
    return res.status(400).json({ error: "invalid_product" });
  }

  const safeMinutes = Math.max(1, Number(minutes || 60));

  // Pro-rata price (ceil to whole rupees)
  let amountInRupees = Math.ceil((base60 / 60) * safeMinutes);

  // Promo: TRY or TRY10 => ₹5 off (never below ₹1)
  const promoCode = String(promo || "").trim().toUpperCase();
  if (promoCode === "TRY" || promoCode === "TRY10") {
    amountInRupees = Math.max(1, amountInRupees - 5);
  }

  // Optional block when busy (unless explicitly allowed)
  const allowWhenBusy = String(process.env.ALLOW_ORDERS_WHEN_BUSY || "").trim() === "1";
  if (!allowWhenBusy && (await isGpuBusy(req))) {
    return res.status(409).json({ error: "gpu_busy" });
  }

  const key_id = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    return res.status(500).json({ error: "razorpay_creds_missing" });
  }

  const auth = Buffer.from(`${key_id}:${key_secret}`).toString("base64");

  const body = {
    amount: Math.floor(amountInRupees * 100), // paise
    currency: "INR",
    receipt: `indianode_${Date.now()}`,
    notes: {
      product,
      minutes: String(safeMinutes),
      userEmail: userEmail || "",
      promo: promo || "",
      computed_rupees: String(amountInRupees),
    },
  };

  try {
    const resp = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(body),
    });

    const json = await resp.json();
    if (!resp.ok) {
      const msg = json?.error?.description || json?.error?.reason || `order_failed_${resp.status}`;
      return res.status(500).json({ error: msg });
    }

    return res.status(200).json(json);
  } catch (e) {
    return res.status(500).json({ error: e?.message || "order_error" });
  }
}
