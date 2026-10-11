# The Deck

The Deck is the dashboard around God's Eye View: a page that works in any
browser and installs on a phone, with every mission the globe supports, the
globe itself framed inside it, an analyst chat that reads the live feeds, and
publishing packs that hand what it finds to a writing tool or an agent.

Open it at **`/deck`** on any running server (`npm run dev`, `npm run preview`,
Pinokio, or a hosted instance). Nothing else to build: the page is static
(`public/deck/`) and talks to the server's `/api/deck/*` routes.

## What is on it

| Section          | What it does                                                                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Missions**     | Thirty use cases grouped as the app groups its layers (Movement, Cameras, Events, Space, Weather, Infrastructure, Analysis, Cinema). Each loads a view in the framed globe, opens it in a new tab, or asks the analyst its question. A card says which key it needs when the server lacks one. |
| **Globe**        | The app in embed mode, framed from the same origin. Later views arrive by `postMessage` without a reload; the style switch re-renders in place; **Open this view** is the share link. |
| **Analyst**      | A chat over the Claude Messages API with the globe's tool catalog. Answers come with the tools it called, token usage, images the feeds returned, and packs. History stays in the browser. |
| **Capabilities** | The tool list read live from this server, the voice actions, keyboard shortcuts, and the MCP commands that connect Claude Code, Claude Desktop or a Chief of Staff agent. |
| **Publish**      | Packs saved from the analyst: copy as Markdown, download as JSON, export all, or send to the configured hand-off. |
| **Setup**        | What the server has configured, by key **name** only, and what each key switches on. |

## Publishing packs

Ask for anything to publish ("give me a pack", "what should I write about",
"visuals and data for an Elite Writer piece on…") and the analyst ends its
answer with a pack:

```json
{
  "title": "Headline",
  "summary": "Opening lines.",
  "narrative": "The angle, with the facts the tools returned.",
  "tags": ["…"],
  "views": [{ "label": "…", "caption": "…", "view": { "camera": {}, "layers": [], "style": "…" } }],
  "data": [{ "label": "…", "source": "…", "columns": [], "rows": [] }],
  "visuals": [{ "label": "…", "kind": "globe-capture", "description": "…", "view": {} }]
}
```

The server checks the shape, bounds every field, and resolves each view to
a share link (`src/deck/packs.js`). The chat response carries the pack, its
Markdown rendering, and the images the tools returned as base64
`attachments`. In the page: **Load** shows a view in the framed globe,
**Open** opens it full screen for a capture, **Copy Markdown** is the
hand-off for a writer, **Download JSON** the hand-off for a program.

## Hand-off to Elite Writer or the Chief of Staff

Set `GEV_DECK_HANDOFF_WEBHOOK_URL` and the **Send to …** button appears on
every pack. The server (never the browser) POSTs JSON to that address, with
`Authorization: Bearer $GEV_DECK_HANDOFF_TOKEN` when the token is set:

```json
{
  "source": "gods-eye-view-deck",
  "version": "0.2.1",
  "sentAt": "2026-10-11T23:00:00.000Z",
  "app": "https://globe.example.com/",
  "note": "Sent from the Deck: Headline",
  "pack": { "...": "the pack, views resolved to links" },
  "attachments": [{ "tool": "get_weather_map", "mimeType": "image/png", "data": "<base64>" }]
}
```

`GEV_DECK_HANDOFF_LABEL` names the button (default "Elite Writer"). Point
the webhook at whatever ingests for you: an Elite Writer endpoint, an n8n,
Make or Activepieces flow, or the Chief of Staff's inbox. The receiver's
answer is not relayed to the browser; only its status is.

Agents that should query the globe themselves use the MCP server instead:
[MCP setup](MCP_SETUP.md). The Deck chat and MCP share one tool catalog
(`src/tools/`), so what an agent can ask, the Deck can ask.

## The analyst

