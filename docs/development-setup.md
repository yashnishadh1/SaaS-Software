# Development Setup — BizFlow

---

## Prerequisites

| Tool           | Minimum Version | Install                                                                    |
| -------------- | --------------- | -------------------------------------------------------------------------- |
| Node.js        | 22.x (LTS)      | [nodejs.org](https://nodejs.org/) or nvm/fnm                               |
| npm            | 10.x            | Bundled with Node.js                                                       |
| Git            | any recent      | [git-scm.com](https://git-scm.com/)                                        |
| Docker Desktop | 26+             | [docker.com](https://www.docker.com/) _(optional — required from Phase 2)_ |

### Node version management

The `.nvmrc` file pins Node 22. To use it:

```bash
# With nvm (Linux/macOS)
nvm install
nvm use

# With fnm (cross-platform, recommended for Windows)
fnm install
fnm use
```

---

## First-Time Setup

```bash
# 1. Clone
git clone <repo-url> bizflow
cd bizflow

# 2. Install all workspace dependencies (from lockfile)
npm ci

# 3. Set up local environment
cp .env.example .env
# Open .env in an editor and set local values
```

> **Security reminder:** `.env` is gitignored. Never commit it.

---

## Start Local Infrastructure (Docker)

```bash
# Start PostgreSQL 17 and Redis 7 in the background
docker compose up -d

# Verify services are healthy
docker compose ps
docker compose logs postgres
docker compose logs redis

# Stop (data persists in Docker volumes)
docker compose down

# Stop and delete all data
docker compose down -v
```

### Connection details (defaults)

| Service    | Host      | Port | Database    |
| ---------- | --------- | ---- | ----------- |
| PostgreSQL | 127.0.0.1 | 5432 | bizflow_dev |
| Redis      | 127.0.0.1 | 6379 | —           |

Credentials come from your `.env` file.

---

## Daily Development Commands

```bash
# Type-check all packages
npm run typecheck

# Lint (zero warnings policy)
npm run lint

# Auto-fix lint issues
npm run lint:fix

# Format all files
npm run format

# Check formatting (CI-equivalent)
npm run format:check

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Check for high/critical vulnerabilities
npm run audit:check
```

---

## Workspace Structure

Each package under `packages/*/` and each app under `apps/*/` and
`services/*/` is an independent npm workspace.

Adding a new package:

```bash
mkdir -p packages/my-package/src
# Create packages/my-package/package.json, tsconfig.json
# Then re-install to register the workspace:
npm install
```

Referencing a workspace from another:

```json
// In packages/api/package.json
{
  "dependencies": {
    "@bizflow/validation": "*"
  }
}
```

---

## Troubleshooting

### `npm ci` fails with peer dependency errors

```bash
# Check your Node version matches .nvmrc
node --version

# Clear the cache and reinstall
npm cache clean --force
npm ci
```

### TypeScript errors in IDE but `npm run typecheck` passes

Make sure your editor's TypeScript service is using the workspace version:

- VS Code: run `TypeScript: Select TypeScript Version` → `Use Workspace Version`

### Docker services fail to start

```bash
# Check .env has required variables
cat .env | grep POSTGRES_PASSWORD
cat .env | grep REDIS_PASSWORD

# View detailed logs
docker compose logs -f postgres
```

### Port already in use

If port 5432 or 6379 is in use by a local PostgreSQL or Redis instance,
either stop the local service or change the `POSTGRES_PORT` / `REDIS_PORT`
in your `.env`.

---

## IDE Recommendations

### VS Code

Install recommended extensions (`.vscode/extensions.json` — create in Phase 2):

- `dbaeumer.vscode-eslint`
- `esbenp.prettier-vscode`
- `ms-vscode.vscode-typescript-next`

Enable format on save:

```json
// .vscode/settings.json (not committed — add to your personal settings)
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode"
}
```
