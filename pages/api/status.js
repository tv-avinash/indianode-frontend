// pages/api/status.js
import { Client } from "ssh2";
import fs from "fs";

function getPrivateKey() {
  // Prefer inline key (works on Vercel). Fallback to file path in local dev.
  const k = process.env.GPU_SSH_PRIVATE_KEY || "";
  const kb64 = process.env.GPU_SSH_PRIVATE_KEY_B64 || "";
  if (k) return k.includes("\\n") ? k.replace(/\\n/g, "\n") : k;
  if (kb64) return Buffer.from(kb64, "base64").toString("utf8");
  const p = process.env.GPU_SSH_PRIVATE_KEY_PATH;
  if (p) {
    try { return fs.readFileSync(p, "utf8"); } catch {}
  }
  return null;
}

function parseNvidiaSmiCsv(csv) {
  // CSV like: "10, 512, 24576"
  if (!csv) return null;
  const parts = csv.trim().split(/\s*,\s*/);
  if (parts.length < 3) return null;
  const [util, used, total] = parts.map((x) => parseInt(x, 10));
  return { gpu_util: util, mem_used_mb: used, mem_total_mb: total };
}

function isBusy(m) {
  if (!m) return true; // safe default
  // Tweak rules as needed:
  return m.gpu_util > 10 || m.mem_used_mb > 1000;
}

// simple 10s cache to avoid SSH on every refresh (works for warm serverless)
let cache = { ts: 0, data: null };

export default async function handler(req, res) {
  try {
    const now = Date.now();
    if (cache.data && now - cache.ts < 10_000) {
      return res.status(200).json(cache.data);
    }

    const host = process.env.GPU_SSH_HOST;
    const port = Number(process.env.GPU_SSH_PORT || 22);
    const username = process.env.GPU_SSH_USER;
    const privateKey = getPrivateKey();

    if (!host || !username || !privateKey) {
      return res.status(500).json({ status: "offline", error: "SSH env not set" });
    }

    const cmd = "nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total --format=csv,noheader,nounits | head -n 1";

    const output = await new Promise((resolve, reject) => {
      const conn = new Client();
      let stdout = "";
      let stderr = "";

      conn.on("ready", () => {
        conn.exec(cmd, (err, stream) => {
          if (err) return reject(err);
          stream.on("close", (code) => {
            conn.end();
            if (code === 0) resolve(stdout);
            else reject(new Error(stderr || `exit ${code}`));
          })
          .on("data", (d) => { stdout += d.toString(); })
          .stderr.on("data", (d) => { stderr += d.toString(); });
        });
      })
      .on("error", reject)
      .connect({ host, port, username, privateKey });
    });

    const metrics = parseNvidiaSmiCsv(output);
    const status = isBusy(metrics) ? "busy" : "available";
    const data = { status, metrics: { ...metrics, source: "ssh+nvidia-smi" } };

    cache = { ts: Date.now(), data };
    return res.status(200).json(data);
  } catch (e) {
    return res.status(200).json({ status: "offline", error: e.message });
  }
}
