# lovelog-server

Anonim cihaz ID + rate-limit ile çalışan ince Gemini proxy'si. Frontend ham WhatsApp verisini görmez — sadece LlmCompactSummary'den türetilen prompt buraya gelir.

## Endpoints

Tümü `Content-Type: application/json` ve `X-Device-Id: <client-side-uuid>` gerektirir.

- `GET /health` → `{ ok: true }`
- `POST /api/llm/generate` — `{ model?, prompt, config? }` → `{ text, candidates }`
- `POST /api/llm/stream` — aynı body, SSE: `chunk` (`{text}`), `done`, `error`.

Rate limit: cihaz başına saatte 60 istek (her endpoint için ayrı sayar).

## Dev

```bash
cd server
cp .env.example .env  # GEMINI_API_KEY doldur
npm install
npm run dev
```

## Prod (Lightsail)

`docker compose -f ../docker-compose.lightsail.yml up -d --build api`
