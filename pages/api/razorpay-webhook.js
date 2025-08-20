// pages/api/razorpay-webhook.js
import crypto from "crypto";

// IMPORTANT: raw body required for HMAC
export const config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// Small helper: minute-based expected price (for logging/sanity)
function expectedRupees({ product, minutes, promo }) {
  const PRICE_60 = { whisper: 100, sd: 200, llama: 300 }; // ₹ for 60 min
  const base60 = PRICE_60[product];
  if (!base60) return null;
  const m = Math.max(1, Math.min(240, Number(minutes || 60)));
  const gross = Math.ceil((base60 / 60) * m);
  const DISCOUNT_RUPEES = Number(process.env.PROMO_FLAT_OFF_RUPEES || 5);
  const code = String(promo || "").trim().toUpperCase();
  const discount = (code === "TRY" || code === "TRY10") ? Math.max(0, DISCOUNT_RUPEES) : 0;
  return Math.max(1, gross - discount);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("use POST");

  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return res.status(500).send("webhook_secret_missing");

  const raw = await readRawBody(req);
  const headerVal = req.headers["x-razorpay-signature"];
  const signature = Array.isArray(headerVal) ? headerVal[0] : headerVal; // robust
  const expectedSig = crypto.createHmac("sha256", secret).update(raw).digest("hex");

  // 🔎 Debug: return what the server expects for THIS exact body
  if (req.query?.debug === "1") {
    console.log("WEBHOOK_DEBUG", {
      env: process.env.VERCEL_ENV || "prod",
      commit: process.env.VERCEL_GIT_COMMIT_SHA || "unknown",
      rawLen: raw.length,
    });
    return res.status(200).json({ expected: expectedSig, rawLen: raw.length });
  }

  if (!signature || signature !== expectedSig) {
    console.warn("SIG_MISMATCH", { got: signature, expected: expectedSig, rawLen: raw.length });
    return res.status(401).send("invalid_signature");
  }

  // Parse payload
  let body;
  try { body = JSON.parse(raw.toString("utf8")); }
  catch { return res.status(400).send("invalid_json"); }

  const event = body?.event;
  if (event !== "payment.captured") {
    // Keep idempotent + quiet for non-target events
    return res.status(200).send("ignored_event");
  }

  const pay  = body?.payload?.payment?.entity || {};
  const meta = pay?.notes || {};

  // --- Basic validation / allowlist ---
  const ALLOWED = new Set(["whisper", "sd", "llama"]);
  const product = meta.product;
  const minutes = Number(meta.minutes || 60);
  const userEmail = meta.userEmail || "";

  if (!ALLOWED.has(product) || !minutes || minutes < 1) {
    console.warn("IGNORING_INVALID_NOTES", { product, minutes, meta });
    return res.status(200).send("ignored_invalid_notes");
  }

  // Optional: reject unexpected (test) calls using a guard stored in order notes
  // If you set WEBHOOK_GUARD in env AND include the same value in order notes,
  // only matching events will be accepted.
  const GUARD = (process.env.WEBHOOK_GUARD || "").trim();
  if (GUARD && meta.webhook_guard !== GUARD) {
    console.warn("IGNORING_GUARD_MISMATCH", { want: GUARD, got: meta.webhook_guard, order_id: pay.order_id });
    return res.status(200).send("ignored_guard_mismatch");
  }

  // Sanity: price expectation (log only; do not block)
  const expectedPrice = expectedRupees({ product, minutes, promo: meta.promo });
  const paidRupees = typeof pay.amount === "number" ? Math.round(pay.amount / 100) : null;
  if (expectedPrice != null && paidRupees != null && Math.abs(paidRupees - expectedPrice) > 5) {
    console.warn("PRICE_MISMATCH_WARN", {
      product, minutes, promo: meta.promo,
      expectedPrice, paidRupees, payment_id: pay.id, order_id: pay.order_id
    });
  }

  console.log("✅ payment.captured", {
    payment_id: pay.id,
    order_id:  pay.order_id,
    amount:    pay.amount,
    product,
    minutes,
    userEmail,
  });

  // ---- Post-payment deploy trigger ----
  const deployerUrl = process.env.DEPLOYER_URL;
  if (deployerUrl && pay?.id) {
    const payload = {
      product,                                 // 'whisper' | 'sd' | 'llama'
      minutes: Math.max(1, Math.min(240, minutes)),
      customer: { email: userEmail },
      payment: { payment_id: pay.id, order_id: pay.order_id, amount: pay.amount },
    };

    // Short timeout — don't hold webhook for long
    const controller = new AbortController();
    const timeoutMs = Number(process.env.DEPLOYER_TIMEOUT_MS || 12000);
    const to = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resp = await fetch(deployerUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Idempotency-Key": pay.id, // avoid double deploys downstream
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(to);

      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        console.error("deployer_non_200", { status: resp.status, body: txt.slice(0, 512) });
      } else {
        const j = await resp.json().catch(() => ({}));
        console.log("deployer_ok", { status: j?.status || "ok", uri: j?.uri, idempotency_key: j?.idempotency_key });
      }
    } catch (e) {
      clearTimeout(to);
      console.error("deployer_call_failed", e?.name || "error", e?.message || String(e));
      // still 200 to stop webhook retries; deployer can be retried from dashboard if needed
    }
  } else {
    console.warn("NO_DEPLOYER_URL_SET_or_NO_PAYMENT_ID");
  }

  return res.status(200).send("ok");
}
