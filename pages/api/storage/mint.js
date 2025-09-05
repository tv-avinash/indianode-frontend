// pages/api/storage/mint.js
import { kv } from "@vercel/kv";
import Razorpay from "razorpay";
import crypto from "crypto";

function makeToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "dev")
                    .update(body).digest("base64url");
  return `v1.${body}.${sig}`;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok:false, error:"Method Not Allowed" });

    const { paymentId, plan, email="", bucketName="", notes="" } = req.body || {};
    if (!paymentId) return res.status(400).json({ ok:false, error:"missing_payment" });

    // (Light) verification: ensure payment exists
    const rzp = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || "",
      key_secret: process.env.RAZORPAY_KEY_SECRET || "",
    });
    let payment = null;
    try { payment = await rzp.payments.fetch(paymentId); } catch {}

    if (!payment || payment.status !== "captured") {
      // allow "authorized" if you use automatic capture later
      if (payment?.status !== "authorized") {
        return res.status(400).json({ ok:false, error:"payment_verify_failed" });
      }
    }

    const now = Date.now();
    const tokenPayload = {
      v: 1,
      kind: "storage",
      plan: String(plan),
      email: String(email || ""),
      bucketName: String(bucketName || ""),
      notes: String(notes || ""),
      pay_id: paymentId,
      iat: now,
      exp: now + 30 * 24 * 60 * 60 * 1000, // 30 days token validity
    };
    const token = makeToken(tokenPayload);

    // Optionally: remember the token → user mapping for receipts
    await kv.set(`storage:token:${paymentId}`, tokenPayload);

    return res.status(200).json({ ok:true, token });
  } catch (e) {
    console.error("storage/mint error:", e);
    return res.status(500).json({ ok:false, error:"mint_failed" });
  }
}
