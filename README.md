# E-commerce Product Images

An AI-powered web app that turns a product photo + a few highlight bullets into a full set of
e-commerce detail-page images (hero, feature panels, lifestyle, spec card…), ready to download
as a zip.

> **Status:** Phase 0 — scaffold only. No working features yet.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 |
| Auth | NextAuth (email/password, Prisma adapter) |
| Database | PostgreSQL + Prisma |
| Queue | BullMQ + Redis (image generation is async) |
| Image model | `gpt-image-2` via [BananaRouter](https://bananarouter.com) (OpenAI SDK compatible) |
| Object storage | Aliyun OSS |
| Payments (Phase 5) | WeChat Pay + Alipay |
| Deployment | Docker Compose on a self-managed Linux VPS, Nginx in front |

## Development setup

Prerequisites: Node ≥ 20, pnpm ≥ 10, Docker.

```bash
# 1. Install dependencies
pnpm install

# 2. Start Postgres + Redis
docker compose up -d

# 3. Configure environment
cp .env.example .env.local
# then fill in AUTH_SECRET, BANANAROUTER_API_KEY, ALIYUN_OSS_* etc.
# Generate AUTH_SECRET with: openssl rand -base64 32

# 4. Apply database schema
pnpm prisma migrate dev

# 5. Run dev server
pnpm dev
```

Open <http://localhost:3000>.

## Project layout

```
prisma/
  schema.prisma           # User, Credit, Order, Job, Image
src/
  app/                    # Next.js routes
  lib/
    env.ts                # Zod-validated env loader
    prisma.ts             # Prisma client singleton
    oss.ts                # Aliyun OSS client + helpers
    imageClient.ts        # BananaRouter image API wrapper
docker-compose.yml        # Postgres + Redis for dev
```

## Security notes

- `.env*` is gitignored. **Never commit real keys.**
- The Aliyun key used here MUST be a RAM user scoped to a single OSS bucket — not a root key.
- Rotate the BananaRouter API key if it has ever appeared in chat logs, Slack, screenshots, etc.

## Roadmap

| Phase | Scope |
|---|---|
| 0 ✅ | Scaffold (Next.js, Prisma schema, Docker, OSS/image clients) |
| 1 | Auth & user dashboard (NextAuth email/password, credit balance, history) |
| 2 | Upload & form (product photos + highlights) |
| 3 | Generation core (BullMQ workers, prompt plan, OSS storage) |
| 4 | Result page & zip download |
| 5 | Payments (WeChat + Alipay) |
| 6 | VPS deploy (Docker Compose + Nginx + Let's Encrypt) |
