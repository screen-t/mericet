import { buildProfileMeta, buildFallbackMeta, type MetaTags } from "./_lib/meta";
import { fetchBuiltShell, injectMetaTags } from "./_lib/html-shell";
import { getProfile, BackendError } from "./_lib/backend";

export const config = { runtime: "edge" };

const HTML_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=86400",
};

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const username = url.searchParams.get("username") || "";
  const origin = url.origin;

  const shellPromise = fetchBuiltShell(origin);

  let meta: MetaTags;
  try {
    const profile = await getProfile(username);
    meta = profile.suspended_at ? buildFallbackMeta(origin, "suspended") : buildProfileMeta(origin, username, profile);
  } catch (err) {
    if (err instanceof BackendError && (err.status === 404 || err.status === 403)) {
      meta = buildFallbackMeta(origin, err.status === 403 ? "suspended" : "not_found_profile");
    } else {
      // Backend unreachable/timeout/unexpected error — never guess "not
      // found" when the real cause is a network failure. Fail open: serve
      // today's generic shell unmodified.
      const shell = await shellPromise;
      return new Response(shell, { headers: { "content-type": "text/html; charset=utf-8" } });
    }
  }

  const shell = await shellPromise;
  const html = injectMetaTags(shell, meta);
  return new Response(html, { headers: HTML_HEADERS });
}
