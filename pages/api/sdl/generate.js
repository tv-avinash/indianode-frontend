// pages/api/sdl/generate.js
export const config = { api: { bodyParser: { sizeLimit: "1mb" } } };

const SYS_PROMPT = `
You help developers create Akash SDL (YAML) v2 for simple services.
STRICT RULES:
- Output ONLY valid YAML, starting with: version: "2.0"
- No prose, no code fences, no comments.
- Include one or more services with "image", "env" (if relevant), "expose" (port, as, to: [ { global: true } ]).
- If user mentions GPU, add a "resources" section under the service with a "gpu" count (integer).
- If storage is requested, add a "volumes" key and mount it under the service.
- Always add a minimal "deployment" section mapping service name to { dcloud: { profile: <service>, count: 1 } }.
- If domain/port is mentioned, expose that port. Default to port 80 if unclear.
- Keep YAML compact and valid.
`;

function ip(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

// naive in-memory rate limit
const bucket = new Map(); // ip -> {ts, count}
function limited(ipAddr, max = 15, windowMs = 60_000) {
  const now = Date.now();
  const rec = bucket.get(ipAddr) || { ts: now, count: 0 };
  if (now - rec.ts > windowMs) { rec.ts = now; rec.count = 0; }
  rec.count += 1; bucket.set(ipAddr, rec);
  return rec.count > max;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const ipAddr = ip(req);
  if (limited(ipAddr)) return res.status(429).json({ error: "rate_limited" });

  const { prompt } = req.body || {};
  const need = String(prompt || "").trim();
  if (!need) return res.status(400).json({ error: "empty_prompt" });

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    // Safe fallback template (valid YAML) if no key configured
    const demo = `version: "2.0"
services:
  web:
    image: nginx:alpine
    expose:
      - port: 80
        as: 80
        to:
          - global: true
deployment:
  web:
    dcloud:
      profile: web
      count: 1`;
    return res.status(200).json({ sdl: demo, source: "fallback" });
  }

  try {
    // Call OpenAI Chat Completions (works with gpt-4o-mini, gpt-4.1-mini, etc.)
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: "system", content: SYS_PROMPT },
          {
            role: "user",
            content:
              "Describe the desired service and constraints in plain English. Return YAML only.\n\nUser request:\n" +
              need,
          },
        ],
      }),
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(502).json({ error: "llm_failed", detail: text });
    }
    const data = await r.json();
    const content =
      data?.choices?.[0]?.message?.content?.trim() ||
      "";

    // Strip code fences if a model adds them
    const yaml = content.replace(/^```[a-zA-Z]*\n?|\n?```$/g, "").trim();

    // Very basic sanity check
    if (!yaml.startsWith("version:")) {
      return res.status(500).json({ error: "bad_yaml", preview: yaml.slice(0, 200) });
    }
    return res.status(200).json({ sdl: yaml, source: "openai" });
  } catch (e) {
    return res.status(500).json({ error: "server_error", detail: e.message });
  }
}
