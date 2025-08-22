// pages/api/compute/order.js
import crypto from "crypto";

function json(res, code, obj) {
  res.status(code).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(obj));
}

const RATES_INR_PER_MIN = {
  generic: 1,
  redis7: 1,
  node: 2,
  python: 2,
  docker: 3,
  service: 3,
};

function priceInr(product = "generic", minutes = 1, promo = "") {
  const m = Math.max(1, Number(minutes || 1));
  const rate = RATES_INR_PER_MIN[product] ?? 1;
  let total = Math.ceil(rate * m);
  const p = String(promo || "").trim().toUpperCase();
  if (p === "TRY" || p === "TRY10") total = Math.max(1, total - 5);
  return total;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "method_not_allowed" });

  try {
    const { product, minutes, userEmail, promo } = req.body || {};
    const amountInr = priceInr(product, minutes, promo);

    const keyId = process.env.RAZORPAY_KEY_ID || "";
    const keySecret = process.env.RAZORPAY_KEY_SECRET || "";

    // If Razorpay keys are missing, return a mocked order for testing.
    if (!keyId || !keySecret) {
      return json(res, 200, {
        id: "order_test_" + crypto.randomBytes(6).toString("hex"),
        amount: amountInr * 100,
        currency: "INR",
        mock: true,
      });
    }

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const orderResp = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountInr * 100,
        currency: "INR",
        receipt: `cmp_${Date.now()}`,
        notes: {
          kind: "compute",
          product,
          minutes: String(minutes || 1),
          email: userEmail || "",
        },
      }),
    });

    if (!orderResp.ok) {
      const t = await orderResp.text().catch(() => "");
      return json(res, 500, { error: "rzp_order_failed", details: t.slice(0, 400) });
    }

    const data = await orderResp.json();
    return json(res, 200, data);
  } catch (e) {
    return json(res, 500, { error: "server_error", message: e?.message || String(e) });
  }
}
