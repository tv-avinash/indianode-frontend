// pages/sitemap.xml.js
export async function getServerSideProps({ res }) {
  const origin =
    process.env.NEXT_PUBLIC_SITE_ORIGIN ||
    "https://www.indianode.com";

  // List only URLs that actually exist on your site today
  const urls = [
    "/", // homepage
    // add more when you create real pages, e.g. "/whisper-gpu", "/stable-diffusion", "/llama"
  ];

  const lastmod = new Date().toISOString().split("T")[0];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${urls
      .map(
        (u) => `<url>
      <loc>${origin}${u}</loc>
      <lastmod>${lastmod}</lastmod>
      <changefreq>daily</changefreq>
      <priority>${u === "/" ? "1.0" : "0.8"}</priority>
    </url>`
      )
      .join("")}
  </urlset>`;

  res.setHeader("Content-Type", "application/xml");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.write(xml);
  res.end();

  return { props: {} };
}

export default function SiteMap() {
  // getServerSideProps will send the XML; this component never renders
  return null;
}
