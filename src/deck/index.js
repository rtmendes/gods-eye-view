/** The Deck: the dashboard's chat, packs and status, independent of the server. */

export {
  DECK_SURFACE_OVERRIDES,
  DEFAULT_RESULT_CHARS,
  boundedToolData,
  deckCatalog,
  describeTools,
  toAnthropicTools,
  toolResultContent,
} from './tools.js';
export {
  PACK_FENCE,
  VISUAL_KINDS,
  extractPacks,
  normalizePack,
  packToMarkdown,
  resolvePack,
} from './packs.js';
export {
  DEFAULT_BRIEF,
  composeSystemPrompt,
  packFormatInstructions,
} from './prompt.js';
export {
  DECK_EFFORTS,
  DECK_EFFORT_DEFAULT,
  DECK_HANDOFF_LABEL_DEFAULT,
  DECK_MODEL_DEFAULT,
  PROVIDERS,
  deckStatus,
  fallbacksEnabled,
  handoffConfig,
  isConfiguredValue,
  providerStatus,
  resolveEffort,
  resolveModel,
} from './status.js';
export {
  ANTHROPIC_API_BASE,
  DeckChatError,
  MAX_HISTORY_MESSAGES,
  MAX_MESSAGE_CHARS,
  runDeckChat,
  validateHistory,
} from './chat.js';
