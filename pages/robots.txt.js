// pages/robots.txt.js
export default function handler(req, res) {
  const txt = [
    "User-agent: *",
    "Allow: /",
    "",
    "Sitemap: https://www.indianode.com/sitemap.xml",
    ""
  ].join("\n");

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=604800");
  res.status(200).send(txt);
}
