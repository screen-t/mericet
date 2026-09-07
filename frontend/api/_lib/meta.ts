export interface MetaTags {
  title: string;
  description: string;
  image: string;
  url: string;
  type: "website" | "profile" | "article";
}

const DEFAULT_IMAGE_PATH = "/og-default.png";

function absoluteUrl(origin: string, path: string): string {
  return new URL(path, origin).toString();
}

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max - 1).trimEnd() + "…";
}

export function buildDefaultMeta(origin: string): MetaTags {
  return {
    title: "mericet - Professional Network | Connect, Collaborate & Grow",
    description:
      "Join mericet, the exclusive professional network where industry leaders, professionals, and innovators connect and build meaningful business relationships.",
    image: absoluteUrl(origin, DEFAULT_IMAGE_PATH),
    url: absoluteUrl(origin, "/"),
    type: "website",
  };
}

export function buildStaticPageMeta(origin: string, page: string): MetaTags {
  const image = absoluteUrl(origin, DEFAULT_IMAGE_PATH);
  switch (page) {
    case "terms":
      return {
        title: "Terms of Service | Mericet",
        description:
          "Welcome to Mericet, a professional networking and knowledge platform developed and operated by Puteware. Read our Terms of Service.",
        image,
        url: absoluteUrl(origin, "/terms-of-service"),
        type: "website",
      };
    case "privacy":
      return {
        title: "Privacy Policy | Mericet",
        description:
          "At Puteware, we believe that privacy is not a feature — it is a foundation. Read Mericet's Privacy Policy.",
        image,
        url: absoluteUrl(origin, "/privacy-policy"),
        type: "website",
      };
    case "contact":
      return {
        title: "Contact Us | Mericet",
        description:
          "Have questions, feedback, or a support request? Get in touch with the Mericet team.",
        image,
        url: absoluteUrl(origin, "/contact"),
        type: "website",
      };
    case "landing":
    default:
      return buildDefaultMeta(origin);
  }
}

export interface ProfileMetaInput {
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  headline?: string | null;
  bio?: string | null;
  current_position?: string | null;
  current_company?: string | null;
  avatar_url?: string | null;
}

export function buildProfileMeta(origin: string, usernameParam: string, profile: ProfileMetaInput): MetaTags {
  const name =
    `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() ||
    profile.username ||
    "Mericet user";

  const roleLine =
    profile.headline ||
    (profile.current_position && profile.current_company
      ? `${profile.current_position} at ${profile.current_company}`
      : profile.current_position || "");

  const title = roleLine ? `${name} - ${roleLine} | Mericet` : `${name} | Mericet`;

  const description = truncate(
    profile.bio ||
      (roleLine
        ? `${name} is on Mericet. ${roleLine}.`
        : `${name} is on Mericet, the professional network for industry leaders and innovators.`),
    200
  );

  return {
    title,
    description,
    image: profile.avatar_url || absoluteUrl(origin, DEFAULT_IMAGE_PATH),
    url: absoluteUrl(origin, `/profile/${usernameParam}`),
    type: "profile",
  };
}

export interface PostMetaInput {
  content: string;
  author?: {
    first_name?: string | null;
    last_name?: string | null;
    username?: string | null;
  } | null;
  media?: Array<{ url: string; media_type: string; thumbnail_url?: string | null }> | null;
}

export function buildPostMeta(origin: string, postId: string, post: PostMetaInput): MetaTags {
  const authorName = post.author
    ? `${post.author.first_name ?? ""} ${post.author.last_name ?? ""}`.trim() ||
      post.author.username ||
      "A Mericet user"
    : "A Mericet user";

  const snippet = truncate(post.content || "", 150);

  const firstMedia = post.media?.[0];
  let image = absoluteUrl(origin, DEFAULT_IMAGE_PATH);
  if (firstMedia?.media_type === "image") {
    image = firstMedia.url;
  } else if (firstMedia?.thumbnail_url) {
    image = firstMedia.thumbnail_url;
  }

  return {
    title: `${authorName} on Mericet`,
    description: snippet || `See this post by ${authorName} on Mericet.`,
    image,
    url: absoluteUrl(origin, `/posts/${postId}`),
    type: "article",
  };
}

export type FallbackKind = "suspended" | "not_found_profile" | "not_found_post";

export function buildFallbackMeta(origin: string, kind: FallbackKind): MetaTags {
  const image = absoluteUrl(origin, DEFAULT_IMAGE_PATH);
  const url = absoluteUrl(origin, "/");
  switch (kind) {
    case "suspended":
      return { title: "Profile unavailable · Mericet", description: "This profile is not available.", image, url, type: "website" };
    case "not_found_profile":
      return {
        title: "Profile not found · Mericet",
        description: "This profile doesn't exist or may have been removed.",
        image,
        url,
        type: "website",
      };
    case "not_found_post":
      return {
        title: "Post not found · Mericet",
        description: "This post is unavailable or has been removed.",
        image,
        url,
        type: "website",
      };
  }
}
