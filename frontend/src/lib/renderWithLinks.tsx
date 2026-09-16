import { cn } from "@/lib/utils";

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

const DEFAULT_LINK_CLASS = "underline break-all text-primary hover:text-primary/80";

/**
 * Renders plain text with any http(s) URLs turned into real, safe links
 * (target="_blank" + rel="noopener noreferrer" to prevent tab-nabbing) and
 * newlines preserved as <br>. Used anywhere user-authored text is shown:
 * messages, posts, comments.
 */
export function renderWithLinks(text: string, linkClassName: string = DEFAULT_LINK_CLASS) {
  return text.split("\n").map((line, lineIdx) => {
    const parts = line.split(URL_REGEX);
    return (
      <span key={lineIdx}>
        {lineIdx > 0 && <br />}
        {parts.map((part, partIdx) =>
          partIdx % 2 === 1 ? (
            <a
              key={partIdx}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={cn(linkClassName)}
            >
              {part}
            </a>
          ) : (
            <span key={partIdx}>{part}</span>
          )
        )}
      </span>
    );
  });
}
