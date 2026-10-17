# Infrastructure

This directory is reserved for Phase 5: Infrastructure as Code.

Planned tools and targets:

- **Terraform** or **Pulumi** — cloud resource provisioning
- **AWS** (primary) and/or **GCP** targets
- Resources: ECS Fargate / Cloud Run, RDS PostgreSQL, ElastiCache Redis,
  S3 / GCS, Cloudfront / Cloud CDN, Secrets Manager
- Separate workspaces per environment (`dev`, `staging`, `production`)

## What is NOT here in Phase 1

- No Terraform/Pulumi code
- No cloud credentials
- No production secrets

## Security note

Infrastructure code must never contain real credentials, access keys, or
sensitive configuration. Use Terraform remote state with encryption enabled
and restrict state-file access.
