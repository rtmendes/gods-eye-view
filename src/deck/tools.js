/**
 * The Deck's view of the tool catalog and its adapter to the Claude Messages
 * API: the tools the chat may call, their function-calling records, and how a
 * tool result is handed back to the model. Portable: no Node, browser or
 * rendering code.
 */

import { catalogForSurface } from '../tools/surfaces.js';

/**
 * The Deck chat starts from the MCP surface and adds the tools that surface
 * leaves out because assistants already cover them: a chat next to the globe
 * is better with place search, routes, weather and a regional brief. The
 * panel's loader is for the MCP Apps panel only.
 */
export const DECK_SURFACE_OVERRIDES = Object.freeze({
  search_places: { mcp: true },
  places_nearby: { mcp: true },
  plan_route: { mcp: true },
  get_weather: { mcp: true },
  get_wind: { mcp: true },
  get_regional_brief: { mcp: true },
  find_radio_stations: { mcp: true },
  get_bike_share: { mcp: true },
  get_transit_vehicles: { mcp: true },
  panel_request: { mcp: false },
});

/** Most characters of a tool's data the model is handed. */
export const DEFAULT_RESULT_CHARS = 24_000;

/** The catalog view the Deck chat lists and calls. */
export function deckCatalog(catalog) {
  const present = new Set(catalog.list().map((tool) => tool.name));
  const overrides = Object.fromEntries(
    Object.entries(DECK_SURFACE_OVERRIDES).filter(([name]) =>
      present.has(name),
    ),
  );
  return catalogForSurface(catalog, 'mcp', overrides);
}

/** Tools as Claude Messages API tool records. */
export function toAnthropicTools(tools) {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: structuredClone(tool.inputSchema),
  }));
}

/** What the dashboard lists for people: name, title, description, kind. */
export function describeTools(tools) {
  return tools.map((tool) => ({
    name: tool.name,
    title: tool.title,
    description: tool.description,
    kind: tool.kind,
    requires: [...tool.requires],
  }));
}

/**
 * A tool's data as JSON within a character budget. A list result keeps the
 * rows that fit and says how many were cut; anything else is cut at the
 * budget with a marker, so the model never sees a silently clipped object as
 * complete.
 */
export function boundedToolData(data, maxChars = DEFAULT_RESULT_CHARS) {
  let text = JSON.stringify(data);
  if (text.length <= maxChars) return { text, truncated: false };
  if (Array.isArray(data?.rows) && data.rows.length > 1) {
    let rows = data.rows;
    while (rows.length > 1) {
      rows = rows.slice(0, Math.max(1, Math.floor(rows.length / 2)));
      text = JSON.stringify({
        ...data,
        rows,
        returned: rows.length,
        truncated: true,
        rows_cut_for_model: data.rows.length - rows.length,
      });
      if (text.length <= maxChars) return { text, truncated: true };
    }
  }
  return {
    text: `${text.slice(0, maxChars)}… [cut at ${maxChars} characters]`,
    truncated: true,
  };
}

/**
 * A tool result as the content of a `tool_result` block: the summary and the
 * bounded data as text, then each image the tool returned.
 */
export function toolResultContent(result, { maxChars } = {}) {
  const { text, truncated } = boundedToolData(result.data, maxChars);
  const content = [
    {
      type: 'text',
      text: `${result.summary}\n${text}${truncated ? '\n(data shortened for the model)' : ''}`,
    },
  ];
  for (const image of result.images ?? []) {
    if (typeof image?.data !== 'string' || !image.mimeType) continue;
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: image.mimeType,
        data: image.data,
      },
    });
  }
  return content;
}
