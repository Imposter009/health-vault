# Health Vault — Production Deployment Guide

This is the step-by-step path to run the **entire stack in Docker** on a single server: Postgres, Redis, MinIO, Kafka, the Core API backend, the Gateway, the Angular frontend, and a reverse proxy that gives you automatic HTTPS. Everything is one `docker compose` command once the prerequisites are in place.

If you'd rather swap individual pieces for managed cloud services (AWS RDS instead of the Postgres container, ElastiCache instead of the Redis container, S3 instead of MinIO, MSK/Confluent instead of the Kafka container), see the **"Higher Environments"** section of [SETUP.md](SETUP.md) instead — this guide assumes you're running everything yourself on one box, which is the simplest and cheapest path for a personal deployment.

> **Deploying for free?** See [BEGINNER_DEPLOYMENT.md](BEGINNER_DEPLOYMENT.md) instead — same Docker setup, but walked through step-by-step on Oracle Cloud's Always Free tier (genuinely $0 forever, not a trial) instead of a paid VPS, with no assumed prior deployment experience.

---

## Architecture — what's actually running

```
Internet
   │
   ▼
┌─────────────────────────────┐
│  Caddy (80/443)              │  ← only container exposed to the internet
│  automatic Let's Encrypt TLS │
└──────────────┬───────────────┘
               │
               ▼
┌─────────────────────────────┐
│  frontend (nginx, port 80)   │  ← Angular build, static files
└──────────────┬───────────────┘
               │ /api/** proxied
               ▼
┌─────────────────────────────┐
│  gateway (port 8081)         │  ← rate limiting, CORS, routing
└──────────────┬───────────────┘
               │
               ▼
┌─────────────────────────────┐
│  core-api (port 8080)        │  ← business logic
└───┬──────┬──────┬──────┬─────┘
    │      │      │      │
    ▼      ▼      ▼      ▼
postgres  redis  minio  kafka
```

All internal services (postgres, redis, minio, kafka, core-api, gateway, prometheus, grafana, zipkin) talk to each other over a private Docker network and are **never exposed to the internet** — only Caddy is. This matches [infra/docker/docker-compose.prod.yml](infra/docker/docker-compose.prod.yml), the production overlay I added on top of the existing base [docker-compose.yml](infra/docker/docker-compose.yml).

---

## Before you start — two real bugs I found and fixed

While preparing this guide I traced through the exact env vars each service reads and found the existing Docker setup had two latent bugs that would have broken a real deployment. Both are already fixed in this codebase (not something you need to do):

1. **Gateway couldn't reach the backend in Docker.** [docker-compose.ci.yml](infra/docker/docker-compose.ci.yml) set an env var named `BACKEND_URI`, but the gateway actually reads `CORE_API_URL` ([gateway/src/main/resources/application.yml:38](gateway/src/main/resources/application.yml)). The gateway would have silently fallen back to `http://localhost:8080` inside its own container — connection refused on every single API call. Fixed to `CORE_API_URL`.
2. **Flyway schema split-brain — breaks on the second restart of any fresh database.** The Postgres role is named `healthvault`, which is also the app's schema name. Postgres' default `search_path` (`"$user", public`) means: on a brand-new database, the `healthvault` schema doesn't exist yet, so Flyway's own bookkeeping table (`flyway_schema_history`) lands in `public`. On the *next* restart, V1 has already created the `healthvault` schema, so `$user` now resolves successfully — Flyway looks for its history table in `healthvault`, finds nothing, and tries to replay every migration from scratch, crashing with "relation already exists" on V2. This is 100% reproducible on any fresh deployment with the default role name — it's not an edge case. Fixed permanently by pinning `spring.flyway.schemas: healthvault` in [backend/src/main/resources/application.yml](backend/src/main/resources/application.yml) — see the comment there for the full explanation.

