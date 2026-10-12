/**
 * The Deck: the dashboard around God's Eye View. Missions open views on the
 * globe (framed here in embed mode, or in a new tab), the analyst chat reads
 * the live feeds through the server, and packs it writes are saved, copied
 * as Markdown or handed to the configured publishing tool. State that must
 * survive a reload lives in localStorage; everything else is fetched from
 * /api/deck.
 */

import { GROUPS, SHORTCUTS, USE_CASES, VOICE_ACTIONS } from './usecases.js';

const STORAGE = {
  chat: 'gev-deck:chat',
  packs: 'gev-deck:packs',
  filter: 'gev-deck:filter',
};
const PANES = [
  'missions',
  'globe',
  'analyst',
  'capabilities',
  'publish',
  'setup',
];
const EMBED_READY_TIMEOUT_MS = 20_000;
const MAX_STORED_CHAT_CHARS = 900_000;

const QUICK_PROMPTS = [
  'What is happening around Taiwan right now? Give me a situation brief.',
  'Find the three most visual things on the globe tonight and tell me why each would carry a story.',
  'I am writing an Elite Writer piece on shipping congestion. Pull the data for the Port of Long Beach and give me a pack with tables and views to capture.',
  'Which satellites are overhead New York now, and when does the ISS next pass?',
  'Get the latest radar and lightning over Texas and summarize the storms.',
  "Build a publishing pack about tonight's air traffic over London: angle, data, three views.",
];

const $ = (selector, root = document) => root.querySelector(selector);
const el = (tag, attrs = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of [].concat(children)) {
    if (child == null) continue;
    node.append(
      child.nodeType ? child : document.createTextNode(String(child)),
    );
  }
  return node;
};
const icon = (name) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'icon');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#${name}`);
  svg.append(use);
  return svg;
};

const store = {
  read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage may be unavailable (private mode); the page still works.
    }
  },
};

const state = {
  status: null,
  tools: [],
  viewUrls: new Map(),
  history: store.read(STORAGE.chat, []),
  packs: store.read(STORAGE.packs, []),
  filter: store.read(STORAGE.filter, 'all'),
  currentView: null,
  currentLabel: '',
  embed: { frame: null, ready: false, pending: null, timer: null, sequence: 0 },
  busy: false,
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    cache: 'no-store',
    ...options,
    headers: { Accept: 'application/json', ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.error || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function toast(message, ms = 2600) {
  const node = $('#toast');
  node.textContent = message;
  node.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    node.hidden = true;
  }, ms);
}

