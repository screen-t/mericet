import { buildStaticPageMeta } from "./_lib/meta";
import { fetchBuiltShell, injectMetaTags } from "./_lib/html-shell";

export const config = { runtime: "edge" };

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const page = url.searchParams.get("page") || "landing";
  const origin = url.origin;

  const shell = await fetchBuiltShell(origin);
  const meta = buildStaticPageMeta(origin, page);
  const html = injectMetaTags(shell, meta);

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
