# Deploying to a VPS

God's Eye View is a local-first key broker (see [SECURITY.md](../SECURITY.md)).
Putting it on the internet means every server-side key is spendable by whoever
can reach it, so a hosted instance needs three things in front of it:
**TLS**, **authentication**, and **provider-side spend limits**. This guide
uses Docker and Caddy for the first two; the third lives at each provider.

The result: the globe at `https://globe.example.com/`, the Deck at
`https://globe.example.com/deck`, on every browser and device, behind a
login.

## 1. Files in this repository

| File                    | Purpose                                                                 |
| ----------------------- | ----------------------------------------------------------------------- |
| `Dockerfile`            | Builds the app on Node 24 and serves the production bundle with `vite preview` |
| `docker-compose.yml`    | The app plus Caddy, reading secrets from `.env.production` or a vault   |
| `deploy/Caddyfile`      | TLS, basic auth, and the header hygiene the same-site gate needs        |

## 2. Secrets

Never commit values. Put the names the server reads into the environment
Docker starts it with. Two ways:

- **A vault (recommended).** With Infisical, render the environment at deploy
  time: `infisical export --format=dotenv > .env.production` (the file is
  git-ignored), or run the container through `infisical run -- docker compose up -d`.
- **A file.** Copy `.env.example` to `.env.production` and fill it.

The names the Deck and the hosted server need, beyond the globe's own keys:

```
HOST=0.0.0.0
PORT=4173
GEV_ALLOWED_HOSTS=globe.example.com
GEV_DECK_PUBLIC_URL=https://globe.example.com/
ANTHROPIC_API_KEY=            # the analyst
GEV_DECK_HANDOFF_WEBHOOK_URL= # optional: Elite Writer / Chief of Staff
GEV_DECK_HANDOFF_TOKEN=       # optional bearer for that webhook
CESIUM_ION_TOKEN=             # optional: 3D cities and terrain (restrict it to your domain at Cesium)
GOOGLE_MAPS_API_KEY=          # optional: restrict it to your domain at Google
```

`GEV_ALLOWED_HOSTS` must name the public hostname: the server refuses any
other `Host`, which is what blunts DNS rebinding. Browser-exposed keys
(Cesium ion, Google Maps) must be restricted to the domain at the provider.

## 3. Caddy

`deploy/Caddyfile`:

```caddyfile
globe.example.com {
	encode zstd gzip

	# One login for the whole site. Make the hash with: caddy hash-password
	basic_auth {
		operator {env.GEV_BASIC_AUTH_HASH}
	}

	reverse_proxy app:4173 {
		# The app's cost-bearing routes (voice token, HUD summary, Google
		# places, the Deck chat and hand-off) refuse requests that carry
		# reverse-proxy headers, because they cannot tell a proxied request
		# from a forged one. Caddy sets these by default; remove them.
		header_up -X-Forwarded-For
		header_up -X-Forwarded-Proto
		header_up -X-Forwarded-Host
		header_up -Forwarded
		header_up -Via
		header_up -X-Real-IP
	}
}
```

Set `GEV_BASIC_AUTH_HASH` in Caddy's environment (the compose file passes
it through). Caddy fetches and renews the certificate itself.

Basic auth is the smallest login that works on every device, including a
phone's home-screen app. If the enterprise already has an identity proxy
(Authelia, Cloudflare Access, Tailscale with Funnel off), put the app behind
that instead and keep the `header_up` lines.

## 4. Start

```sh
git clone https://github.com/rtmendes/gods-eye-view.git
cd gods-eye-view
cp .env.example .env.production   # or render it from the vault
# edit .env.production; export GEV_BASIC_AUTH_HASH="$(docker run --rm caddy:2 caddy hash-password --plaintext 'your password')"
docker compose up -d --build
```

Point the domain's A/AAAA record at the server first, so Caddy can get its
certificate. Then open `https://globe.example.com/deck` on any device; the
Deck offers **Install app** where the browser supports it (Add to Home
Screen on iOS).

## 5. What the production server serves

`vite preview` serves the built bundle with the same plugins as development:
the provider proxies, Provider Settings (loopback only, so unused here), the
MCP route (local requests only, so unused here), the Deck routes and the
embed framing policy. The same-site gate on cost-bearing routes still
applies, which is why Caddy strips the forwarding headers.

What does not work hosted, by design:

- **Provider Settings** (`POWER UP`): keys come from the environment.
- **`/mcp` over the network**: it accepts only loopback requests. Agents on
  other machines use the stdio server with `--api-base https://globe.example.com`
  through the login (set the credentials in the URL or an identity proxy),
  or the Deck's hand-off webhook.
- **Pinokio sharing**: refused by the launcher; this guide replaces it.

## 6. Spend limits

Set them where the money is: Anthropic usage limits for the analyst, OpenAI
limits for voice, Google Cloud budgets and per-API quotas, and the
equivalents for AISStream, TomTom and FIRMS. The app's per-IP throttles
(`GEV_RATELIMIT_*`) are a guard, not a cap.

## Updating

```sh
git pull
docker compose up -d --build
```