function download(name, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = el('a', { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied');
  } catch {
    download('gev-pack.md', text, 'text/markdown');
  }
}

/* Routing */

function currentPane() {
  const name = location.hash.replace(/^#\/?/, '').split('?')[0];
  return PANES.includes(name) ? name : 'missions';
}

function showPane(name) {
  for (const pane of document.querySelectorAll('.pane'))
    pane.hidden = pane.dataset.pane !== name;
  for (const link of document.querySelectorAll('[data-nav]')) {
    if (link.dataset.nav === name) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  if (name === 'analyst') $('#composer-input').focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
}

function navigate(name) {
  if (currentPane() === name) showPane(name);
  else location.hash = `#/${name}`;
}

/* Status */

function statusChip(label, ok, title) {
  return el('span', { class: `chip static ${ok ? 'ok' : 'warn'}`, title }, [
    el('span', { class: 'dot' }),
    label,
  ]);
}

function renderStatus() {
  const status = state.status;
  const chips = $('#status-chips');
  chips.replaceChildren();
  if (!status) {
    chips.append(
      statusChip(
        'Server unreachable',
        false,
        'The /api/deck/status route did not answer',
      ),
    );
    return;
  }
  chips.append(statusChip('Globe', true, status.appUrl || ''));
  chips.append(
    statusChip(
      status.chat.configured ? `Analyst · ${status.chat.model}` : 'Analyst off',
      status.chat.configured,
      status.chat.configured
        ? `Effort ${status.chat.effort}`
        : 'Set ANTHROPIC_API_KEY on the server',
    ),
  );
  chips.append(
    statusChip(
      status.handoff.configured
        ? `Hand-off · ${status.handoff.label}`
        : 'No hand-off',
      status.handoff.configured,
      status.handoff.configured
        ? 'Packs can be sent to the configured webhook'
        : 'Set GEV_DECK_HANDOFF_WEBHOOK_URL to send packs',
    ),
  );
  $('#version-label').textContent = status.version ? `v${status.version}` : '';
  const globe = status.appUrl || '/';
  $('#open-globe').href = globe;
}

function needsMissing(useCase) {
  const providers = state.status?.providers || [];
  return useCase.needs.filter(
    (name) => providers.find((p) => p.name === name)?.configured === false,
  );
}

/* Missions */

function renderMissionFilters() {
  const row = $('#mission-filters');
  row.replaceChildren();
  const all = [{ id: 'all', title: 'All' }, ...GROUPS];
  for (const group of all) {
    row.append(
      el('button', {
        type: 'button',
        class: 'chip',
        role: 'tab',
        'aria-selected': state.filter === group.id ? 'true' : 'false',
        text: group.title,
        onclick: () => {
          state.filter = group.id;
          store.write(STORAGE.filter, group.id);
          renderMissionFilters();
          renderMissions();
        },
      }),
    );
  }
}

function missionCard(useCase) {
  const missing = needsMissing(useCase);
  const url = state.viewUrls.get(useCase.id);
  const meta = [el('span', { text: useCase.sources })];
  for (const name of missing)
    meta.push(el('span', { class: 'need mono', text: `needs ${name}` }));
  return el('article', { class: 'card', id: `mission-${useCase.id}` }, [
    el('div', { class: 'card-top' }, [el('h3', { text: useCase.title })]),
    el('p', { class: 'card-blurb', text: useCase.blurb }),
    el('div', { class: 'card-meta' }, meta),
    el('div', { class: 'card-actions' }, [
      el('button', {
        type: 'button',
        class: 'button small primary',
        text: 'Load in globe',
        onclick: () => {
          loadView(useCase.view, useCase.title, url);
          navigate('globe');
        },
      }),
      el(
        'a',
        {
          class: 'button small ghost',
          href: url || '/',
          target: '_blank',
          rel: 'noopener',
          'aria-disabled': url ? null : 'true',
        },
        ['Open', icon('i-external')],
      ),
      el('button', {
        type: 'button',
        class: 'button small ghost',
        text: 'Ask the analyst',
        onclick: () => askAnalyst(useCase.prompt),
      }),
    ]),
  ]);
}

function renderMissions() {
  const host = $('#mission-groups');
  host.replaceChildren();
  for (const group of GROUPS) {
    if (state.filter !== 'all' && state.filter !== group.id) continue;
    const cases = USE_CASES.filter((useCase) => useCase.group === group.id);
    host.append(
      el('section', { class: 'group' }, [
        el('div', { class: 'group-head' }, [
          el('h2', { text: group.title }),
          el('p', { text: group.blurb }),
        ]),
        el('div', { class: 'cards' }, cases.map(missionCard)),
      ]),
    );
  }
}

async function resolveMissionUrls() {
  try {
    const { urls } = await api('/api/deck/view-urls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ views: USE_CASES.map((useCase) => useCase.view) }),
    });
    urls.forEach((entry, index) => {
      if (entry?.url) state.viewUrls.set(USE_CASES[index].id, entry.url);
      if (entry?.view) USE_CASES[index].view = entry.view;
    });
  } catch (error) {
    toast(`Could not build mission links: ${error.message}`);
  }
}

/* Globe */

function embedSrc(url) {
  const target = new URL(url, location.origin);
  target.searchParams.set('embed', '1');
  return `${location.origin}${target.pathname}${target.search}${target.hash}`;
}

function postView(view) {
  const { frame } = state.embed;
  if (!frame?.contentWindow) return;
  state.embed.sequence += 1;
  frame.contentWindow.postMessage(
    { type: 'gev:view', id: state.embed.sequence, view },
    location.origin,
  );
}

async function loadView(view, label, knownUrl) {
  state.currentLabel = label || 'View';
  let url = knownUrl || null;
  let resolved = view;
  if (!url || !view.camera) {
    try {
      const { urls } = await api('/api/deck/view-urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ views: [view] }),
      });
      if (urls[0]?.error) throw new Error(urls[0].error);
      url = urls[0]?.url || null;
      resolved = urls[0]?.view || view;
    } catch (error) {
      toast(`This view cannot be shown: ${error.message}`);
      return;
    }
  }
  state.currentView = resolved;
  $('#globe-caption').textContent = `Loaded: ${state.currentLabel}`;
  $('#globe-style').value = resolved.style || 'normal';
  const open = $('#globe-open');
  open.href = url || '/';
  const hint = $('#globe-hint');
  hint.hidden = true;
  const embed = state.embed;
  if (!embed.frame) {
    $('#globe-placeholder').hidden = true;
    const frame = el('iframe', {
      title: "God's Eye View",
      allow: 'fullscreen; microphone; geolocation',
      referrerpolicy: 'same-origin',
      src: embedSrc(url || '/'),
    });
    $('#globe-frame').append(frame);
    embed.frame = frame;
    embed.ready = false;
    embed.pending = null;
    clearTimeout(embed.timer);
    embed.timer = setTimeout(() => {
      if (embed.ready) return;
      hint.hidden = false;
      hint.replaceChildren(
        'The globe has not reported ready. If this server refuses framing, set ',
        el('code', { text: "GEV_EMBED_FRAME_ANCESTORS='self'" }),
        ' or ',
        el('a', {
          href: url || '/',
          target: '_blank',
          rel: 'noopener',
          text: 'open the view in a new tab',
        }),
        '.',
      );
    }, EMBED_READY_TIMEOUT_MS);
    return;
  }
  if (embed.ready) postView(resolved);
  else embed.pending = resolved;
}

window.addEventListener('message', (event) => {
  if (event.origin !== location.origin) return;
  const embed = state.embed;
  if (!embed.frame || event.source !== embed.frame.contentWindow) return;
  const data = event.data || {};
  if (data.type === 'gev:ready') {
    embed.ready = true;
    clearTimeout(embed.timer);
    $('#globe-hint').hidden = true;
    if (embed.pending) {
      postView(embed.pending);
      embed.pending = null;
    } else {
      // The first view travelled in the frame's link; the app restored it.
      $('#globe-caption').textContent = `Showing: ${state.currentLabel}`;
    }
  } else if (data.type === 'gev:view-applied') {
    const steps = Array.isArray(data.steps) ? data.steps : [];
    const failed = steps.filter((step) => step?.ok === false);
    $('#globe-caption').textContent = data.ok
      ? `Showing: ${state.currentLabel}`
      : `Showing: ${state.currentLabel} (${failed.map((s) => s.step || s.name).join(', ') || 'partly'} not applied)`;
  }
});

$('#globe-style').addEventListener('change', (event) => {
  if (!state.currentView) return;
  loadView(
    { ...state.currentView, style: event.target.value },
    state.currentLabel,
  );
});

/* Markdown, small and safe: escape first, then shape. */

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inline(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>',
    );
}

