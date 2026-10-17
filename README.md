# BizFlow — Modular Business Management + AI Automation SaaS

> **Status: Phase 1 — Engineering Foundation**
> This repository contains the secure development foundation only.
> No authentication, business logic, AI features, or billing is implemented yet.

---

## Table of Contents

- [Overview](#overview)
- [Monorepo Structure](#monorepo-structure)
- [Quick Start](#quick-start)
- [Available Commands](#available-commands)
- [Development Infrastructure (Docker)](#development-infrastructure-docker)
- [Environment Variables](#environment-variables)
- [Testing](#testing)
- [Security](#security)
- [Contributing](#contributing)
- [Documentation](#documentation)

---

## Overview

BizFlow is a modular, industry-agnostic SaaS platform targeting individuals,
small businesses, agencies, and enterprises in India and international markets.
The system combines business management tools with an AI automation layer.

This repository uses an **npm workspace monorepo** with a modular-monolith API
and a separate background worker as the initial deployment topology.

---

## Monorepo Structure

```
bizflow/
├── apps/
│   ├── web/           # Customer-facing frontend (Phase 2)
│   └── admin/         # Admin dashboard (Phase 2)
├── services/
│   ├── api/           # Express API (Phase 2)
│   └── worker/        # Background job worker (Phase 2/3)
├── packages/
│   ├── validation/    # ✅ Implemented — shared Zod schemas
│   ├── ui/            # Phase 2 — shared component library
│   ├── auth/          # Phase 2 — JWT, RBAC, sessions
│   ├── database/      # Phase 2 — Drizzle ORM + migrations
│   ├── automation/    # Phase 3 — workflow engine
│   ├── ai/            # Phase 3 — LLM abstractions
│   └── integrations/  # Phase 4 — third-party adapters
├── docs/
├── infrastructure/    # Phase 5 — IaC (Terraform / Pulumi)
├── .github/
│   ├── workflows/ci.yml
│   └── dependabot.yml
├── docker-compose.yml # Local dev only
└── package.json       # Workspace root
```

---

## Quick Start

### Prerequisites

| Tool    | Required Version              |
| ------- | ----------------------------- |
| Node.js | ≥ 22 (see `.nvmrc`)           |
| npm     | ≥ 10                          |
| Git     | any recent                    |
| Docker  | optional (for local DB/cache) |

```bash
# 1. Clone the repository
git clone <repo-url>
cd bizflow

# 2. Use the correct Node version
nvm use        # if using nvm
# or: fnm use  # if using fnm

# 3. Install all workspace dependencies
npm ci

# 4. Set up environment
cp .env.example .env
# Edit .env and fill in LOCAL values (never commit real secrets)

# 5. (Optional) Start local database and cache
docker compose up -d

# 6. Verify the setup
npm run typecheck
npm run lint
npm test
```

---

## Available Commands

All commands are run from the repository root.

| Command                | Description                                       |
| ---------------------- | ------------------------------------------------- |
| `npm ci`               | Install dependencies from lockfile (reproducible) |
| `npm run typecheck`    | Run TypeScript checks across all packages         |
| `npm run lint`         | ESLint with zero-warnings policy                  |
| `npm run lint:fix`     | Auto-fix lint issues                              |
| `npm run format`       | Prettier format all files                         |
| `npm run format:check` | Check formatting without writing                  |
| `npm test`             | Run all automated tests (Vitest)                  |
| `npm run test:watch`   | Run tests in watch mode                           |
| `npm run audit:check`  | `npm audit --audit-level=high`                    |
| `npm run build`        | Build all workspaces                              |

---

## Development Infrastructure (Docker)

> Docker is optional for Phase 1. Required from Phase 2 onwards.

```bash
# Start PostgreSQL + Redis
docker compose up -d

# View logs
docker compose logs -f

# Stop (preserves data volumes)
docker compose down

# Stop and wipe all data
docker compose down -v
```

Services bind to `127.0.0.1` only. They are not accessible from other machines.

See [docs/development-setup.md](docs/development-setup.md) for full details.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in local values.

```bash
cp .env.example .env
```

**Never commit `.env` or any file containing real credentials.**
See [docs/security.md](docs/security.md) for the secret-management policy.

---

## Testing

```bash
npm test               # Single run (used in CI)
npm run test:watch     # Watch mode for development
```

Tests are written with [Vitest](https://vitest.dev/). All test files live
next to their source in `packages/*/src/*.test.ts`.

---

## Security

- `.env` is gitignored. Only `.env.example` is committed.
- CI uses `npm audit --audit-level=high`.
- Dependabot updates npm packages and GitHub Actions weekly.
- Actions are pinned to full commit SHAs.
- Gitleaks configuration is in `.gitleaks.toml`.

Read [docs/security.md](docs/security.md) before committing.

> **Disclaimer:** This project is **not** production-ready, penetration-tested,
> or legally compliant. Phase 1 is an engineering foundation only.

---

## Documentation

| Document                                                                 | Purpose                            |
| ------------------------------------------------------------------------ | ---------------------------------- |
| [docs/architecture.md](docs/architecture.md)                             | System design and trust boundaries |
| [docs/development-setup.md](docs/development-setup.md)                   | Full local setup guide             |
| [docs/security.md](docs/security.md)                                     | Secret management and rotation     |
| [docs/release-security-checklist.md](docs/release-security-checklist.md) | Pre-release checks                 |
