// pages/api/_debug-compute-sig.js
import crypto from "crypto";
export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
  const raw = await new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  res.status(200).json({ expected, rawLen: raw.length });
}
