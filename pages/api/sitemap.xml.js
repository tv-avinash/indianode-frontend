// pages/api/sitemap.xml.js
export default async function handler(req, res) {
  const origin = process.env.NEXT_PUBLIC_SITE_ORIGIN || "https://www.indianode.com";

  // Only include real pages you want indexed:
  const urls = [
    "/",                     // home
    // "/whisper-gpu",
    // "/stable-diffusion",
    // "/llama",
  ];

  const lastmod = new Date().toISOString().split("T")[0];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `<url>
  <loc>${origin}${u}</loc>
  <lastmod>${lastmod}</lastmod>
  <changefreq>daily</changefreq>
  <priority>${u === "/" ? "1.0" : "0.8"}</priority>
</url>`).join("\n")}
</urlset>`;

  res.setHeader("Content-Type", "application/xml");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).send(xml);
}
