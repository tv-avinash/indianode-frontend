// pages/sitemap.xml.js
export async function getServerSideProps({ res }) {
  const origin =
    process.env.NEXT_PUBLIC_SITE_ORIGIN ||
    'https://www.indianode.com';

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${origin}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>
  <!-- Add more as you add pages -->
  <!--
  <url><loc>${origin}/whisper-gpu</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>
  <url><loc>${origin}/stable-diffusion</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>
  <url><loc>${origin}/llama</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>
  -->
</urlset>`;

  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600'); // 1h
  res.write(xml);
  res.end();

  return { props: {} };
}

export default function SiteMap() { return null; }
