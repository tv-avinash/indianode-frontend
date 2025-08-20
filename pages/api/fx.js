// pages/api/fx.js - INR→USD rate with simple 12h cache
let cached = { rate: 0.012, at: 0 }; // fallback seed ≈$0.012
const TTL_MS = 12 * 60 * 60 * 1000;

export default async function handler(req, res) {
  try {
    const now = Date.now();
    if (!cached.rate || now - cached.at > TTL_MS) {
      const r = await fetch('https://api.exchangerate.host/latest?base=INR&symbols=USD');
      const j = await r.json();
      const rate = Number(j?.rates?.USD || 0);
      if (rate > 0) cached = { rate, at: now };
    }
    res.status(200).json({ rate: cached.rate, cachedAt: cached.at });
  } catch {
    // return last good/fallback
    res.status(200).json({ rate: cached.rate, cachedAt: cached.at });
  }
}
