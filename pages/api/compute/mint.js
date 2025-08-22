// pages/api/compute/mint.js
// Body: { paymentId, product, minutes, email, promo }
// Queues a job and emails the user a status link.

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const MAIL_FROM = process.env.MAIL_FROM || "Indianode <no-reply@indianode.com>";
const BASE_URL = process.env.BASE_URL || "https://www.indianode.com";
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

async function kv(command, ...args) {
  const r = await fetch(KV_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ command, args }),
  });
  return r.json();
}

const PRICE60 = { cpu2x4: 1, cpu4x8: 2, cpu8x16: 4, redis4: 1, redis8: 2, redis16: 3 };

async function verifyPayment(paymentId, expectedAmountPaise) {
  // Verify with Razorpay REST (no SDK)
  const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");
  const r = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Basic ${auth}` },
    cache: "no-store",
  });
  if (!r.ok) return { ok: false, error: "razorpay_lookup_failed" };
  const p = await r.json();
  if (p.status !== "captured") return { ok: false, error: "payment_not_captured" };
  if (expectedAmountPaise && Number(p.amount) < expectedAmountPaise) {
    return { ok: false, error: "amount_too_low" };
  }
  return { ok: true, payment: p };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  try {
    const { paymentId, product, minutes, email = "", promo = "" } = await req.json?.() || req.body;

    if (!PRICE60[product]) return res.status(400).json({ ok: false, error: "invalid_product" });
    const mins = Math.max(1, Number(minutes || 60));
    const inr = Math.ceil((PRICE60[product] / 60) * mins);
    const expectedPaise = Math.max(100, inr * 100); // ₹1 minimum

    const v = await verifyPayment(paymentId, expectedPaise);
    if (!v.ok) return res.status(400).json({ ok: false, error: v.error });

    const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const job = {
      id,
      product,
      minutes: mins,
      email: (email || "").trim(),
      status: "queued",
      queued_at: Date.now(),
      payment_id: paymentId,
      promo: (promo || "").trim().toUpperCase(),
      provider: null,
      public_host: null,
      started_at: null,
      finished_at: null,
      logs: [],
    };

    await kv("SET", `compute:job:${id}`, JSON.stringify(job), "EX", 60 * 60 * 24 * 7);
    await kv("RPUSH", "compute:queue", id);

    // Email user (queued)
    if (RESEND_API_KEY && job.email) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: MAIL_FROM,
          to: job.email,
          subject: `Queued: ${product} • ${mins} min`,
          text: `Your compute job has been queued.\n\nJob ID: ${id}\nCheck status: ${BASE_URL}/api/compute/status?id=${id}\n\nWe’ll email you again when it starts and when it completes.`,
        }),
      });
    }

    return res.status(200).json({ ok: true, queued: true, id });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "mint_failed" });
  }
}
