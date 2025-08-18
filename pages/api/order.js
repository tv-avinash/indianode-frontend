// pages/api/order.js — Razorpay via REST (no SDK)

function getSiteOrigin(req) {
  // Prefer explicit env (useful on Vercel), else derive from the request
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
    // If status check fails, be safe and block
    return true;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { template, amountInRupees } = req.body || {};

  // validate input
  const amount = Math.floor(Number(amountInRupees || 0));
  if (!template || !amount || amount <= 0) {
    return res.status(400).json({ error: "missing_or_invalid_fields" });
  }

  // block when GPU is busy (we'll convert to queue later)
  if (await isGpuBusy(req)) {
    return res.status(409).json({ error: "gpu_busy" });
  }

  const key_id = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    return res.status(500).json({ error: "razorpay_creds_missing" });
  }

  const auth = Buffer.from(`${key_id}:${key_secret}`).toString("base64");

  const body = {
    amount: amount * 100, // paise
    currency: "INR",
    receipt: `indianode_${Date.now()}`,
    notes: { template },
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
      // surface Razorpay’s error description if present
      const msg =
        json?.error?.description ||
        json?.error?.reason ||
        `order_failed_${resp.status}`;
      return res.status(500).json({ error: msg });
    }

    // success -> return the order object { id, amount, currency, ... }
    return res.status(200).json(json);
  } catch (e) {
    return res.status(500).json({ error: e?.message || "order_error" });
  }
}
