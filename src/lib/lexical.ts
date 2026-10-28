/**
 * Renders a Lexical editor state (the JSON the local editor saves) to HTML at
 * build time. The markup mirrors the editor's own exportDOM output (footnote
 * classes and ids, figure/figcaption for captioned images, .math-tex wrappers)
 * so article.css styles it the same way the editor's read view does.
 *
 * Unknown node types throw, so a post using a block this renderer doesn't know
 * about fails the build instead of silently losing content.
 */
import katex from 'katex';
import { codeToHtml } from 'shiki';

export interface LexicalNode {
  type: string;
  children?: LexicalNode[];
  [key: string]: unknown;
}

interface Ctx {
  /** Resolves an image src from the post (e.g. "abc.webp") to a public URL. */
  image: (src: string) => string;
}

// Lexical text format bitmask (lexical/src/LexicalConstants.ts)
const FORMATS: [number, string][] = [
  [16, 'code'],
  [1, 'strong'],
  [2, 'em'],
  [4, 's'],
  [8, 'u'],
  [32, 'sub'],
  [64, 'sup'],
  [128, 'mark'],
];

const ALIGN = new Set(['left', 'center', 'right', 'justify']);

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Inline styles come from the editor and reference its CSS variables. Keep only
// what's needed to reproduce them, mapped onto this site's tokens.
function cleanStyle(style: unknown): string {
  if (typeof style !== 'string' || !style.trim()) return '';
  const kept = style
    .split(';')
    .map((d) => d.trim())
    .filter((d) => /^(font-family|font-size|color|background-color)\s*:/.test(d))
    .map((d) => d.replace(/var\(--lw-sans\)/g, 'var(--font-sans)').replace(/var\(--lw-serif\)/g, 'var(--font-serif)'))
    .join('; ');
  return kept ? ` style="${esc(kept)}"` : '';
}

function blockAttrs(node: LexicalNode): string {
  const align = typeof node.format === 'string' && ALIGN.has(node.format) ? `text-align: ${node.format}` : '';
  return align ? ` style="${align}"` : '';
}

function renderMath(equation: string, inline: boolean): string {
  const html = katex.renderToString(equation, { displayMode: !inline, throwOnError: false, strict: false });
  return inline ? `<span class="math-tex">${html}</span>` : `<div class="math-tex">${html}</div>`;
}

function renderText(node: LexicalNode): string {
  let html = esc(String(node.text ?? ''));
  const format = Number(node.format ?? 0);
  for (const [bit, tag] of FORMATS) if (format & bit) html = `<${tag}>${html}</${tag}>`;
  const style = cleanStyle(node.style);
  return style ? `<span${style}>${html}</span>` : html;
}

function renderImage(node: LexicalNode, ctx: Ctx): string {
  const src = ctx.image(String(node.src ?? ''));
  const size = ['width', 'height']
    .filter((k) => typeof node[k] === 'number')
    .map((k) => ` ${k}="${node[k]}"`)
    .join('');
  const img = `<img src="${esc(src)}" alt="${esc(String(node.altText ?? ''))}"${size} loading="lazy" decoding="async">`;
  const caption = String(node.caption ?? '').trim();
  return node.showCaption && caption ? `<figure>${img}<figcaption>${esc(caption)}</figcaption></figure>` : img;
}

async function renderCode(node: LexicalNode): Promise<string> {
  const text = (node.children ?? [])
    .map((c) => (c.type === 'linebreak' ? '\n' : c.type === 'tab' ? '\t' : String(c.text ?? '')))
    .join('');
  const lang = typeof node.language === 'string' && node.language ? node.language : 'text';
  const opts = { themes: { light: 'github-light', dark: 'github-dark' }, defaultColor: false } as const;
  try {
    return await codeToHtml(text, { ...opts, lang });
  } catch {
    return await codeToHtml(text, { ...opts, lang: 'text' });
  }
}

async function children(node: LexicalNode, ctx: Ctx): Promise<string> {
  const parts = await Promise.all((node.children ?? []).map((c) => renderNode(c, ctx)));
  return parts.join('');
}

const isEmpty = (node: LexicalNode) =>
  !node.children?.length || node.children.every((c) => c.type === 'text' && !String(c.text ?? '').trim());

