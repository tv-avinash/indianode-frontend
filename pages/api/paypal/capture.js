// pages/api/paypal/capture.js
async function getPayPalAccessToken() {
  const id = process.env.PAYPAL_CLIENT_ID;
  const sec = process.env.PAYPAL_CLIENT_SECRET;
  const live = process.env.PAYPAL_MODE === 'live';
  const base = live ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  const r = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${id}:${sec}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error_description || 'paypal_oauth_failed');
  return { token: j.access_token, base };
}

export default async function handler(req, res) {
  const orderId = req.query?.token; // PayPal returns ?token=<orderId>
  if (!orderId) return res.status(400).send('missing_token');

  try {
    const { token, base } = await getPayPalAccessToken();
    const r = await fetch(`${base}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const j = await r.json();
    if (!r.ok) return res.status(500).send('capture_failed');

    // Minimal success redirect back to homepage
    return res.writeHead(302, { Location: '/?paypal=success' }).end();
  } catch {
    return res.writeHead(302, { Location: '/?paypal=error' }).end();
  }
}
