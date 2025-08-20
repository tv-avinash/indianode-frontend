export default function handler(req, res) {
  res.setHeader("Location", "/sitemap.xml");
  res.status(308).end();
}
