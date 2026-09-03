// Markdown rendering + heading extraction, built on the global `marked` and `DOMPurify`
// loaded via CDN <script> tags in index.html.

function stripInlineMarkdown(text) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .trim();
}

// Prefixed so a heading like "Title" or "Body" can never produce an id (e.g.
// "title") that collides with DOMPurify's DOM-clobbering-protection blocklist
// (which strips id/name values matching sensitive property names like
// document.title or document.body) and gets silently stripped on sanitize.
const SLUG_PREFIX = 'heading-';

function slugify(text, seen) {
  let base = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  if (!base) base = 'section';
  base = SLUG_PREFIX + base;
  let slug = base;
  let n = 1;
  while (seen.has(slug)) {
    n += 1;
    slug = `${base}-${n}`;
  }
  seen.add(slug);
  return slug;
}

// Returns an ordered array of { level, text, slug } for every heading in the document,
// using marked's own lexer so `#` inside fenced code blocks and Setext headings are
// handled correctly (a hand-rolled regex would get both wrong).
export function extractHeadings(markdownText) {
  const tokens = window.marked.lexer(markdownText || '');
  const seen = new Set();
  return tokens
    .filter((t) => t.type === 'heading')
    .map((t) => {
      const text = stripInlineMarkdown(t.text);
      return { level: t.depth, text, slug: slugify(text, seen) };
    });
}

// Renders markdown to sanitized HTML. Heading IDs are assigned from the same
// slug list `extractHeadings` produces (consumed in order), so ToC links and
// rendered heading ids always agree.
export function renderMarkdown(markdownText) {
  const headings = extractHeadings(markdownText || '');
  let cursor = 0;

  const renderer = new window.marked.Renderer();
  renderer.heading = (text, level) => {
    const heading = headings[cursor];
    cursor += 1;
    const slug = heading ? heading.slug : '';
    return `<h${level} id="${slug}">${text}</h${level}>\n`;
  };
  renderer.link = (href, title, text) => {
    const safeHref = href || '';
    const titleAttr = title ? ` title="${title}"` : '';
    return `<a href="${safeHref}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
  };

  const rawHtml = window.marked.parse(markdownText || '', { renderer });
  return window.DOMPurify.sanitize(rawHtml, { ADD_ATTR: ['target', 'rel'] });
}
