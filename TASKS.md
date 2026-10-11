# TASKS — gods-eye-view (rtmendes fork)

> This file is the project's durable memory. It survives context compression:
> any new Claude session reads it FIRST and orients from it. Keep it short and
> current — it is the source of truth, not the chat history.

## Goal
A God's Eye View that works on any browser or device: the Deck dashboard
(`/deck`) with every mission, the globe framed inside it, an analyst chat tied
to the enterprise (Elite Writer, Chief of Staff) that turns live data into
publishing packs, and a hosted deployment path behind a login.

## Current status
- **State:** Deck built and verified locally (unit tests, boundaries, live
  chat round, headless render); PR open from branch `ccr-f3693fc0-72yaip`.
- **Next step:** Merge the PR, then deploy with `docs/DEPLOY-VPS.md`
  (Docker + Caddy) on the VPS so phones and other devices can reach it; set
  `GEV_DECK_HANDOFF_WEBHOOK_URL` to the Elite Writer / Chief of Staff intake.
- **Blocked on:** nothing in the repo. Deployment needs a VPS and a domain
  (the vault holds `VPS_SSH_HOST`, `VPS_SSH_USER`, `VPS_SSH_KEY` by name).
- **Last updated:** 2026-10-11 by Claude (session 01UGfk3AJ7mZKyEwtUeXJrvt)

## To-do
<!-- [x] done  ·  [ ] pending  ·  [~] in progress.  Order = priority. -->
- [ ] Deploy to the VPS (docs/DEPLOY-VPS.md); restrict Cesium/Google keys to the domain
- [ ] Point `GEV_DECK_HANDOFF_WEBHOOK_URL` at the Elite Writer intake and confirm a pack lands
- [ ] Write the real enterprise brief into `config/deck.brief.md`
- [ ] Optional: mission cards with capture thumbnails; streaming chat replies
- [x] Deck page: missions, framed globe, analyst, capabilities, publish, setup (PWA)
- [x] `/api/deck/*` routes: status, tools, view-urls, chat (Claude + tool catalog), handoff
- [x] Portable `src/deck` core with 18 unit tests; plugin-order test updated
- [x] Docs: docs/DECK.md, docs/DEPLOY-VPS.md, README section, SECURITY note, .env.example

## Notes / decisions
- Chat uses the Claude Messages API over raw fetch (no SDK), matching how the
  repo calls OpenAI; model default `claude-opus-5-5`, effort `medium`,
  server-side refusal fallbacks on. Env names: ANTHROPIC_API_KEY,
  GEV_DECK_MODEL, GEV_DECK_EFFORT, GEV_DECK_BRIEF(_FILE), GEV_DECK_PUBLIC_URL,
  GEV_DECK_HANDOFF_WEBHOOK_URL/_TOKEN/_LABEL, GEV_RATELIMIT_DECK_PER_MIN.
- The standalone server defaults `GEV_EMBED_FRAME_ANCESTORS` to `'self'` so
  the Deck can frame the globe; SECURITY.md updated accordingly.
- Hosted: `vite preview` behind Caddy; Caddy must strip `X-Forwarded-*`
  headers or the same-site gate 403s the cost-bearing routes. `/mcp` stays
  loopback-only by design; remote agents use stdio with `--api-base`.
- Vercel is not a fit: the app's `/api` proxies are Vite middleware, not
  serverless functions.
- Secrets live in Infisical project `75ce45d4-9209-45b0-a24d-a2078132f2f8`
  (env `prod`); ANTHROPIC_API_KEY, CESIUM_ION_TOKEN, GOOGLE_MAPS_API_KEY,
  OPENAI_API_KEY, TOMTOM_API_KEY exist there by name.
