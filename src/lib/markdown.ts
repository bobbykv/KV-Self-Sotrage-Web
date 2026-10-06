import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

/** Markdown from staff (blog/FAQ) -> sanitized HTML. */
export function renderMarkdown(md: string): string {
  const html = marked.parse(md.replace(/<!--[\s\S]*?-->/g, ""), { async: false, gfm: true, breaks: false }) as string;
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2"]),
    allowedAttributes: { a: ["href", "title", "target", "rel"], img: ["src", "alt", "title", "width", "height"] },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    transformTags: { a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }) },
  });
}

export function excerptOf(md: string, max = 180): string {
  const text = md
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#*_>`~-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? text.slice(0, max).replace(/\s\S*$/, "") + "…" : text;
}
