import { z } from 'zod';

// ── Common field schemas ──────────────────────────────────────────────────────

export const emailSchema = z.string().email('Must be a valid email address').toLowerCase().trim();

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const slugSchema = z
  .string()
  .min(2, 'Slug must be at least 2 characters')
  .max(63, 'Slug must be at most 63 characters')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens');

// ── Environment schema ────────────────────────────────────────────────────────
// Used by all services to validate their environment at startup.

export const nodeEnvSchema = z.enum(['development', 'test', 'production']);

export const baseEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema.default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type BaseEnv = z.infer<typeof baseEnvSchema>;

// ── Pagination ────────────────────────────────────────────────────────────────

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type Pagination = z.infer<typeof paginationSchema>;

// ── API request body schemas (Phase 2) ───────────────────────────────────────

export const createWorkspaceSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100).trim(),
  slug: slugSchema,
  description: z.string().max(500).trim().optional(),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const inviteMemberSchema = z.object({
  email: emailSchema,
  role: z.enum(['owner', 'admin', 'member', 'viewer']).default('member'),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

// ── API service environment schema ────────────────────────────────────────────

export const apiEnvSchema = baseEnvSchema.extend({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  FIREBASE_PROJECT_ID: z.string().min(1, 'FIREBASE_PROJECT_ID is required'),
  // One of these must be set — validated at runtime in firebase.ts
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;
