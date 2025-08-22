// pages/api/compute/progress.js
import { checkAuth } from "./_auth";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!checkAuth(req, res)) return;

  // optional: record heartbeat to KV/DB here
  // const { id, status, note } = req.body || {};
  return res.json({ ok: true });
}
