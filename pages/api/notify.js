// pages/api/notify.js
import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  // Simple auth so only your deployer can call this
  const token = req.headers["x-notify-token"];
  if (!token || token !== process.env.NOTIFY_TOKEN) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const { email, uri, product, minutes, dry_run } = req.body || {};
  if (!email || !uri) return res.status(400).json({ error: "missing_fields" });

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM } = process.env;
  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 465),
    secure: Number(SMTP_PORT || 465) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  const subject = `Live${dry_run ? " (demo)" : ""}: your ${product || "GPU"} job`;
  const text = `Your deployment is live${dry_run ? " (demo)" : ""}.\n` +
               `Open: ${uri}\n\nMinutes: ${minutes || ""}\nProduct: ${product || ""}`;

  await transport.sendMail({ from: EMAIL_FROM, to: email, subject, text });
  return res.status(200).json({ ok: true });
}
