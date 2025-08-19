// pages/api/notify.js
import nodemailer from "nodemailer";

export default async function handler(req, res) {
  // Health check so you can confirm the new code is deployed
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      supports: ["queued", "live"],
      version: "notify-v2",
      time: new Date().toISOString(),
    });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  // shared-secret auth (must match Render)
  const token = req.headers["x-notify-token"];
  if (!token || token !== process.env.NOTIFY_TOKEN) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const {
    email,
    uri,            // for LIVE messages only
    product = "GPU",
    minutes = 60,
    dry_run = false,
    queued = false, // true for QUEUED messages
    position = null // queue position
  } = req.body || {};

  if (!email) return res.status(400).json({ error: "missing_email" });

  // SMTP defaults for Resend
  const SMTP_HOST = process.env.SMTP_HOST || "smtp.resend.com";
  const SMTP_PORT = Number(process.env.SMTP_PORT || 587); // STARTTLS default
  const SMTP_USER = process.env.SMTP_USER || "resend";
  const SMTP_PASS = process.env.SMTP_PASS;                // re_...
  const FROM      = process.env.EMAIL_FROM || process.env.FROM_EMAIL || "Indianode <no-reply@indianode.com>";

  if (!SMTP_PASS) return res.status(500).json({ error: "smtp_not_configured" });

  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  let subject, text, html;

  if (queued) {
    const posText = (position ?? "unknown");
    subject = `[Indianode] Queued: ${product} (${minutes} min) — Position ${posText}`;
    text =
`Thanks for your order!

Your job is QUEUED.
• Product: ${product}
• Duration: ${minutes} minutes
• Queue position: ${posText}

We’ll email you again as soon as it goes LIVE.`;
    html = `
      <p>Thanks for your order!</p>
      <p>Your job is <strong>QUEUED</strong>.</p>
      <ul>
        <li><b>Product:</b> ${product}</li>
        <li><b>Duration:</b> ${minutes} minutes</li>
        <li><b>Queue position:</b> ${posText}</li>
      </ul>
      <p>We’ll email you again as soon as it goes <b>LIVE</b>.</p>
    `;
  } else {
    if (!uri) return res.status(400).json({ error: "missing_uri_for_live" });
    subject = `[Indianode] Live: ${product} ${dry_run ? "(demo)" : "ready"}`;
    text =
`Your deployment is LIVE ${dry_run ? "(demo)" : ""}.

Product: ${product}
Duration: ${minutes} minutes
URL: ${uri}`;
    html = `
      <p>Your deployment is <b>LIVE</b> ${dry_run ? "(demo)" : ""}.</p>
      <ul>
        <li><b>Product:</b> ${product}</li>
        <li><b>Duration:</b> ${minutes} minutes</li>
        <li><b>URL:</b> <a href="${uri}" target="_blank" rel="noopener">${uri}</a></li>
      </ul>
    `;
  }

  try {
    await transport.sendMail({ from: FROM, to: email, subject, text, html });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "send_error" });
  }
}
