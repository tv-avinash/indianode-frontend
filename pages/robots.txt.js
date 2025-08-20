// pages/robots.txt.js
export async function getServerSideProps({ res }) {
  const origin =
    process.env.NEXT_PUBLIC_SITE_ORIGIN ||
    'https://www.indianode.com';

  const body =
`User-agent: *
Allow: /

Sitemap: ${origin}/sitemap.xml
`;

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600'); // 1h
  res.write(body);
  res.end();

  return { props: {} };
}

export default function Robots() { return null; }
