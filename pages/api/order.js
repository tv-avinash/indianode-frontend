// pages/api/order.js — Razorpay via REST (minute-based + ₹5 promo + calc breakdown)

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
    // Fail-safe: if status check fails, treat as busy (prevents over-selling)
    return true;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const { product, minutes, userEmail, promo } = req.body || {};

  // Base price for 60 minutes (₹)
  const PRICE_60 = { whisper: 100, sd: 200, llama: 300 };
  const base60 = PRICE_60[product];
  if (!product || !base60) {
    return res.status(400).json({ error: "invalid_product" });
  }

  // Clamp minutes to a reasonable range
  const safeMinutes = Math.max(1, Math.min(240, Number(minutes || 60)));

  // Pro-rata gross (ceil to whole ₹)
  const gross = Math.ceil((base60 / 60) * safeMinutes);

  // Flat promo (default ₹5) for TRY or TRY10 — never below ₹1
  const DISCOUNT_RUPEES = Number(process.env.PROMO_FLAT_OFF_RUPEES || 5);
  const code = String(promo || "").trim().toUpperCase();
  const promoEligible = code === "TRY" || code === "TRY10";
  const discount = promoEligible ? Math.max(0, DISCOUNT_RUPEES) : 0;

  // Net payable (₹)
  const amountInRupees = Math.max(1, gross - discount);

  // Optional: block orders when busy unless explicitly allowed
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
      // tiny server-side calc trail (all strings)
      calc_base60: String(base60),
      calc_gross: String(gross),
      calc_discount: String(discount),
      calc_net: String(amountInRupees),
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

    // Return Razorpay order along with pricing breakdown for the UI
    return res.status(200).json({
      ...json,
      calc: {
        base60,
        minutes: safeMinutes,
        gross,
        discount,
        net: amountInRupees,
        currency: "INR",
        promoApplied: promoEligible,
      },
    });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "order_error" });
  }
}
