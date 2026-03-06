# B-Road Production Readiness Plan

## Overview

Get B-Road from local Docker Compose development to a publicly accessible, secure production deployment -- starting with a beta for friends, scaling to a public launch on car forums and blogs.

## Current State

- Full US curvature data loaded in PostGIS (50 states, 2.1M+ segments)
- Full US OSRM routing data extracted and ready (`data/osrm/us-latest.osrm.*`)
- Multi-stage Dockerfiles with production targets (API + Frontend)
- `docker-compose.prod.yml` with resource limits
- Next.js standalone output configured
- Clerk authentication integrated
- GitHub Actions CI (tests, lint, type-check, build)
- Health checks on all services

## Hosting Recommendation

**Single VPS running Docker Compose** -- this mirrors your dev setup almost exactly, minimizes new tooling, and fits well within budget.

### Why a single server?

- You already have `docker-compose.prod.yml` -- production is just `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d` on a remote machine
- US OSRM routing needs ~12-15GB RAM at runtime, which rules out most PaaS platforms (Railway/Fly.io cap at 2-8GB per service)
- A single server keeps costs predictable -- no surprise bills from managed services
- For beta traffic (dozens of users), a single server is more than enough

### Server Options (pick one)

| Provider | Spec | Monthly Cost | Annual Cost | Notes |
|----------|------|-------------|-------------|-------|
| **Hetzner CX41** | 16GB RAM, 4 vCPU, 160GB SSD | ~$16/mo | ~$192/yr | Best value. EU or US-East datacenters |
| **Hetzner CAX31** | 16GB RAM, 8 vCPU (ARM), 160GB SSD | ~$14/mo | ~$168/yr | ARM -- Docker images must support `linux/arm64` |
| **DigitalOcean** | 16GB RAM, 4 vCPU, 320GB SSD | ~$48/mo | ~$576/yr | More familiar UX, US datacenters |
| **AWS EC2 t3.xlarge** | 16GB RAM, 4 vCPU | ~$120/mo | ~$1,440/yr | Over budget unless using Reserved Instances (~$840/yr 1-yr RI) |
| **GCP e2-standard-4** | 16GB RAM, 4 vCPU | ~$100/mo | ~$1,200/yr | Over budget unless committed use discount |

**Recommendation: Hetzner CX41** -- 16GB RAM for $16/mo leaves plenty of budget for domain, backups, and future scaling. If you prefer staying in AWS/GCP ecosystem, you'll need Reserved Instances to stay under $1000/yr.

### Budget Breakdown (Hetzner path)

| Item | Annual Cost |
|------|------------|
| Hetzner CX41 (16GB) | $192 |
| Domain name | $10-50 |
| Hetzner snapshots/backups | $36 |
| Mapbox API (free tier covers beta) | $0 |
| Clerk auth (free tier: 10k MAU) | $0 |
| **Total** | **~$240-280/yr** |

Leaves ~$700+/yr headroom for scaling up when traffic grows.

---

## Phases

### Phase 1: Security and Configuration Hardening
*Make the app safe to expose to the internet*

