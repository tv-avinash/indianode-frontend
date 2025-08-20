// pages/sitemap.xml.js
export default function handler(req, res) {
  const base = "https://www.indianode.com";

  const urls = [
    "/",                    // homepage
    // Add real pages as you publish them:
    // "/whisper-gpu",
    // "/stable-diffusion",
    // "/llama",
  ];

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
    urls
      .map(
        (u) =>
          `<url><loc>${base}${u}</loc><changefreq>${u === "/" ? "daily" : "weekly"}</changefreq><priority>${
            u === "/" ? "1.0" : "0.8"
          }</priority></url>`
      )
      .join("") +
    `</urlset>`;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=604800");
  res.status(200).send(xml);
}
