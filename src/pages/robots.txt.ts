import { SITE_URL } from "../consts";

export function GET() {
  return new Response(
    `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap-index.xml\n`,
    { headers: { "Content-Type": "text/plain" } }
  );
}