- [ ] **1.1** Lock down CORS in `api/server.py` -- replace `allow_origins=["*"]` with env-driven allowed origins
- [ ] **1.2** Add security headers middleware (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
- [ ] **1.3** Add API rate limiting (e.g., `slowapi` for FastAPI) -- prevent abuse of chat/routing endpoints
- [ ] **1.4** Audit environment variables -- ensure no secrets leak to frontend (`NEXT_PUBLIC_*` audit)
- [ ] **1.5** Add production logging config -- structured JSON logs, log level via env var
- [ ] **1.6** Ensure Clerk auth is enforced on all mutation endpoints (save route, delete route, etc.)

### Phase 2: Reverse Proxy and HTTPS
*TLS termination and production-grade request handling*

- [ ] **2.1** Add Caddy service to `docker-compose.prod.yml` -- automatic HTTPS via Let's Encrypt
- [ ] **2.2** Configure Caddy to reverse proxy: `yourdomain.com` -> frontend:3000, `yourdomain.com/api/*` -> api:8000
- [ ] **2.3** Remove direct port exposure for api (8000) and frontend (3000) from prod compose -- only Caddy exposes 80/443
- [ ] **2.4** Update `NEXT_PUBLIC_API_URL` to use the production domain (relative `/api` path via Caddy proxy)

### Phase 3: Production Docker Compose Refinements
*Tighten up the production configuration*

- [ ] **3.1** Add restart policies and logging drivers to all services in prod compose
- [ ] **3.2** Pin Docker image versions (PostGIS, Node, Python) for reproducible builds
- [ ] **3.3** Add a `.env.production.example` with all required production env vars documented
- [ ] **3.4** Configure PostgreSQL for production (connection pooling, WAL settings, pg_hba.conf lockdown)
- [ ] **3.5** Set up automated database backups (pg_dump cron -> offsite storage)
- [ ] **3.6** Add OSRM with US data to the prod compose (set `OSRM_REGION=us`, allocate sufficient memory)
- [ ] **3.7** Update prod compose resource limits -- OSRM needs ~12-15GB RAM allocation

### Phase 4: CI/CD Pipeline
*Automated deployment on merge to main*

- [ ] **4.1** Add a GitHub Actions deploy workflow -- SSH into server, pull latest, rebuild, restart
- [ ] **4.2** Alternative: set up a simple webhook-based deploy (GitHub webhook -> server pulls and redeploys)
- [ ] **4.3** Add health check verification post-deploy (curl the health endpoint, rollback on failure)
- [ ] **4.4** Add deploy notifications (GitHub Actions status, or a simple Slack/Discord webhook)

### Phase 5: Server Provisioning and Initial Deploy
*Get the server running*

- [ ] **5.1** Provision server (Hetzner/AWS/GCP -- whichever you choose)
- [ ] **5.2** Basic server hardening -- SSH key-only auth, disable root login, firewall (ufw: allow 80, 443, 22)
- [ ] **5.3** Install Docker and Docker Compose on the server
- [ ] **5.4** Clone repo, configure `.env`, upload OSRM US data, start services
- [ ] **5.5** Point domain DNS to server IP
- [ ] **5.6** Verify HTTPS works, test all features end-to-end

### Phase 6: Monitoring and Observability
*Know when things break before users tell you*

- [ ] **6.1** Set up basic uptime monitoring (free tier: UptimeRobot, Better Stack, or Healthchecks.io)
- [ ] **6.2** Add error tracking (Sentry free tier -- 5k errors/mo) for both API and frontend
- [ ] **6.3** Set up log rotation to prevent disk fill
- [ ] **6.4** Add basic resource monitoring (Caddy metrics, or a lightweight agent like Netdata)

### Phase 7: Pre-Launch Polish
*Final checks before sharing publicly*

- [ ] **7.1** Add a proper favicon, meta tags, and Open Graph images (for link previews on forums/social)
- [ ] **7.2** Add a robots.txt and sitemap.xml
- [ ] **7.3** Test on mobile browsers (responsive layout, touch interactions on map)
- [ ] **7.4** Performance audit -- Lighthouse score, API response times under load
- [ ] **7.5** Write a simple landing/about page explaining what B-Road is (for forum posts)

---

## OSRM Data Deployment Strategy

Full US OSRM data is already extracted locally at `data/osrm/us-latest.osrm.*`. For production:

1. **Transfer data to server**: `rsync` or `scp` the `us-latest.osrm.*` files (~10-15GB) to the production server
2. **Set `OSRM_REGION=us`** in the production `.env`
3. **Allocate memory**: OSRM with `--mmap` flag keeps memory usage manageable but still needs ~12-15GB available
4. **Enable routing profile**: OSRM runs via `--profile routing` in docker compose

No cloud extraction needed -- the data is ready to deploy.

## Scaling Path (When Traffic Grows)

1. **Immediate**: Vertical scaling -- bump server to 32GB RAM ($30/mo on Hetzner)
2. **Next**: Move PostgreSQL to a managed service (Hetzner Managed DB, Supabase, or Neon)
3. **Later**: Split frontend to Vercel (free tier) or Cloudflare Pages, keep API + OSRM on VPS
4. **Much later**: Horizontal scaling with load balancer (unlikely needed for a niche driving app)

## Domain Notes

- Purchase from a registrar like Namecheap, Cloudflare Registrar (at-cost pricing), or Porkbun
- Cloudflare Registrar is cheapest for renewals (no markup) and gives you free DNS + CDN
- Avoid buying through website builders (Square) -- registrar-only services are cheaper and more flexible
