# Release Security Checklist — BizFlow

> Use this checklist before any deployment to staging or production.
> **Do not skip items.** Mark each item with the reviewer's initials and date.

---

## A — Code Review

- [ ] All changes reviewed and approved by at least one other engineer
- [ ] No TODO/FIXME security items left unresolved
- [ ] No debug code, hardcoded credentials, or `console.log` of sensitive data
- [ ] Dependency diff reviewed (new packages vetted for supply-chain risk)

---

## B — Secret Scanning

- [ ] Gitleaks scan passes: `gitleaks detect --source=. --config=.gitleaks.toml --verbose`
- [ ] Gitleaks history scan passes: `gitleaks detect --log-opts="--all"`
- [ ] GitHub secret scanning alerts reviewed and resolved (if enabled)
- [ ] No `.env` or credential files staged: `git status`

---

## C — Dependency Security

- [ ] `npm audit --audit-level=high` returns zero findings
- [ ] MODERATE findings reviewed and risk-accepted or patched
- [ ] Dependabot PRs merged or deferred with documented reason
- [ ] All GitHub Actions SHA pins are current

---

## D — Type Safety and Tests

- [ ] `npm run typecheck` passes with zero errors
- [ ] `npm run lint` passes with zero warnings
- [ ] `npm test` passes with zero failures
- [ ] Test coverage has not regressed (track baseline in Phase 2)

---

## E — Environment Configuration

- [ ] Production secrets injected via secrets manager (not in `.env` files)
- [ ] Secrets rotated if any were accidentally exposed
- [ ] `NODE_ENV=production` confirmed in deployment config
- [ ] All required environment variables present (startup validation enforced)
- [ ] Database connection uses TLS in production

---

## F — Infrastructure (Phase 5+)

- [ ] Database migrations reviewed and tested against a staging snapshot
- [ ] Rollback plan documented for breaking schema changes
- [ ] Docker images built from pinned base images
- [ ] No extra ports exposed in production containers
- [ ] Health-check endpoints respond correctly
- [ ] Rate limiting and WAF rules active

---

## G — Access and Permissions

- [ ] GitHub branch protection rules are active on `main`
- [ ] CI required checks are enforced (no bypass)
- [ ] Production database has no public network access
- [ ] Redis has no public network access and uses password auth
- [ ] Principle of least privilege applied to service IAM roles

---

## H — Post-Deploy

- [ ] Smoke test against staging passes
- [ ] Error monitoring (Sentry / Cloud Logging) shows no new errors
- [ ] Deployment documented in change log
- [ ] On-call engineer notified

---

> **Disclaimer:** This checklist is not a security audit, penetration test, or
> compliance certification. It is a minimum engineering hygiene gate.
> Engage a qualified security professional before handling sensitive personal
> or financial data in production.
