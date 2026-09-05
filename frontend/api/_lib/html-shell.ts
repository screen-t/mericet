import type { MetaTags } from "./meta";

/**
 * Minimal, dependency-free HTML shown only if the same-origin self-fetch of
 * the real built shell fails (should be extremely rare — same CDN serving
 * the request). Never depends on dist output existing.
 */
const HARD_FALLBACK_HTML =
  '<!doctype html><html><head><meta charset="utf-8"><title>Mericet</title></head><body><a href="/">Continue to Mericet</a></body></html>';

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Fetches the actual built index.html (with correctly hashed asset paths)
 * from this same deployment at request time, rather than inlining it at
 * build time — see plan rationale: Edge Functions have no filesystem access,
 * and the unbundled source index.html references /src/main.tsx, which
 * doesn't exist in production.
 */
export async function fetchBuiltShell(origin: string): Promise<string> {
  try {
    const res = await fetch(new URL("/index.html", origin).toString());
    if (!res.ok) return HARD_FALLBACK_HTML;
    return await res.text();
  } catch {
    return HARD_FALLBACK_HTML;
  }
}

export function injectMetaTags(html: string, tags: MetaTags): string {
  const title = escapeHtml(tags.title);
  const description = escapeHtml(tags.description);
  const image = escapeHtml(tags.image);
  const url = escapeHtml(tags.url);
  const type = escapeHtml(tags.type);

  let out = html;

  out = out.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`);

  out = out.replace(
    /<meta name="description" content="[^"]*"\s*\/?>/,
    `<meta name="description" content="${description}" />`
  );

  out = out.replace(
    /<meta property="og:title" content="[^"]*"\s*\/?>/,
    `<meta property="og:title" content="${title}" />`
  );
  out = out.replace(
    /<meta property="og:description" content="[^"]*"\s*\/?>/,
    `<meta property="og:description" content="${description}" />`
  );
  out = out.replace(
    /<meta property="og:type" content="[^"]*"\s*\/?>/,
    `<meta property="og:type" content="${type}" />`
  );

  // og:image / og:url don't exist yet in the current shell — insert them
  // right after og:type. On future edits, just update in place if present.
  if (/<meta property="og:image"/.test(out)) {
    out = out.replace(/<meta property="og:image" content="[^"]*"\s*\/?>/, `<meta property="og:image" content="${image}" />`);
    out = out.replace(/<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${url}" />`);
  } else {
    out = out.replace(
      /(<meta property="og:type" content="[^"]*"\s*\/?>)/,
      `$1\n    <meta property="og:image" content="${image}" />\n    <meta property="og:url" content="${url}" />`
    );
  }

  // twitter:title / description / image don't exist yet either — insert
  // right after twitter:card if missing.
  if (!/<meta name="twitter:title"/.test(out)) {
    out = out.replace(
      /(<meta name="twitter:card" content="[^"]*"\s*\/?>)/,
      `$1\n    <meta name="twitter:title" content="${title}" />\n    <meta name="twitter:description" content="${description}" />\n    <meta name="twitter:image" content="${image}" />`
    );
  } else {
    out = out.replace(/<meta name="twitter:title" content="[^"]*"\s*\/?>/, `<meta name="twitter:title" content="${title}" />`);
    out = out.replace(/<meta name="twitter:description" content="[^"]*"\s*\/?>/, `<meta name="twitter:description" content="${description}" />`);
    out = out.replace(/<meta name="twitter:image" content="[^"]*"\s*\/?>/, `<meta name="twitter:image" content="${image}" />`);
  }

  return out;
}