| Variable               | Default            | Meaning                                                                                                   |
| ---------------------- | ------------------ | --------------------------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`    | unset              | Required. Without it the chat is off and the page says so.                                                |
| `GEV_DECK_MODEL`       | `claude-opus-5-5`  | Any current Claude model ID.                                                                              |
| `GEV_DECK_EFFORT`      | `medium`           | `low`, `medium`, `high`, `xhigh` or `max`.                                                                |
| `GEV_DECK_FALLBACKS`   | on                 | Server-side refusal fallbacks (`fallbacks: "default"`); set `0` to send without them.                     |
| `GEV_DECK_BRIEF`       | unset              | The enterprise brief, inline. Wins over the file.                                                         |
| `GEV_DECK_BRIEF_FILE`  | `config/deck.brief.md` | The enterprise brief, as a file. Edit it to tell the analyst about your apps, audiences and house style. |
| `GEV_DECK_PUBLIC_URL`  | request Host       | The address links are built on, for a server behind a proxy.                                              |
| `GEV_RATELIMIT_DECK_PER_MIN` | `20`         | Per-IP cap on chat and hand-off requests; `0` disables.                                                   |
| `ANTHROPIC_BASE_URL`   | `https://api.anthropic.com` | Honoured when set, for a gateway.                                                                 |

Each turn: the conversation goes to `/v1/messages` with the system prompt
(`src/deck/prompt.js`: role, how to read the feeds, the brief, the pack
format) and the tool catalog; tool calls run through the catalog, in
parallel, up to eight rounds; the answer is split into prose and packs. The
system prompt is marked for prompt caching; thinking runs at the model's
adaptive default; refusals return a plain sentence with the category.

The tools the chat offers are the MCP surface plus place search, routing,
weather, wind, radio, bike share, transit and the regional brief
(`DECK_SURFACE_OVERRIDES` in `src/deck/tools.js`), minus the panel loader.

## Security

- `/api/deck/chat` and `/api/deck/handoff` spend money or reach out, so they
  take the same same-site gate as the other cost-bearing routes
  (`sameSiteGated`): cross-site browser requests, opaque origins and requests
  carrying reverse-proxy headers are refused with 403. Behind your own proxy,
  strip those headers: see [DEPLOY-VPS.md](DEPLOY-VPS.md).
- Both routes are throttled per IP (`GEV_RATELIMIT_DECK_PER_MIN`).
- The hand-off posts only to the configured URL, with redirects refused and
  a 15-second timeout. The browser cannot name a destination.
- `/api/deck/status` reports key names and booleans, never values.
- The globe is framed from the app's own origin only: the standalone server
  defaults `GEV_EMBED_FRAME_ANCESTORS` to `'self'`. Naming other framers is
  still an explicit opt-in. Same-origin framing adds no reach a page of the
  app does not already have.
- The page is static and runs under the server's Content-Security-Policy:
  no inline script, scripts and styles from the app's own origin and Google
  Fonts only.

## Files

| Path                          | Owns                                                                   |
| ----------------------------- | ---------------------------------------------------------------------- |
| `public/deck/`                | The page, styles, app script, mission catalog, manifest, service worker, icons |
| `src/deck/`                   | Portable core: tool adapter, pack parsing, prompt, status, chat loop; tests beside each |
| `server/providers/deck.js`    | The `/deck` shortcut and `/api/deck/*` routes (Vite plugin, dev and preview) |
| `config/deck.brief.md`        | The enterprise brief the analyst reads                                 |

The service worker caches only the Deck's own files, network first, so an
update lands on the next load. The globe, its data and `/api` are never
cached by it.

## Running it

```sh
npm ci
npm run dev            # http://localhost:4173/deck
```

With secrets in a vault, start the server inside the loader so the names
above are in its environment, for example `infisical run -- npm run dev`.
For a server other people and devices reach, follow
[DEPLOY-VPS.md](DEPLOY-VPS.md).