I also parameterized the gateway's CORS allowlist (it was hardcoded to `localhost:*` — no way to reach it from a real domain) via new `CORS_ALLOWED_ORIGIN_1`/`CORS_ALLOWED_ORIGIN_2` env vars, which the prod compose file below sets to your domain automatically.

---

## Step 1 — Get a server

Any of these work fine for a personal deployment:

| Provider | Suggested size | Approx. cost |
|---|---|---|
| DigitalOcean Droplet | 2 vCPU / 4 GB RAM | ~$24/mo |
| Hetzner Cloud | CX22 (2 vCPU / 4 GB) | ~€4/mo |
| AWS Lightsail | 4 GB plan | ~$24/mo |

Kafka + Postgres + the two JVM services are the memory-hungry parts — **don't go below 4 GB RAM** or you'll see OOM kills. Choose Ubuntu 22.04 LTS as the OS image.

Point your domain's DNS **A record** (and optionally a `www` CNAME) at the server's public IP now — DNS propagation can take a few minutes to a few hours, and Caddy needs it resolved correctly before it can get a TLS certificate.

---

## Step 2 — Install Docker on the server

SSH into the server, then:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker   # or log out and back in
docker --version
docker compose version
```

---

## Step 3 — Lock down the firewall

Only SSH, HTTP, and HTTPS need to be reachable from the internet — everything else (Postgres, Redis, Grafana, etc.) is bound to `127.0.0.1` by the prod compose file, so it's only reachable via SSH tunnel even without a firewall, but enable one anyway as defense in depth:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

---

## Step 4 — Get the code onto the server

Either clone the repo directly on the server (if it's in a git remote you control):

```bash
git clone <your-repo-url> health-vault
cd health-vault
```

Or transfer the source zip you already have and unzip it:

```bash
scp health-vault-src-*.zip you@your-server:/home/you/
ssh you@your-server
unzip health-vault-src-*.zip -d health-vault
cd health-vault
```

---

## Step 5 — Generate real secrets

**Never reuse the placeholders from `.env.example` anywhere but local dev.** Generate fresh values:

```bash
echo "JWT_SECRET=$(openssl rand -base64 48 | tr -d '=')"
echo "DOCUMENT_ENCRYPTION_KEY=$(openssl rand -base64 32)"
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -d '=+/')"
echo "MINIO_ACCESS_KEY=$(openssl rand -hex 10)"
echo "MINIO_SECRET_KEY=$(openssl rand -base64 24 | tr -d '=+/')"
```

Copy each output value somewhere safe — you'll paste them into `.env.prod` in the next step. **`DOCUMENT_ENCRYPTION_KEY` is the most critical one to back up separately** (e.g. in a password manager) — if it's ever lost, every document already uploaded becomes permanently unreadable, with no recovery path.

---

## Step 6 — Create `.env.prod`

```bash
cp .env.prod.example .env.prod
nano .env.prod   # or vim / your editor of choice
```

Fill in:
- `DOMAIN` — your real domain (e.g. `health.example.com`), no `https://` prefix
- `POSTGRES_PASSWORD`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `JWT_SECRET`, `DOCUMENT_ENCRYPTION_KEY` — the values you generated in Step 5

Leave everything else at its default unless you have a specific reason to change it (see the comments in the file).

Double-check the file is not world-readable:

```bash
chmod 600 .env.prod
```

---

## Step 7 — Build and start everything

This one command builds the three application images (core-api, gateway, frontend) from their Dockerfiles and starts the entire stack — infra, apps, and the reverse proxy:

```bash
docker compose \
  -f infra/docker/docker-compose.yml \
  -f infra/docker/docker-compose.prod.yml \
  --env-file .env.prod \
  up -d --build
```

First build takes a few minutes (Maven/npm dependency downloads). Watch it come up:

```bash
docker compose \
  -f infra/docker/docker-compose.yml \
  -f infra/docker/docker-compose.prod.yml \
  --env-file .env.prod \
  ps
```

