// pages/api/deployer.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("use POST");

  const idem = req.headers["idempotency-key"] || "";
  const { product, minutes, customer, payment } = req.body || {};

  const ALLOWED = new Set(["whisper", "sd", "llama"]);
  if (!ALLOWED.has(product)) return res.status(400).json({ error: "invalid_product" });

  const mins = Math.max(1, Number(minutes) || 60);

  console.log("🚚 Deploy request", {
    idem,
    product,
    minutes: mins,
    customer,
    payment,
  });

  // fake a “deployed” URL for now (we’ll swap to real Akash next)
  const uri = `https://demo.indianode.com/job/${product}-${Date.now() % 1e6}`;

  return res.status(200).json({
    status: "accepted",
    idempotency_key: idem,
    uri,
    received: { product, minutes: mins, customer, payment },
  });
}
