// pages/api/deployer.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("use POST");
  const idem = req.headers["idempotency-key"] || "";
  const payload = req.body || {};

  console.log("🚚 Deploy request", { idem, payload });

  // Fake a deployed URL for now; we'll swap to real Akash later.
  const fakeUrl = `https://demo.indianode.com/job/${Date.now() % 1e6}`;

  return res.status(200).json({
    status: "accepted",
    idempotency_key: idem,
    uri: fakeUrl,
    received: payload,
  });
}
