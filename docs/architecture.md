# Architecture — BizFlow

> Phase 1 status: Foundation only. Most modules are reserved stubs.

---

## High-Level Design

BizFlow follows a **modular monolith + worker** topology for initial deployment,
with a clear upgrade path to microservices if individual modules require
independent scaling.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Public Internet                          │
└──────────────┬──────────────────────────────────────────────────┘
               │ HTTPS only
┌──────────────▼──────────────────────────────────────────────────┐
│                     CDN / Load Balancer                         │
│               (Phase 5 — Cloudflare / AWS ALB)                  │
└──────────┬──────────────────────────┬───────────────────────────┘
           │                          │
┌──────────▼──────────┐  ┌────────────▼──────────────────────────┐
│   apps/web          │  │   apps/admin                          │
│   Customer Frontend │  │   Admin Dashboard                     │
│   (Next.js, Phase 2)│  │   (Next.js, Phase 2)                  │
└──────────┬──────────┘  └────────────┬──────────────────────────┘
           │ REST / GraphQL            │
┌──────────▼──────────────────────────▼──────────────────────────┐
│                    services/api                                 │
│                  Express API (Phase 2)                          │
│                                                                 │
│  ┌────────────┐  ┌──────────┐  ┌────────────┐  ┌───────────┐  │
│  │ @bizflow/  │  │@bizflow/ │  │ @bizflow/  │  │@bizflow/  │  │
│  │   auth     │  │database  │  │ validation │  │   ai      │  │
│  │ (Phase 2)  │  │(Phase 2) │  │ ✅ Ready   │  │(Phase 3)  │  │
│  └────────────┘  └──────────┘  └────────────┘  └───────────┘  │
└──────────┬──────────────────────────────────────────────────────┘
           │ Job queue (BullMQ / Phase 3)
┌──────────▼──────────────────────────────────────────────────────┐
│                   services/worker                               │
│               Background Worker (Phase 2/3)                     │
└──────────┬──────────────────────────────────────────────────────┘
           │
┌──────────▼──────────┐  ┌─────────────────────────────────────  ┐
│  PostgreSQL 17       │  │  Redis 7                              │
│  Primary data store  │  │  Cache + job queue                    │
│  (local: Docker)     │  │  (local: Docker)                      │
└──────────────────────┘  └───────────────────────────────────────┘
```

---

## Trust Boundaries

| Boundary         | Description                                     |
| ---------------- | ----------------------------------------------- |
| Internet → CDN   | All public traffic through CDN/WAF (Phase 5)    |
| CDN → API        | TLS; CDN authenticates origin (Phase 5)         |
| API → DB         | Private network only; no public DB exposure     |
| API → Worker     | Internal message queue; not internet-accessible |
| Tenant isolation | Row-level security by `workspace_id` (Phase 2)  |

---

## Package Dependency Graph

```
apps/web         → @bizflow/ui, @bizflow/auth (Phase 2)
apps/admin       → @bizflow/ui, @bizflow/auth (Phase 2)
services/api     → @bizflow/auth, @bizflow/database, @bizflow/validation, @bizflow/ai
services/worker  → @bizflow/database, @bizflow/automation, @bizflow/integrations
packages/auth    → @bizflow/database, @bizflow/validation
packages/ai      → @bizflow/validation
packages/automation → @bizflow/database, @bizflow/ai
packages/integrations → @bizflow/validation
```

No circular dependencies are permitted. All inter-package imports must use
the published `exports` field, not relative paths across package boundaries.

---

## Multi-Tenancy Model (Phase 2 Design)

- Every resource belongs to a **workspace** (tenant).
- `workspace_id` is present on every table; PostgreSQL row-level security
  policies enforce tenant isolation at the database layer.
- A user may belong to multiple workspaces with different roles.
- Super-admin access is gated by a separate `admin` service, not by a flag
  on the user record.

---

## Deployment Topology (Planned — Phase 5)

| Environment | Platform                         |
| ----------- | -------------------------------- |
| Local dev   | Docker Compose                   |
| Staging     | Railway / Render / Fly.io        |
| Production  | AWS ECS Fargate or GCP Cloud Run |
| Database    | AWS RDS PostgreSQL / Supabase    |
| Cache       | AWS ElastiCache Redis            |
| CDN/WAF     | Cloudflare                       |
| Secrets     | AWS Secrets Manager / Doppler    |

---

## Current Limitations (Phase 1)

- No services are implemented; only `packages/validation` has real code.
- No authentication, authorization, or tenant isolation exists.
- Infrastructure is local-only Docker Compose.
- No observability (metrics, tracing, structured logging) configured yet.
- Not production-ready, penetration-tested, or legally reviewed.
