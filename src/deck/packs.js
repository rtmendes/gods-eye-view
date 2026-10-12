/**
 * Publishing packs: the structured hand-off the Deck's analyst writes for a
 * publishing tool such as Elite Writer. A pack travels inside the model's
 * answer as a fenced `gev-pack` JSON block; this module finds those blocks,
 * checks their shape, resolves each view to a link that opens the globe,
 * and renders a pack as Markdown. Portable: no Node, browser or rendering
 * code.
 */

import { createView, viewUrl } from '../view/index.js';

export const PACK_FENCE = 'gev-pack';
const FENCE = /```gev-pack[^\S\n]*\n([\s\S]*?)```/g;

const LIMITS = Object.freeze({
  title: 200,
  summary: 2000,
  narrative: 20_000,
  label: 200,
  description: 2000,
  items: 12,
  rows: 200,
  tags: 16,
  tag: 40,
});

/** The angles a pack may suggest for a visual. */
export const VISUAL_KINDS = Object.freeze([
  'globe-capture',
  'cockpit',
  'camera-snapshot',
  'weather-map',
  'satellite-image',
  'chart',
  'map-annotation',
  'scene',
]);

const text = (value, max) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

const list = (value, max) => (Array.isArray(value) ? value.slice(0, max) : []);

/**
 * Split an answer into its prose and its packs. A block that is not valid
 * JSON, or not a pack, is reported in `errors` and left out of the prose.
 */
export function extractPacks(answer) {
  const packs = [];
  const errors = [];
  const prose = String(answer ?? '')
    .replace(FENCE, (_, body) => {
      try {
        packs.push(normalizePack(JSON.parse(body)));
      } catch (error) {
        errors.push(error.message);
      }
      return '';
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { text: prose, packs, errors };
}

/** A pack with every field present, bounded and of the expected type. */
export function normalizePack(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    throw new TypeError('A pack must be a JSON object');
  const title = text(raw.title, LIMITS.title);
  if (!title) throw new TypeError('A pack needs a title');
  return {
    title,
    summary: text(raw.summary, LIMITS.summary),
    narrative: text(raw.narrative, LIMITS.narrative),
    tags: list(raw.tags, LIMITS.tags)
      .map((tag) => text(tag, LIMITS.tag))
      .filter(Boolean),
    views: list(raw.views, LIMITS.items)
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        label: text(item.label, LIMITS.label) || 'View',
        caption: text(item.caption, LIMITS.description),
        view:
          item.view && typeof item.view === 'object'
            ? structuredClone(item.view)
            : null,
      })),
    data: list(raw.data, LIMITS.items)
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        label: text(item.label, LIMITS.label) || 'Data',
        source: text(item.source, LIMITS.label),
        columns: list(item.columns, 40)
          .map((column) => text(column, 80))
          .filter(Boolean),
        rows: list(item.rows, LIMITS.rows).map((row) =>
          Array.isArray(row)
            ? row.slice(0, 40).map(cell)
            : row && typeof row === 'object'
              ? Object.fromEntries(
                  Object.entries(row)
                    .slice(0, 40)
                    .map(([key, value]) => [text(key, 80), cell(value)]),
                )
              : cell(row),
        ),
      })),
    visuals: list(raw.visuals, LIMITS.items)
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        label: text(item.label, LIMITS.label) || 'Visual',
        kind: VISUAL_KINDS.includes(item.kind) ? item.kind : 'globe-capture',
        description: text(item.description, LIMITS.description),
        view:
          item.view && typeof item.view === 'object'
            ? structuredClone(item.view)
            : null,
      })),
  };
}

function cell(value) {
  if (value == null) return null;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  return text(typeof value === 'string' ? value : JSON.stringify(value), 500);
}

/**
 * Resolve every view in a pack to the link that opens it. A view the app
 * cannot show keeps its description and reports why.
 */
export function resolvePack(pack, { baseUrl }) {
  const resolve = (item) => {
    if (!item.view) return { ...item, url: null };
    try {
      const view = createView(item.view);
      return {
        ...item,
        view,
        url: baseUrl ? viewUrl(baseUrl, view) : null,
      };
    } catch (error) {
      return { ...item, view: null, url: null, error: error.message };
    }
  };
  return {
    ...pack,
    views: pack.views.map(resolve),
    visuals: pack.visuals.map(resolve),
  };
}

/** A pack as Markdown, for pasting into a writing tool. */
export function packToMarkdown(pack) {
  const lines = [`# ${pack.title}`, ''];
  if (pack.summary) lines.push(pack.summary, '');
  if (pack.tags.length) lines.push(`Tags: ${pack.tags.join(', ')}`, '');
  if (pack.narrative) lines.push('## Narrative', '', pack.narrative, '');
  if (pack.views.length) {
    lines.push('## Views', '');
    for (const view of pack.views) {
      lines.push(
        `- **${view.label}**${view.caption ? ` — ${view.caption}` : ''}${
          view.url ? ` — [open in God's Eye View](${view.url})` : ''
        }${view.error ? ` — not shown: ${view.error}` : ''}`,
      );
    }
    lines.push('');
  }
  for (const table of pack.data) {
    lines.push(`## ${table.label}`, '');
    if (table.source) lines.push(`Source: ${table.source}`, '');
    const columns = table.columns.length
      ? table.columns
      : table.rows[0] && typeof table.rows[0] === 'object'
        ? Object.keys(table.rows[0])
        : [];
    if (columns.length) {
      lines.push(
        `| ${columns.join(' | ')} |`,
        `| ${columns.map(() => '---').join(' | ')} |`,
      );
      for (const row of table.rows) {
        const cells = Array.isArray(row)
          ? row
          : columns.map((column) => row?.[column]);
        lines.push(`| ${cells.map(markdownCell).join(' | ')} |`);
      }
    } else {
      for (const row of table.rows) lines.push(`- ${markdownCell(row)}`);
    }
    lines.push('');
  }
  if (pack.visuals.length) {
    lines.push('## Visuals', '');
    for (const visual of pack.visuals) {
      lines.push(
        `- **${visual.label}** (${visual.kind})${
          visual.description ? ` — ${visual.description}` : ''
        }${visual.url ? ` — [capture here](${visual.url})` : ''}`,
      );
    }
    lines.push('');
  }
  return lines.join('\n').trim() + '\n';
}

function markdownCell(value) {
  if (value == null) return '';
  return String(typeof value === 'object' ? JSON.stringify(value) : value)
    .replace(/\|/g, '\\|')
    .replace(/\n/g, ' ');
}
