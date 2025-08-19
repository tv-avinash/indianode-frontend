// pages/api/waitlist.js
// Accepts POST { email, product, minutes, note } and forwards to
// - Discord webhook if DISCORD_WEBHOOK_URL is set, or
// - Formspree if FORMSPREE_ID is set,
// else logs and returns {ok:true} so the UI succeeds.

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  const { email, product, minutes, note } = req.body || {};
  const e = String(email || "").trim();
  const p = String(product || "any").trim();
  const m = Math.max(1, Number(minutes || 60));
  const n = String(note || "").trim();

  // very light email check
  if (!e || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) {
    return res.status(400).json({ error: "invalid_email" });
  }

  const ip = (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").toString().split(",")[0].trim();
  const when = new Date().toISOString();

  try {
    const discord = process.env.DISCORD_WEBHOOK_URL;
    if (discord) {
      const content = [
        "🕓 **Waitlist request**",
        `• Email: ${e}`,
        `• Product: ${p}`,
        `• Minutes: ${m}`,
        n ? `• Note: ${n}` : "",
        `• IP: ${ip}`,
        `• Time: ${when}`
      ].filter(Boolean).join("\n");

      const resp = await fetch(discord, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        console.warn("discord_webhook_failed", txt);
      }
      return res.status(200).json({ ok: true, via: "discord" });
    }

    const formspreeId = process.env.FORMSPREE_ID; // e.g. "xyzzabcd"
    if (formspreeId) {
      const resp = await fetch(`https://formspree.io/f/${formspreeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          email: e,
          product: p,
          minutes: m,
          note: n,
          ip,
          time: when,
        }),
      });
      // Formspree returns 200/OK for good submissions
      if (!resp.ok) {
        const txt = await resp.text();
        console.warn("formspree_failed", txt);
      }
      return res.status(200).json({ ok: true, via: "formspree" });
    }

    // Fallback: just log so you see it in Vercel logs
    console.log("WAITLIST_FALLBACK", { email: e, product: p, minutes: m, note: n, ip, when });
    return res.status(200).json({ ok: true, via: "log" });
  } catch (err) {
    console.error("waitlist_error", err?.message || err);
    return res.status(500).json({ error: "waitlist_error" });
  }
}
