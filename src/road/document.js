import { el, link } from './dom.js';
const base =
  'https://github.com/rtmendes/gods-eye-view/blob/main/docs/road-intelligence/';
// Render the trusted repository Markdown using DOM text nodes, never raw HTML.
export function inline(node, text) {
  const pattern = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;
  let offset = 0;
  for (const m of text.matchAll(pattern)) {
    node.append(document.createTextNode(text.slice(offset, m.index)));
    if (m[1]) {
      const url = m[2].startsWith('https://')
        ? m[2]
        : m[2].startsWith('#')
          ? m[2]
          : new URL(m[2], base).href;
      node.append(link(m[1], url));
    } else node.append(el(m[3] ? 'strong' : 'code', m[3] || m[4]));
    offset = m.index + m[0].length;
  }
  node.append(document.createTextNode(text.slice(offset)));
  return node;
}
export function renderDocument(container, markdown) {
  container.replaceChildren();
  const lines = markdown.split('\n');
  let list = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('```')) {
      const language = line.slice(3);
      const body = [];
      while (++i < lines.length && !lines[i].startsWith('```'))
        body.push(lines[i]);
      const pre = el('pre');
      pre.append(el('code', body.join('\n')));
      if (language === 'mermaid')
        pre.prepend(el('p', 'Architecture flow (Mermaid source)'));
      container.append(pre);
      list = null;
      continue;
    }
    const heading = /^(#{1,6}) (.+)$/.exec(line);
    if (heading) {
      const h = inline(el(`h${heading[1].length}`), heading[2]);
      h.id = heading[2]
        .toLowerCase()
        .replace(/[^a-z0-9 -]/g, '')
        .replace(/ /g, '-');
      container.append(h);
      list = null;
      continue;
    }
    if (line.startsWith('|')) {
      const wrap = el('div', null, 'source-table-wrap'),
        table = el('table');
      const head = el('thead'),
        body = el('tbody');
      let first = true;
      while (i < lines.length && lines[i].startsWith('|')) {
        const cells = lines[i]
          .split('|')
          .slice(1, -1)
          .map((s) => s.trim());
        if (!cells.every((s) => /^:?-+:?$/.test(s))) {
          const tr = el('tr');
          for (const cell of cells)
            tr.append(inline(el(first ? 'th' : 'td'), cell));
          (first ? head : body).append(tr);
          first = false;
        }
        i++;
      }
      i--;
      table.append(head, body);
      wrap.append(table);
      container.append(wrap);
      list = null;
      continue;
    }
    const item = /^(?:- |\d+\. )(.+)$/.exec(line);
    if (item) {
      if (!list) {
        list = el('ul');
        container.append(list);
      }
      list.append(inline(el('li'), item[1].replace(/^\[ \] /, '☐ ')));
      continue;
    }
    list = null;
    if (line.trim())
      container.append(
        inline(
          el(line.startsWith('>') ? 'blockquote' : 'p'),
          line.replace(/^> ?/, ''),
        ),
      );
  }
}
