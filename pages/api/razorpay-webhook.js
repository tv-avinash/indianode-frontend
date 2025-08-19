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

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("use POST");

  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return res.status(500).send("webhook_secret_missing");

  const raw = await readRawBody(req);
  const headerVal = req.headers["x-razorpay-signature"];
  const signature = Array.isArray(headerVal) ? headerVal[0] : headerVal; // robust
  const expected  = crypto.createHmac("sha256", secret).update(raw).digest("hex");

  // 🔎 Debug: return what the server expects for THIS exact body
  if (req.query?.debug === "1") {
    console.log("WEBHOOK_DEBUG", {
      env: process.env.VERCEL_ENV || "prod",
      commit: process.env.VERCEL_GIT_COMMIT_SHA || "unknown",
      rawLen: raw.length,
    });
    return res.status(200).json({ expected, rawLen: raw.length });
  }

  if (signature !== expected) {
    console.warn("SIG_MISMATCH", { got: signature, expected, rawLen: raw.length });
    return res.status(401).send("invalid_signature");
  }

  const body = JSON.parse(raw.toString("utf8"));
  const event = body?.event;
  if (event !== "payment.captured") {
    // Ignore other events to keep idempotent behavior
    return res.status(200).send("ignored");
  }

  const pay  = body.payload?.payment?.entity || {};
  const meta = pay.notes || {};

  console.log("✅ payment.captured", {
    payment_id: pay.id,
    order_id:  pay.order_id,
    amount:    pay.amount,
    product:   meta.product,
    minutes:   meta.minutes,
    userEmail: meta.userEmail,
  });

  // ---- Post-payment deploy trigger (optional) ----
  // If DEPLOYER_URL is set, call it with idempotency key = payment id.
  const deployerUrl = process.env.DEPLOYER_URL;
  if (deployerUrl && pay?.id) {
    const payload = {
      product: meta.product,                // e.g. 'whisper' | 'sd' | 'llama'
      minutes: Number(meta.minutes || 60),  // rental duration
      customer: { email: meta.userEmail },  // optional
      payment: { payment_id: pay.id, order_id: pay.order_id, amount: pay.amount },
    };

    // Don’t block the webhook for long; short timeout + fire-and-log.
    const controller = new AbortController();
    const timeoutMs = Number(process.env.DEPLOYER_TIMEOUT_MS || 12000); // 12s default
    const to = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resp = await fetch(deployerUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Idempotency-Key": pay.id, // critical to avoid double deploys
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(to);

      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        console.error("deployer_non_200", { status: resp.status, body: txt.slice(0, 512) });
      } else {
        // Optional: log a small success line
        const j = await resp.json().catch(() => ({}));
        console.log("deployer_ok", {
          status: j?.status || "ok",
          uri: j?.uri,
          idempotency_key: j?.idempotency_key,
        });
      }
    } catch (e) {
      clearTimeout(to);
      console.error("deployer_call_failed", e?.name || "error", e?.message || String(e));
    }
  }

  return res.status(200).send("ok");
}