async function renderNode(node: LexicalNode, ctx: Ctx): Promise<string> {
  switch (node.type) {
    case 'root':
      return children(node, ctx);

    case 'paragraph':
      // The editor uses empty paragraphs as spacers; margins handle that here.
      return isEmpty(node) ? '' : `<p${blockAttrs(node)}>${await children(node, ctx)}</p>`;
    case 'heading': {
      const tag = /^h[1-6]$/.test(String(node.tag)) ? node.tag : 'h2';
      return `<${tag}${blockAttrs(node)}>${await children(node, ctx)}</${tag}>`;
    }
    case 'quote':
      return `<blockquote>${await children(node, ctx)}</blockquote>`;
    case 'list': {
      const tag = node.listType === 'number' ? 'ol' : 'ul';
      const start = tag === 'ol' && Number(node.start) > 1 ? ` start="${node.start}"` : '';
      return `<${tag}${start}>${await children(node, ctx)}</${tag}>`;
    }
    case 'listitem': {
      const nestedOnly = node.children?.length === 1 && node.children[0].type === 'list';
      const check = node.checked === true ? '☑ ' : node.checked === false ? '☐ ' : '';
      return `<li${nestedOnly ? ' class="nested-list-item"' : ''}>${check}${await children(node, ctx)}</li>`;
    }
    case 'horizontalrule':
      return '<hr>';
    case 'code':
      return renderCode(node);

    case 'text':
    case 'code-highlight':
      return renderText(node);
    case 'linebreak':
      return '<br>';
    case 'tab':
      return '\t';
    case 'link':
    case 'autolink': {
      const href = String(node.url ?? '');
      const external = /^https?:/i.test(href) ? ' rel="noopener"' : '';
      return `<a href="${esc(href)}"${external}>${await children(node, ctx)}</a>`;
    }

    case 'math':
      return renderMath(String(node.equation ?? ''), node.inline !== false);
    case 'image':
      return renderImage(node, ctx);
    case 'image-row':
      return `<div class="image-row">${await children(node, ctx)}</div>`;

    case 'table':
      return `<div class="table-wrap"><table>${await children(node, ctx)}</table></div>`;
    case 'tablerow':
      return `<tr>${await children(node, ctx)}</tr>`;
    case 'tablecell': {
      const tag = Number(node.headerState ?? 0) > 0 ? 'th' : 'td';
      const span = [
        Number(node.colSpan) > 1 ? ` colspan="${node.colSpan}"` : '',
        Number(node.rowSpan) > 1 ? ` rowspan="${node.rowSpan}"` : '',
      ].join('');
      const bg = typeof node.backgroundColor === 'string' ? ` style="background-color: ${esc(node.backgroundColor)}"` : '';
      return `<${tag}${span}${bg}>${await children(node, ctx)}</${tag}>`;
    }

    // Footnotes: same DOM shape as the editor's FootnoteNodes exportDOM.
    case 'footnote-reference':
      return `<span class="footnote-reference" id="fnref${esc(String(node.footnoteId))}" role="doc-noteref"><sup><a href="#fn${esc(String(node.footnoteId))}">[${node.footnoteIndex}]</a></sup></span>`;
    case 'footnote-section':
      return `<ol class="footnote-section footnotes" role="doc-endnotes">${await children(node, ctx)}</ol>`;
    case 'footnote-item':
      return `<li class="footnote-item" id="fn${esc(String(node.footnoteId))}">${await children(node, ctx)}</li>`;
    case 'footnote-back-link':
      return `<span class="footnote-back-link"><sup><a href="#fnref${esc(String(node.footnoteId))}" aria-label="Back to reference">^</a></sup></span>`;
    case 'footnote-content':
      return `<div class="footnote-content">${await children(node, ctx)}</div>`;

    // Collapsible sections render as native <details>, open state preserved.
    case 'collapsible-container':
      return `<details${node.open ? ' open' : ''}>${await children(node, ctx)}</details>`;
    case 'collapsible-title':
      return `<summary>${await children(node, ctx)}</summary>`;
    case 'collapsible-content':
      return `<div>${await children(node, ctx)}</div>`;

    default:
      throw new Error(`Lexical renderer: unsupported node type "${node.type}". Add it to src/lib/lexical.ts.`);
  }
}

export async function renderLexical(state: { root: LexicalNode }, ctx: Ctx): Promise<string> {
  return renderNode(state.root, ctx);
}
