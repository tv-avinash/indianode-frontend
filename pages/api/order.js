// pages/api/order.js — Razorpay via REST (no SDK)

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
    // Fail-safe: if we can't check status, treat as busy
    return true;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  // expected from frontend
  const { product, minutes, userEmail, promo } = req.body || {};

  // Base prices in ₹
  const PRICES = { whisper: 100, sd: 200, llama: 300 };
  let amountInRupees = PRICES[product];

  // validate product
  if (!product || !amountInRupees) {
    return res.status(400).json({ error: "invalid_product" });
  }

  // Simple promo: TRY10 => ₹100 off (never below ₹1)
  if (typeof promo === "string" && promo.trim().toUpperCase() === "TRY10") {
    amountInRupees = Math.max(1, amountInRupees - 100);
  }

  // Optional override: allow orders even if busy (set ALLOW_ORDERS_WHEN_BUSY=1)
  const allowWhenBusy = String(process.env.ALLOW_ORDERS_WHEN_BUSY || "").trim() === "1";
  if (!allowWhenBusy && (await isGpuBusy(req))) {
    return res.status(409).json({ error: "gpu_busy" });
  }

  const key_id =
    process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    return res.status(500).json({ error: "razorpay_creds_missing" });
  }

  const auth = Buffer.from(`${key_id}:${key_secret}`).toString("base64");

  const safeMinutes = String(Math.max(1, Number(minutes || 60)));

  const body = {
    amount: Math.floor(amountInRupees * 100), // paise
    currency: "INR",
    receipt: `indianode_${Date.now()}`,
    notes: {
      product,
      minutes: safeMinutes,
      userEmail: userEmail || "",
      promo: promo || "",
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
      const msg =
        json?.error?.description ||
        json?.error?.reason ||
        `order_failed_${resp.status}`;
      return res.status(500).json({ error: msg });
    }

    // success -> return the Razorpay order object
    return res.status(200).json(json);
  } catch (e) {
    return res.status(500).json({ error: e?.message || "order_error" });
  }
}
