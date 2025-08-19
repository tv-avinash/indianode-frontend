import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  const token = req.headers["x-email-test-token"];
  if (!token || token !== process.env.EMAIL_TEST_TOKEN) return res.status(401).json({ error: "unauthorized" });

  const { to = "", subject = "Indianode test", text = "Hello from Indianode (Resend SMTP)" } = req.body || {};
  if (!to) return res.status(400).json({ error: "missing_to" });

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM } = process.env;

  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 465),
    secure: Number(SMTP_PORT || 465) === 465, // true for 465
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  await transport.sendMail({ from: EMAIL_FROM, to, subject, text });
  res.status(200).json({ ok: true });
}