function renderMarkdown(text) {
  const lines = String(text || '').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      const code = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      i += 1;
      out.push(`<pre class="code">${escapeHtml(code.join('\n'))}</pre>`);
      continue;
    }
    if (/^\s*\|/.test(line) && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] || '')) {
      const cells = (row) =>
        row
          .trim()
          .replace(/^\||\|$/g, '')
          .split('|')
          .map((c) => inline(c.trim()));
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i]))
        rows.push(cells(lines[i++]));
      out.push(
        `<table><thead><tr>${head.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows
          .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`)
          .join('')}</tbody></table>`,
      );
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      out.push(`<h3>${inline(heading[2])}</h3>`);
      i += 1;
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i]))
        items.push(lines[i++].replace(/^\s*([-*]|\d+\.)\s+/, ''));
      out.push(
        `<${ordered ? 'ol' : 'ul'}>${items.map((item) => `<li>${inline(item)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`,
      );
      continue;
    }
    if (!line.trim()) {
      i += 1;
      continue;
    }
    const paragraph = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,4}\s|```|\s*([-*]|\d+\.)\s|\s*\|)/.test(lines[i])
    )
      paragraph.push(lines[i++]);
    if (paragraph.length) out.push(`<p>${inline(paragraph.join(' '))}</p>`);
    else i += 1;
  }
  return out.join('');
}

/* Packs */

function packJson(pack, attachments = []) {
  return JSON.stringify(
    { pack, attachments, exportedAt: new Date().toISOString() },
    null,
    2,
  );
}

function renderPack(
  pack,
  { attachments = [], markdown = '', saved = false, onRemove } = {},
) {
  const status = state.status;
  const viewRow = (item, kindLabel) =>
    el('div', { class: 'pack-view' }, [
      el('span', {}, [
        el('strong', { text: item.label }),
        kindLabel
          ? el('span', { class: 'muted', text: ` · ${kindLabel}` })
          : null,
        item.caption || item.description
          ? el('span', {
              class: 'muted',
              text: ` — ${item.caption || item.description}`,
            })
          : null,
        item.error
          ? el('span', { class: 'need', text: ` — ${item.error}` })
          : null,
      ]),
      item.url
        ? el('span', { class: 'actions' }, [
            el('button', {
              type: 'button',
              class: 'button small',
              text: 'Load',
              onclick: () => {
                loadView(item.view, `${pack.title} · ${item.label}`, item.url);
                navigate('globe');
              },
            }),
            el(
              'a',
              {
                class: 'button small ghost',
                href: item.url,
                target: '_blank',
                rel: 'noopener',
              },
              ['Open', icon('i-external')],
            ),
          ])
        : null,
    ]);
  const table = (entry) => {
    const columns = entry.columns?.length
      ? entry.columns
      : entry.rows[0] &&
          typeof entry.rows[0] === 'object' &&
          !Array.isArray(entry.rows[0])
        ? Object.keys(entry.rows[0])
        : [];
    const cell = (value) =>
      value == null
        ? ''
        : typeof value === 'object'
          ? JSON.stringify(value)
          : String(value);
    return el('div', { class: 'pack-section' }, [
      el('h4', {
        text: entry.label + (entry.source ? ` · ${entry.source}` : ''),
      }),
      el('div', { class: 'pack-table' }, [
        el('table', {}, [
          columns.length
            ? el('thead', {}, [
                el(
                  'tr',
                  {},
                  columns.map((c) => el('th', { text: c })),
                ),
              ])
            : null,
          el(
            'tbody',
            {},
            entry.rows.map((row) =>
              el(
                'tr',
                {},
                (Array.isArray(row)
                  ? row
                  : columns.length
                    ? columns.map((c) => row?.[c])
                    : [row]
                ).map((value) => el('td', { text: cell(value) })),
              ),
            ),
          ),
        ]),
      ]),
    ]);
  };
  const actions = [
    el('button', {
      type: 'button',
      class: 'button small',
      text: 'Copy Markdown',
      onclick: () => copyText(markdown || pack.title),
    }),
    el('button', {
      type: 'button',
      class: 'button small ghost',
      text: 'Download JSON',
      onclick: () =>
        download(`${slug(pack.title)}.json`, packJson(pack, attachments)),
    }),
    saved
      ? el('button', {
          type: 'button',
          class: 'button small ghost danger',
          text: 'Remove',
          onclick: onRemove,
        })
      : el('button', {
          type: 'button',
          class: 'button small ghost',
          text: 'Save to Publish',
          onclick: () => {
            state.packs.unshift({
              pack,
              attachments: attachments.slice(0, 2),
              markdown,
              savedAt: new Date().toISOString(),
            });
            state.packs = state.packs.slice(0, 50);
            store.write(STORAGE.packs, state.packs);
            renderShelf();
            toast('Saved to Publish');
          },
        }),
  ];
  if (status?.handoff?.configured)
    actions.push(
      el('button', {
        type: 'button',
        class: 'button small primary',
        text: `Send to ${status.handoff.label}`,
        onclick: async (event) => {
          const button = event.currentTarget;
          button.disabled = true;
          try {
            const result = await api('/api/deck/handoff', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                pack,
                attachments,
                note: `Sent from the Deck: ${pack.title}`,
              }),
            });
            toast(
              result.ok
                ? `Sent to ${result.label}`
                : `${result.label} answered ${result.status}`,
            );
          } catch (error) {
            toast(error.message);
          } finally {
            button.disabled = false;
          }
        },
      }),
    );
  return el('article', { class: 'pack' }, [
    el('div', { class: 'pack-head' }, [
      el('div', {}, [
        el('div', { class: 'pack-kicker', text: 'Publishing pack' }),
        el('h3', { text: pack.title }),
      ]),
      pack.tags?.length
        ? el(
            'div',
            { class: 'chip-row' },
            pack.tags.map((tag) =>
              el('span', { class: 'chip static', text: tag }),
            ),
          )
        : null,
    ]),
    pack.summary
      ? el('p', { class: 'pack-summary', text: pack.summary })
      : null,
    pack.narrative
      ? el('div', { class: 'pack-section' }, [
          el('h4', { text: 'Narrative' }),
          el('p', { class: 'pack-narrative', text: pack.narrative }),
        ])
      : null,
    pack.views?.length
      ? el('div', { class: 'pack-section' }, [
          el('h4', { text: 'Views' }),
          el(
            'div',
            { class: 'pack-views' },
            pack.views.map((v) => viewRow(v)),
          ),
        ])
      : null,
    ...(pack.data || []).map(table),
    pack.visuals?.length
      ? el('div', { class: 'pack-section' }, [
          el('h4', { text: 'Visuals to capture' }),
          el(
            'div',
            { class: 'pack-views' },
            pack.visuals.map((v) => viewRow(v, v.kind)),
          ),
        ])
      : null,
    attachments.length
      ? el('div', { class: 'pack-section' }, [
          el('h4', { text: 'Images from the feeds' }),
          el(
            'div',
            { class: 'pack-attachments' },
            attachments.map((image, index) =>
              el(
                'a',
                {
                  href: `data:${image.mimeType};base64,${image.data}`,
                  download: `${slug(pack.title)}-${index + 1}.${image.mimeType.split('/')[1] || 'img'}`,
                },
                [
                  el('img', {
                    src: `data:${image.mimeType};base64,${image.data}`,
                    alt: `${image.tool} image ${index + 1}`,
                    loading: 'lazy',
                  }),
                ],
              ),
            ),
          ),
        ])
      : null,
    el('div', { class: 'pack-actions' }, actions),
  ]);
}

function slug(text) {
  return (
    String(text)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'pack'
  );
}

function renderShelf() {
  const shelf = $('#pack-shelf');
  shelf.replaceChildren();
  if (!state.packs.length) {
    shelf.append(
      el('div', {
        class: 'empty',
        text: 'No packs saved yet. Ask the analyst for one and press Save to Publish.',
      }),
    );
    return;
  }
  shelf.append(
    el(
      'div',
      { class: 'shelf' },
      state.packs.map((entry, index) =>
        renderPack(entry.pack, {
          attachments: entry.attachments || [],
          markdown: entry.markdown,
          saved: true,
          onRemove: () => {
            state.packs.splice(index, 1);
            store.write(STORAGE.packs, state.packs);
            renderShelf();
          },
        }),
      ),
    ),
  );
}

$('#packs-export').addEventListener('click', () => {
  download('gev-deck-packs.json', JSON.stringify(state.packs, null, 2));
});
$('#packs-clear').addEventListener('click', () => {
  if (!state.packs.length || !confirm('Remove every saved pack?')) return;
  state.packs = [];
  store.write(STORAGE.packs, state.packs);
  renderShelf();
});

/* Analyst */

function saveHistory() {
  let serialized = JSON.stringify(state.history);
  if (serialized.length > MAX_STORED_CHAT_CHARS) {
    // Drop image data first, then the oldest turns, so the log stays storable.
    for (const turn of state.history)
      if (turn.result?.attachments) turn.result.attachments = [];
    serialized = JSON.stringify(state.history);
    while (
      serialized.length > MAX_STORED_CHAT_CHARS &&
      state.history.length > 2
    ) {
      state.history.splice(0, 2);
      serialized = JSON.stringify(state.history);
    }
  }
  store.write(STORAGE.chat, state.history);
}

function renderMessage(turn) {
  if (turn.role === 'user')
    return el('div', { class: 'msg user' }, [
      el('div', { class: 'bubble', text: turn.content }),
    ]);
  if (turn.error)
    return el('div', { class: 'msg error' }, [
      el('div', { class: 'bubble', text: turn.content }),
    ]);
  const result = turn.result || {};
  const children = [
    el('div', { class: 'bubble', html: renderMarkdown(turn.content) }),
  ];
  const meta = [];
  if (result.model) meta.push(el('span', { text: result.model }));
  if (result.usage)
    meta.push(
      el('span', {
        text: `${result.usage.input_tokens} in · ${result.usage.output_tokens} out`,
      }),
    );
  if (result.stopReason && result.stopReason !== 'end_turn')
    meta.push(el('span', { text: result.stopReason }));
  if (meta.length) children.push(el('div', { class: 'msg-meta' }, meta));
  if (result.trace?.length) {
    children.push(
      el('details', { class: 'trace' }, [
        el('summary', {
          text: `${result.trace.length} tool call${result.trace.length === 1 ? '' : 's'}`,
        }),
        el(
          'ul',
          {},
          result.trace.map((entry) =>
            el('li', {}, [
              el('span', {
                class: 'mono',
                text: `${entry.tool}(${JSON.stringify(entry.args)})`,
              }),
              ' ',
              entry.ok
                ? entry.summary
                : el('span', { class: 'need', text: entry.error }),
              el('span', { class: 'mono', text: ` ${entry.ms} ms` }),
            ]),
          ),
        ),
      ]),
    );
  }
  for (const [index, pack] of (result.packs || []).entries())
    children.push(
      renderPack(pack, {
        attachments: result.attachments || [],
        markdown: result.markdown?.[index] || '',
      }),
    );
  if (result.packErrors?.length)
    children.push(
      el('p', {
        class: 'hint',
        text: `A pack could not be read: ${result.packErrors.join('; ')}`,
      }),
    );
  return el('div', { class: 'msg' }, children);
}

function renderChat() {
  const log = $('#chat-log');
  log.replaceChildren(...state.history.map(renderMessage));
  if (!state.history.length)
    log.append(
      el('div', { class: 'empty' }, [
        state.status?.chat?.configured
          ? 'Ask about anywhere on Earth. The analyst reads the live feeds, then answers with the data and a view to open.'
          : el('span', {}, [
              'The analyst is off: set ',
              el('code', { text: 'ANTHROPIC_API_KEY' }),
              ' on the server to turn it on.',
            ]),
      ]),
    );
  if (state.busy)
    log.append(el('div', { class: 'typing', text: 'Reading the feeds' }));
  log.lastElementChild?.scrollIntoView({ block: 'end', behavior: 'smooth' });
}

async function sendMessage(text) {
  const content = text.trim();
  if (!content || state.busy) return;
  state.history.push({ role: 'user', content });
  state.busy = true;
  $('#composer-send').disabled = true;
  $('#chat-hint').hidden = true;
  renderChat();
  const messages = state.history
    .filter((turn) => !turn.error)
    .map((turn) => ({ role: turn.role, content: turn.content }))
    .slice(-40);
  try {
    const result = await api('/api/deck/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    });
    state.history.push({ role: 'assistant', content: result.reply, result });
  } catch (error) {
    state.history.push({
      role: 'assistant',
      content: error.message,
      error: true,
    });
    const hint = $('#chat-hint');
    hint.hidden = false;
    hint.textContent =
      error.status === 503
        ? 'The server has no ANTHROPIC_API_KEY. Add it to the environment the server starts with and restart.'
        : error.status === 429
          ? 'Too many requests for this minute; try again shortly.'
          : error.status === 403
            ? 'The server refused this origin. Open the Deck from the same address the globe is served on.'
            : 'The analyst could not answer. The server log has the reason.';
  } finally {
    state.busy = false;
    $('#composer-send').disabled = false;
    saveHistory();
    renderChat();
  }
}

function askAnalyst(prompt) {
  navigate('analyst');
  const input = $('#composer-input');
  input.value = prompt;
  input.focus();
  sendMessage(prompt);
  input.value = '';
}

$('#composer').addEventListener('submit', (event) => {
  event.preventDefault();
  const input = $('#composer-input');
  const text = input.value;
  input.value = '';
  sendMessage(text);
});
$('#composer-input').addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    $('#composer').requestSubmit();
  }
});
$('#chat-clear').addEventListener('click', () => {
  state.history = [];
  saveHistory();
  renderChat();
});

function renderQuickPrompts() {
  $('#quick-prompts').replaceChildren(
    ...QUICK_PROMPTS.map((prompt) =>
      el('button', {
        type: 'button',
        text: prompt,
        onclick: () => askAnalyst(prompt),
      }),
    ),
  );
}

/* Capabilities and setup */

function renderCapabilities() {
  const list = $('#tool-list');
  list.replaceChildren(
    ...state.tools.map((tool) =>
      el('div', { class: 'tool' }, [
        el('div', { class: 'name', text: tool.name }),
        el('div', { class: 'title', text: tool.title }),
        el('div', { class: 'desc', text: tool.description }),
      ]),
    ),
  );
  if (!state.tools.length)
    list.append(
      el('div', {
        class: 'empty',
        text: 'The tool list could not be read from the server.',
      }),
    );
  $('#voice-actions').replaceChildren(
    ...VOICE_ACTIONS.map((name) =>
      el('span', { class: 'chip static', text: name }),
    ),
  );
  $('#shortcuts').replaceChildren(
    ...SHORTCUTS.map(([keys, what]) =>
      el('div', { class: 'shortcut' }, [
        el('kbd', { text: keys }),
        el('span', { text: what }),
      ]),
    ),
  );
  const app = state.status?.appUrl || location.origin + '/';
  $('#mcp-snippet').textContent = [
    '# Local, over HTTP (the server accepts only requests from this machine):',
    `claude mcp add --transport http gods-eye-view ${app.replace(/\/$/, '')}/mcp`,
    '',
    '# Any machine, over stdio, reading this server:',
    `claude mcp add gods-eye-view -- node /abs/path/gods-eye-view/server/mcp/stdio.js --api-base ${app.replace(/\/$/, '')}`,
    '',
    '# Then ask: "Show San Diego in God\'s Eye View with military flights on."',
  ].join('\n');
}

function renderSetup() {
  const status = state.status;
  const grid = $('#setup-status');
  grid.replaceChildren();
  const stat = (label, value, ok) =>
    el('div', { class: 'stat' }, [
      el('div', { class: 'label', text: label }),
      el('div', { class: 'value' }, [
        ok == null
          ? null
          : el('span', { class: `chip static ${ok ? 'ok' : 'warn'}` }, [
              el('span', { class: 'dot' }),
            ]),
        value,
      ]),
    ]);
  if (!status) {
    grid.append(stat('Server', 'Unreachable', false));
    return;
  }
  grid.append(
    stat('Globe', status.appUrl || location.origin, true),
    stat(
      'Analyst',
      status.chat.configured
        ? `${status.chat.model} · effort ${status.chat.effort}`
        : 'Off (ANTHROPIC_API_KEY)',
      status.chat.configured,
    ),
    stat(
      'Hand-off',
      status.handoff.configured
        ? status.handoff.label
        : 'Not configured (GEV_DECK_HANDOFF_WEBHOOK_URL)',
      status.handoff.configured,
    ),
    stat(
      'Embedded globe',
      status.embed.frameAncestors
        ? `frame-ancestors ${status.embed.frameAncestors}`
        : 'Framing off',
      Boolean(status.embed.frameAncestors),
    ),
    stat('Version', status.version || 'unknown', null),
  );
  $('#provider-list').replaceChildren(
    ...status.providers.map((provider) =>
      el('div', { class: `provider ${provider.configured ? 'ok' : ''}` }, [
        el('span', { class: 'dot' }),
        el('span', {}, [
          el('strong', { text: provider.label }),
          el('div', { class: 'enables', text: provider.enables }),
        ]),
        el('span', { class: 'env', text: provider.name }),
      ]),
    ),
  );
}

/* Install */

let installPrompt = null;
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event;
  $('#install-button').hidden = false;
});
$('#install-button').addEventListener('click', async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice.catch(() => {});
  installPrompt = null;
  $('#install-button').hidden = true;
});
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/deck/sw.js', { scope: '/deck/' })
    .catch(() => {});
}

/* Boot */

async function boot() {
  window.addEventListener('hashchange', () => showPane(currentPane()));
  showPane(currentPane());
  renderMissionFilters();
  renderMissions();
  renderQuickPrompts();
  renderChat();
  renderShelf();
  try {
    state.status = await api('/api/deck/status');
  } catch {
    state.status = null;
  }
  renderStatus();
  renderSetup();
  renderChat();
  await resolveMissionUrls();
  renderMissions();
  try {
    state.tools = (await api('/api/deck/tools')).tools || [];
  } catch {
    state.tools = [];
  }
  renderCapabilities();
}

boot();
