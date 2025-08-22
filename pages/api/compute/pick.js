// pages/api/compute/pick.js
import { checkAuth } from "./_auth";

// minimal KV (Upstash or Vercel KV) – adapt if yours is different
const kvFetch = async (key) => {
  // pop one job id from a list; replace with your own KV client if you already have one
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;

  // RPOP queue:list -> job payload in another key
  const q = "compute:queue:list";
  const popped = await fetch(`${url}/rpop/${q}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!popped.ok) return null;
  const id = (await popped.json())?.result;
  if (!id) return null;

  const jobRaw = await fetch(`${url}/get/compute:job:${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!jobRaw.ok) return { id, job: null };
  const job = (await jobRaw.json())?.result;
  try {
    return { id, job: JSON.parse(job) };
  } catch {
    return { id, job: null };
  }
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!checkAuth(req, res)) return;

  const got = await kvFetch();
  if (!got || !got.job) {
    return res.json({ ok: true, job: null });
  }

  // include the job id in the payload returned to the worker
  return res.json({ ok: true, job: { ...got.job, id: got.id } });
}
