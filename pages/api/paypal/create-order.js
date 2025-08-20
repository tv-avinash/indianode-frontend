// pages/api/paypal/create-order.js
function getOrigin(req) {
  if (process.env.NEXT_PUBLIC_SITE_ORIGIN) return process.env.NEXT_PUBLIC_SITE_ORIGIN;
  const host = req?.headers?.host || 'localhost:3000';
  const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1');
  return `http${isLocal ? '' : 's'}://${host}`;
}

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
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  try {
    const { product, minutes = 60, amountUsd } = req.body || {};
    // Minimal server validation
    const ALLOWED = new Set(['whisper', 'sd', 'llama']);
    if (!ALLOWED.has(product) || !amountUsd || Number(amountUsd) <= 0) {
      return res.status(400).json({ error: 'invalid_input' });
    }

    const origin = getOrigin(req);
    const { token, base } = await getPayPalAccessToken();

    const body = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: { currency_code: 'USD', value: amountUsd.toFixed(2) },
          description: `${product} • ${minutes} min @ Indianode`,
        },
      ],
      application_context: {
        brand_name: 'Indianode',
        user_action: 'PAY_NOW',
        return_url: `${origin}/api/paypal/capture`, // PayPal appends ?token=ORDER_ID
        cancel_url: `${origin}/?paypal=cancel`,
      },
    };

    const r2 = await fetch(`${base}/v2/checkout/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j2 = await r2.json();
    if (!r2.ok) return res.status(500).json({ error: j2?.message || 'create_order_failed' });

    const approve = (j2.links || []).find(l => l.rel === 'approve')?.href;
    if (!approve) return res.status(500).json({ error: 'no_approve_link' });

    return res.status(200).json({ id: j2.id, approveUrl: approve });
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'paypal_error' });
  }
}
