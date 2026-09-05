import { buildPostMeta, buildFallbackMeta, type MetaTags } from "./_lib/meta";
import { fetchBuiltShell, injectMetaTags } from "./_lib/html-shell";
import { getPost, BackendError } from "./_lib/backend";

export const config = { runtime: "edge" };

const HTML_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=86400",
};

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const postId = url.searchParams.get("postId") || "";
  const origin = url.origin;

  const shellPromise = fetchBuiltShell(origin);

  let meta: MetaTags;
  try {
    const post = await getPost(postId);
    meta = buildPostMeta(origin, postId, post);
  } catch (err) {
    if (err instanceof BackendError && err.status === 404) {
      // Covers both "doesn't exist" and moderator-hidden — the backend
      // already returns 404 for both cases for non-owner/non-moderator viewers.
      meta = buildFallbackMeta(origin, "not_found_post");
    } else {
      const shell = await shellPromise;
      return new Response(shell, { headers: { "content-type": "text/html; charset=utf-8" } });
    }
  }

  const shell = await shellPromise;
  const html = injectMetaTags(shell, meta);
  return new Response(html, { headers: HTML_HEADERS });
}
