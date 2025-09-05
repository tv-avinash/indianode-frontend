// pages/api/storage/order.js
import Razorpay from "razorpay";

const INR_BY_PLAN = {
  s50: 99,      // ₹ per month
  s200: 299,
  s1000: 999,
};

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok:false, error:"Method Not Allowed" });

    const { plan, userEmail, bucketName, notes } = req.body || {};
    const inr = INR_BY_PLAN[String(plan)] || 0;
    if (!inr) return res.status(400).json({ ok:false, error:"invalid_plan" });

    const rzp = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || "",
      key_secret: process.env.RAZORPAY_KEY_SECRET || "",
    });

    const order = await rzp.orders.create({
      amount: inr * 100,
      currency: "INR",
      receipt: `stor_${plan}_${Date.now()}`,
      notes: { plan, email: String(userEmail||""), bucketName: String(bucketName||""), notes: String(notes||"") },
    });

    return res.status(200).json({ ok:true, ...order });
  } catch (e) {
    console.error("storage/order error:", e);
    return res.status(500).json({ ok:false, error:"order_failed" });
  }
}
