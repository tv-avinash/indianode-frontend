// pages/api/compute/done.js
import { checkAuth } from "./_auth";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!checkAuth(req, res)) return;

  // optional: mark job finished in KV/DB; send email, etc.
  // const { id, status, note } = req.body || {};
  return res.json({ ok: true });
}
