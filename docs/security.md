# Security — BizFlow

> This document describes the secret-management policy, scanning tooling, and
> operational security requirements for the BizFlow monorepo.
>
> **This project is not penetration-tested, independently audited, or legally
> certified as secure.** Treat this document as a baseline engineering guide,
> not a compliance claim.

---

## 1. Secret Handling Policy

### What counts as a secret

- API keys (OpenAI, Anthropic, Stripe, AWS, GCP, etc.)
- Database credentials (usernames, passwords, connection strings)
- JWT signing secrets and refresh-token secrets
- OAuth client secrets
- SMTP passwords
- Service-account JSON files
- Private TLS certificates and keys
- Webhook signing secrets

### Rules

1. **Never commit secrets to source control** — not even temporarily.
2. **`.env` is gitignored.** Only `.env.example` (containing placeholder values) is committed.
3. **Secrets in code are a critical incident** — treat as compromised immediately.
4. **Rotate immediately** if a secret is found in Git history. See §4.

---

## 2. Environment Variables

| File              | Committed?          | Purpose                       |
| ----------------- | ------------------- | ----------------------------- |
| `.env.example`    | ✅ Yes              | Safe placeholder template     |
| `.env`            | ❌ No (.gitignored) | Real local dev values         |
| `.env.production` | ❌ Never            | Injected by secrets manager   |
| `.env.test`       | ❌ No               | CI uses fake/mock values only |

**Local development:** Copy `.env.example` → `.env` and fill in real values locally.  
**Production:** Inject secrets via a secrets manager (Doppler, AWS Secrets Manager,
GCP Secret Manager, Vault). Never bake production secrets into container images or
environment files.

---

## 3. Secret Scanning (Gitleaks)

[Gitleaks](https://github.com/gitleaks/gitleaks) detects secrets in source code
and Git history.

### Install (local)

```bash
# macOS (Homebrew)
brew install gitleaks

# Windows (Scoop)
scoop install gitleaks

# Linux
# Download from https://github.com/gitleaks/gitleaks/releases
```

### Scan working tree

```bash
gitleaks detect --source=. --config=.gitleaks.toml --verbose
```

### Scan Git history (full)

```bash
gitleaks detect --source=. --config=.gitleaks.toml --log-opts="--all" --verbose
```

This scans every commit reachable from all branches and tags.

### Output report as JSON

```bash
gitleaks detect --source=. --config=.gitleaks.toml --report-path=gitleaks-report.json
# gitleaks-report.json is gitignored
```

### Add to CI (future)

Add a Gitleaks step to `.github/workflows/ci.yml` using the official action or
the binary, with `--exit-code 1` to fail builds on findings.

---

## 4. If a Secret Is Found in Git History

> **Do not reproduce the secret in logs, comments, or issues.**

1. **Treat it as compromised immediately**, regardless of repository visibility.
2. **Revoke and rotate** the credential at the issuing service.
3. **Rewrite history** using `git filter-repo` (preferred) or BFG Repo Cleaner:
   ```bash
   # Install: pip install git-filter-repo
   git filter-repo --replace-text <(echo 'OLDVALUE==>PLACEHOLDER')
   # Then force-push ALL branches and tags:
   git push --force --all
   git push --force --tags
   ```
4. **Notify collaborators** to re-clone; old clones contain the secret.
5. **Enable secret scanning** on GitHub (Settings → Security → Secret scanning).
6. **File an incident report** internally, even if the repo was private.

---

## 5. Dependency Security

### Automated audit (CI)

```bash
npm audit --audit-level=high
```

CI fails on HIGH or CRITICAL vulnerabilities. MODERATE findings should be
reviewed manually.

### Manual review

```bash
npm audit             # Full report
npm audit --json      # Machine-readable
```

### Dependabot

`.github/dependabot.yml` is configured to open weekly PRs for outdated
npm packages and GitHub Actions pins. Review and merge these PRs promptly.

---

## 6. Supply-Chain Security

- **GitHub Actions** are pinned to full commit SHAs (not tags) in
  `.github/workflows/ci.yml`. Dependabot will surface SHA updates.
- **npm lockfile** (`package-lock.json`) is committed and used via `npm ci`
  in CI for reproducible installs.
- **No global package installs** by scripts or CI steps.
- Evaluate [Socket.dev](https://socket.dev/) or
  [Snyk](https://snyk.io/) for deeper supply-chain analysis in Phase 2.

---

## 7. Credential Rotation Schedule (Recommended)

| Secret Type             | Rotation Frequency               |
| ----------------------- | -------------------------------- |
| JWT signing secret      | Every 90 days (or on any breach) |
| Database passwords      | Every 90 days                    |
| AI API keys             | Every 180 days                   |
| OAuth client secrets    | Annually or on breach            |
| Internal service tokens | Every 30 days                    |

Automate rotation via your secrets manager where possible.

---

## 8. Branch Protection (Manual Setup Required)

Configure the following in **GitHub → Settings → Branches → Branch protection rules** for `main`:

- ✅ Require a pull request before merging
- ✅ Require at least 1 approving review
- ✅ Dismiss stale reviews when new commits are pushed
- ✅ Require status checks to pass (CI workflow)
- ✅ Require branches to be up to date before merging
- ✅ Restrict who can push to matching branches
- ✅ Do not allow bypassing the above settings

---

## 9. Known Gaps (Phase 1)

- No authentication or authorization implemented yet.
- No rate limiting, WAF, or DDoS protection.
- No structured security logging or alerting.
- Gitleaks is not yet integrated into CI (manual scan only).
- No penetration testing has been conducted.
- Compliance requirements (GDPR, ISO 27001, SOC 2) have not been assessed.