Wait until `postgres`, `redis`, `minio`, `kafka` show `(healthy)`, then `core-api` and `gateway` show `(healthy)` — they depend on infra being healthy first and will wait automatically. `caddy` will request its Let's Encrypt certificate the first time it sees a request for your domain, which happens automatically once DNS resolves correctly.

If anything doesn't go healthy, check its logs:

```bash
docker compose -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.prod.yml logs -f core-api
docker compose -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.prod.yml logs -f caddy
```

---

## Step 8 — Verify

```bash
# Core API, internally (from the server itself, since it's not exposed publicly)
docker exec healthvault-core-api wget -qO- http://localhost:8080/api/health

# Gateway, internally
docker exec healthvault-gateway wget -qO- http://localhost:8081/actuator/health

# The real, public path — from your own laptop, not the server
curl -I https://your-domain.com
curl -s -X POST https://your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@healthvault.local","password":"Demo@1234"}'
```

That last call should return a JSON body with `accessToken`/`refreshToken` — if it does, the full chain (Caddy → frontend → gateway → core-api → Postgres/Redis) is working end to end. Then just open `https://your-domain.com` in a browser and log in.

---

## Step 9 — Post-deploy hardening (do this before telling anyone the URL)

- **Remove or disable the three demo accounts** (`admin@healthvault.local`, `demo@healthvault.local`, `patient@healthvault.local`) — seeded by `V7__seed_demo_users.sql`. Simplest: connect to Postgres and delete them:
  ```bash
  docker exec -it healthvault-postgres psql -U healthvault -d healthvault \
    -c "DELETE FROM healthvault.users WHERE email LIKE '%@healthvault.local';"
  ```
- **Back up the Postgres volume regularly** — it's the only source of truth for everything except uploaded documents (which live in the MinIO volume). At minimum:
  ```bash
  docker exec healthvault-postgres pg_dump -U healthvault healthvault | gzip > backup-$(date +%F).sql.gz
  ```
  Automate this with a cron job and ship the backups off-server (S3, Backblaze, etc.) — a backup that only lives on the same disk as the database doesn't protect you from disk failure.
- **Back up `DOCUMENT_ENCRYPTION_KEY` outside the server** (password manager, sealed note) — losing it makes every stored document permanently unreadable, and it isn't in the Postgres backup.
- **View Grafana/Prometheus/Zipkin via SSH tunnel** (they're bound to `127.0.0.1` on the server, not public):
  ```bash
  ssh -L 3000:localhost:3000 -L 9090:localhost:9090 -L 9411:localhost:9411 you@your-server
  ```
  Then open `http://localhost:3000` etc. on your own machine.

---

## Updating after code changes

```bash
git pull   # or re-transfer + unzip a fresh source zip
docker compose \
  -f infra/docker/docker-compose.yml \
  -f infra/docker/docker-compose.prod.yml \
  --env-file .env.prod \
  up -d --build
```

`--build` rebuilds only the images whose source changed; unaffected containers aren't restarted. Flyway migrations (if any new ones exist) run automatically on `core-api` startup.

---

## Rollback

Since `IMAGE_TAG` defaults to `latest`, a plain rollback means checking out the previous commit and rebuilding:

```bash
git checkout <previous-commit-sha>
docker compose -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.prod.yml --env-file .env.prod up -d --build
```

Database migrations are forward-only (Flyway doesn't support automatic down-migrations) — if a rollback needs to undo a schema change, that's a manual SQL step, not something `docker compose` handles for you.

---

## Stopping / tearing down

```bash
# Stop everything, keep all data
docker compose -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.prod.yml --env-file .env.prod stop

# Stop AND delete all data volumes (irreversible — Postgres, MinIO, Kafka, Grafana data all gone)
docker compose -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.prod.yml --env-file .env.prod down -v
```

---

*For local development (running things directly with `mvnw`/`ng serve` instead of Docker), see [SETUP.md](SETUP.md). For swapping individual infra pieces for managed cloud services instead of self-hosting them, see the "Higher Environments" section of the same file.*
