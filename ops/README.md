# VBMF ops/ — V0.2 Deployment Artefacts

> **Scope discipline (Deployment SoT §0)**: This dir holds only static, no-code,
> self-hosted deployment contracts. **No auto-deploy / no cloud / no CI push to prod**.
> Runtime Ownership lives in `docs/TECHNOLOGY_STACK_AND_RUNTIME_OWNERSHIP.md`;
> this dir only expresses it as concrete compose/Dockerfile shape.

## Production Core Dependency Rule (PRODUCTION-READINESS-ENTRY-01 / PR-01A, 2026-09-29)

**没有当前 consumer ≠ production core dependency.**

- **Core services (no profile — started by default)**: `db` (PostgreSQL — the Fastify
  control plane's only external dependency, verified: zero redis/valkey/rustfs/srs
  consumers in `apps/api/src`), `media-agent` (device lane on BMD / network-only on
  VM acceptance), `fastify`, `web`, `nginx`.
- **Optional capability services (compose profiles — started only when explicitly
  enabled; core must run normally without them; when enabled, the capability must
  fail honestly on its own)**:
  - `--profile storage` → `rustfs` (S3-compatible object storage; no live consumer yet)
  - `--profile gateway` → `srs` (RTMP/SRT/HLS/WHEP media gateway; no live consumer yet)
  - `--profile worker` → `cache` (Valkey) + `worker` (BullMQ placeholder; no live
    consumer yet — implementing a worker just to go green is forbidden)
- Known image drift: `rustfs/rustfs:2026.8.1` and `ossrs/srs:6.0.42` failed to pull
  on BMD (tag drift). Pins are kept (DEPLOY-BASELINE-01 — never `latest`); fixing the
  pins is a separate future packet. Until then enabling those profiles fails honestly
  at pull time — it must never block the core stack.

## Files
- `docker-compose.yml` — **BASE**: core (`db/fastify/web/media-agent/nginx`) always on;
  optional capabilities (`cache/rustfs/srs/worker`) behind profiles (see rule above).
  Internal `expose` only, secrets via `${}` from `.env`, Nginx as sole ingress.
- `compose.dev.yml` / `compose.acceptance.yml` / `compose.prod.yml` /
  `compose.software-acceptance.yml` / `compose.bmd-acceptance.yml` — **profile overlays**
  (FLOW-01 / §11): HMR+bind-mount / pinned+BMD media ports / immutable+Nginx-443-only /
  VM network-only full chain / BMD native-agent control-plane-only.
- `Dockerfile.worker` — deliberate placeholder (no CMD ⇒ exits immediately ⇒ its
  healthcheck fails) so `--profile worker` can never report a fake green. Wired for
  real code only when a consumer exists.
- `nginx/default.conf` — Nginx ingress routes (`/api /ws /events /ops /admin /health` → fastify; `/` → web).
- `.env.example` — secrets template; real `.env` is gitignored (INFRA-SEC-01).

## Key contracts encoded (Deployment SoT)
1. **Readiness wait (INFRA-01)**: `depends_on: condition: service_healthy` on deps — not mere start.
   Core dependency graph: fastify → db + media-agent; web → fastify; nginx → fastify + web.
2. **Health Tree (§5)**: every service has `healthcheck`; Nginx adds `/health/nginx`.
3. **Media Agent ownership (F2/F4/F11)**: `runtime: runc` (MEDIA-SEC-01 裁决 Option B) + `/dev/blackmagic`.
   DeckLink 设备发现依赖宿主 `DesktopVideoHelper` IPC：部署须 `--ipc=host`
   （compose 不支持 inline shm bind，由部署脚本/daemon 保证）。Host ffmpeg MUST NOT hold DeckLink。
   gVisor `runsc` 因 Step 3 实测枚举失败已否决（证据 2026-08-26-media-sec-01-step3.md）。
4. **Nginx = sole ingress (§8)**: internal services use `expose`, NOT host `ports` (DEPLOY-02).
   SRS owns media protocol plane (RTMP/SRT/HLS/WHEP), published only via profile overlays.
5. **Web same-origin (DEPLOY-UI-01)**: relative paths via Nginx — never `localhost`.
6. **Secrets externalized (INFRA-SEC-01)**: no hardcoded passwords; `.env` gitignored.
7. **Image pins (DEPLOY-BASELINE-01)**: specific patch versions; SRS `6.0.42`; no `latest`.

## G-RUNTIME gate
- Real `up` requires DeckLink SDK on the BMD server (media lane) or the network-only
  binding manifest (software-acceptance lane).
- **Remote BMD Acceptance (§9) cannot run in GitHub CI** — verify on real hardware.
- Env preflight (§6) must pass before `up`.

## Usage
```bash
# CORE (production baseline — no optional capability services)
docker compose -f ops/docker-compose.yml -f ops/compose.prod.yml up --build -d

# CORE + a capability (the capability owns its own honest failure)
docker compose --profile storage -f ops/docker-compose.yml -f ops/compose.prod.yml up -d rustfs
docker compose --profile gateway -f ops/docker-compose.yml -f ops/compose.prod.yml up -d srs

# DEV (HMR, bind mount, publish 5173/3000)
docker compose -f ops/docker-compose.yml -f ops/compose.dev.yml up --build

# VM SOFTWARE ACCEPTANCE (network-only agent full chain)
docker compose --env-file .env \
  -f ops/docker-compose.yml -f ops/compose.software-acceptance.yml \
  up -d --build db media-agent fastify nginx

# ACCEPTANCE (pinned SHA, real BMD, Nginx 443 + SRS media ports)
docker compose -f ops/docker-compose.yml -f ops/compose.acceptance.yml up --build

# BMD control-plane-only (native systemd agent owns the device lane)
docker compose --env-file .env \
  -f ops/docker-compose.yml -f ops/compose.bmd-acceptance.yml up -d --build db
```
