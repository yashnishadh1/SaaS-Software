/**
 * API integration tests using supertest.
 *
 * Firebase Admin and Prisma are mocked — no real Firebase project or database needed.
 *
 * Tests verify:
 *   - Auth middleware rejects missing/malformed/expired/revoked tokens
 *   - Workspace access control enforces DB membership (never client claims)
 *   - Cross-tenant isolation: Workspace A user cannot access Workspace B
 *   - Input validation returns structured 400 errors
 *   - Token values are never reflected in error responses
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from './app';
import { initFirebaseAdmin } from '@bizflow/auth';

// ── Mock modules BEFORE any app import ──────────────────────────────────────

// ── Mock variables hoisted for vi.mock calls ──────────────────────────────────
const { mockVerifyIdToken, mockPrisma } = vi.hoisted(() => {
  const mockVerifyIdToken = vi.fn();
  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    workspace: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    workspaceMember: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    invitation: {
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    auditEvent: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };
  return { mockVerifyIdToken, mockPrisma };
});

vi.mock('@bizflow/database', () => ({ prisma: mockPrisma }));
vi.mock('@bizflow/database/client', () => ({ prisma: mockPrisma }));

vi.mock('firebase-admin/auth', () => ({
  getAuth: vi.fn(() => ({ verifyIdToken: mockVerifyIdToken })),
}));

vi.mock('firebase-admin/app', () => ({
  initializeApp: vi.fn(() => ({ auth: () => ({ verifyIdToken: mockVerifyIdToken }) })),
  getApps: vi.fn(() => [{ auth: () => ({ verifyIdToken: mockVerifyIdToken }) }]),
  cert: vi.fn(),
  applicationDefault: vi.fn(),
}));

// ── Test environment ─────────────────────────────────────────────────────────

const testEnv = {
  NODE_ENV: 'test' as const,
  PORT: 3001,
  LOG_LEVEL: 'error' as const,
  DATABASE_URL: 'postgresql://test:test@localhost/test',
  FIREBASE_PROJECT_ID: 'test-project',
  CORS_ORIGIN: 'http://localhost:5173',
};

process.env['FIREBASE_PROJECT_ID'] = 'test-project';
initFirebaseAdmin();

const app = createApp(testEnv);

// ── Constants ────────────────────────────────────────────────────────────────

const WS_A = 'workspace-alpha-id';
const WS_B = 'workspace-beta-id';
const USER_UID = 'firebase-uid-alice';
const USER_EMAIL = 'alice@example.com';
const DB_USER_ID = 'db-user-id-alice';

// ── Helpers ──────────────────────────────────────────────────────────────────

function setValidToken(uid = USER_UID, email = USER_EMAIL) {
  mockVerifyIdToken.mockResolvedValue({
    uid,
    email,
    email_verified: true,
    name: 'Alice',
  });
}

function setTokenError(code: string) {
  const err = Object.assign(new Error(`Firebase error: ${code}`), { code });
  mockVerifyIdToken.mockRejectedValue(err);
}

function setMembership(workspaceId: string, role: string) {
  mockPrisma.user.findUnique.mockResolvedValue({ id: DB_USER_ID });
  mockPrisma.workspaceMember.findUnique.mockImplementation(
    ({ where }: { where: { workspaceId_userId: { workspaceId: string } } }) => {
      if (where.workspaceId_userId.workspaceId === workspaceId) {
        return Promise.resolve({ role });
      }
      return Promise.resolve(null);
    },
  );
}

function clearMocks() {
  mockVerifyIdToken.mockReset();
  mockPrisma.user.findUnique.mockReset();
  mockPrisma.user.upsert.mockReset();
  mockPrisma.workspace.findUnique.mockReset();
  mockPrisma.workspaceMember.findUnique.mockReset();
  mockPrisma.workspaceMember.findMany.mockReset();
  mockPrisma.$transaction.mockReset();
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns ok without authentication', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('requireAuth — missing / malformed token', () => {
  beforeEach(clearMocks);

  it('401 — no Authorization header', async () => {
    const res = await request(app).get('/me');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
  });

  it('401 — non-Bearer scheme', async () => {
    const res = await request(app).get('/me').set('Authorization', 'Basic abc123');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
  });

  it('401 — empty Bearer token', async () => {
    const res = await request(app).get('/me').set('Authorization', 'Bearer   ');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
  });

  it('401 — expired token', async () => {
    setTokenError('auth/id-token-expired');
    const res = await request(app).get('/me').set('Authorization', 'Bearer expired.token.value');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
  });

  it('401 — revoked token', async () => {
    setTokenError('auth/id-token-revoked');
    const res = await request(app).get('/me').set('Authorization', 'Bearer revoked.token.value');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
  });

  it('401 — invalid/malformed token', async () => {
    setTokenError('auth/invalid-id-token');
    const res = await request(app).get('/me').set('Authorization', 'Bearer not.a.real.jwt');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
  });

  it('does NOT reflect token value in error response', async () => {
    setTokenError('auth/id-token-expired');
    const sensitiveToken = 'super-secret-token-abc123xyz';
    const res = await request(app).get('/me').set('Authorization', `Bearer ${sensitiveToken}`);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain(sensitiveToken);
  });
});

describe('GET /me — authenticated user profile', () => {
  beforeEach(() => {
    clearMocks();
    setValidToken();
    mockPrisma.user.upsert.mockResolvedValue({
      id: DB_USER_ID,
      email: USER_EMAIL,
      displayName: 'Alice',
      avatarUrl: null,
      createdAt: new Date('2024-01-01'),
    });
  });

  it('200 — returns user profile', async () => {
    const res = await request(app).get('/me').set('Authorization', 'Bearer valid.token');
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(USER_EMAIL);
  });

  it('does NOT return firebaseUid in response', async () => {
    const res = await request(app).get('/me').set('Authorization', 'Bearer valid.token');
    expect(res.body.user).not.toHaveProperty('firebaseUid');
    expect(res.body.user).not.toHaveProperty('firebase_uid');
  });
});

describe('Workspace access control — requireWorkspaceAccess', () => {
  beforeEach(() => {
    clearMocks();
    setValidToken();
  });

  it('403 — user profile not in DB yet', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .get(`/workspaces/${WS_A}`)
      .set('Authorization', 'Bearer valid.token');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('forbidden');
  });

  it('403 — user not a member of the workspace', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: DB_USER_ID });
    mockPrisma.workspaceMember.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .get(`/workspaces/${WS_A}`)
      .set('Authorization', 'Bearer valid.token');
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Access denied.');
  });

  it('403 — unknown workspace ID (same response — prevents enumeration)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: DB_USER_ID });
    mockPrisma.workspaceMember.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .get('/workspaces/does-not-exist-9999')
      .set('Authorization', 'Bearer valid.token');
    expect(res.status).toBe(403);
    // The error body must not reveal whether workspace exists or user is not a member
    expect(res.body.message).toBe('Access denied.');
  });

  it('200 — member can access their workspace', async () => {
    setMembership(WS_A, 'member');
    mockPrisma.workspace.findUnique.mockResolvedValue({
      id: WS_A,
      name: 'Alpha',
      slug: 'alpha',
      description: null,
      createdAt: new Date(),
    });
    mockPrisma.workspaceMember.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get(`/workspaces/${WS_A}`)
      .set('Authorization', 'Bearer valid.token');
    expect(res.status).toBe(200);
    expect(res.body.workspace.id).toBe(WS_A);
  });

  it('403 — viewer cannot invite members (admin+ required)', async () => {
    setMembership(WS_A, 'viewer');
    const res = await request(app)
      .post(`/workspaces/${WS_A}/members`)
      .set('Authorization', 'Bearer valid.token')
      .send({ email: 'bob@example.com', role: 'member' });
    expect(res.status).toBe(403);
  });

  it('403 — member cannot invite (admin+ required)', async () => {
    setMembership(WS_A, 'member');
    const res = await request(app)
      .post(`/workspaces/${WS_A}/members`)
      .set('Authorization', 'Bearer valid.token')
      .send({ email: 'bob@example.com', role: 'member' });
    expect(res.status).toBe(403);
  });
});

describe('CROSS-TENANT isolation', () => {
  beforeEach(() => {
    clearMocks();
    setValidToken();
  });

  it('Alice (member of WS_A) cannot read WS_B', async () => {
    // Alice has membership only in WS_A
    mockPrisma.user.findUnique.mockResolvedValue({ id: DB_USER_ID });
    mockPrisma.workspaceMember.findUnique.mockImplementation(
      ({ where }: { where: { workspaceId_userId: { workspaceId: string } } }) =>
        Promise.resolve(where.workspaceId_userId.workspaceId === WS_A ? { role: 'owner' } : null),
    );

    const res = await request(app)
      .get(`/workspaces/${WS_B}`)
      .set('Authorization', 'Bearer valid.token');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('forbidden');
  });

  it('Alice cannot write to WS_B even with valid auth', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: DB_USER_ID });
    mockPrisma.workspaceMember.findUnique.mockResolvedValue(null); // not a member of WS_B

    const res = await request(app)
      .post(`/workspaces/${WS_B}/members`)
      .set('Authorization', 'Bearer valid.token')
      .send({ email: 'eve@example.com', role: 'member' });

    expect(res.status).toBe(403);
  });

  it('WS listing only returns WS_A for Alice', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: DB_USER_ID });
    mockPrisma.workspaceMember.findMany.mockResolvedValue([
      {
        workspace: {
          id: WS_A,
          name: 'Alpha',
          slug: 'alpha',
          description: null,
          createdAt: new Date(),
        },
        role: 'owner',
        joinedAt: new Date(),
      },
    ]);

    const res = await request(app).get('/workspaces').set('Authorization', 'Bearer valid.token');
    expect(res.status).toBe(200);
    expect(res.body.workspaces).toHaveLength(1);
    expect(res.body.workspaces[0].id).toBe(WS_A);
    expect(res.body.workspaces.some((w: { id: string }) => w.id === WS_B)).toBe(false);
  });
});

describe('PRIVILEGE ESCALATION prevention', () => {
  beforeEach(() => {
    clearMocks();
    setValidToken();
  });

  it('member cannot POST invite (admin+ required) — ignores role claim in body', async () => {
    setMembership(WS_A, 'member');
    // Even if body claims admin role — middleware checks DB
    const res = await request(app)
      .post(`/workspaces/${WS_A}/members`)
      .set('Authorization', 'Bearer valid.token')
      .send({ email: 'evil@example.com', role: 'admin' });
    expect(res.status).toBe(403);
  });

  it('cannot invite with owner role (forbidden regardless of caller role)', async () => {
    setMembership(WS_A, 'admin');
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        invitation: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          create: vi.fn().mockResolvedValue({
            id: 'inv-1',
            email: 'bob@example.com',
            role: 'owner',
            expiresAt: new Date(),
            token: 'tok',
          }),
        },
        auditEvent: { create: vi.fn() },
      }),
    );

    const res = await request(app)
      .post(`/workspaces/${WS_A}/members`)
      .set('Authorization', 'Bearer valid.token')
      .send({ email: 'bob@example.com', role: 'owner' });

    // owner role is explicitly blocked in the route handler
    expect(res.status).toBe(403);
    expect(res.body.message).toContain('owner');
  });
});

describe('POST /workspaces — input validation', () => {
  beforeEach(() => {
    clearMocks();
    setValidToken();
    mockPrisma.user.upsert.mockResolvedValue({ id: DB_USER_ID });
  });

  it('400 — missing name', async () => {
    const res = await request(app)
      .post('/workspaces')
      .set('Authorization', 'Bearer valid.token')
      .send({ slug: 'my-workspace' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
    expect(res.body.issues).toHaveProperty('name');
  });

  it('400 — invalid slug (uppercase)', async () => {
    const res = await request(app)
      .post('/workspaces')
      .set('Authorization', 'Bearer valid.token')
      .send({ name: 'My Workspace', slug: 'My-Workspace' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  it('400 — slug with trailing hyphen', async () => {
    const res = await request(app)
      .post('/workspaces')
      .set('Authorization', 'Bearer valid.token')
      .send({ name: 'My Workspace', slug: 'my-workspace-' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  it('201 — valid input creates workspace', async () => {
    mockPrisma.$transaction.mockResolvedValue({
      id: 'new-ws-id',
      name: 'My Workspace',
      slug: 'my-workspace',
      description: null,
      createdAt: new Date(),
    });

    const res = await request(app)
      .post('/workspaces')
      .set('Authorization', 'Bearer valid.token')
      .send({ name: 'My Workspace', slug: 'my-workspace' });
    expect(res.status).toBe(201);
    expect(res.body.workspace.slug).toBe('my-workspace');
  });
});

describe('afterEach — no lingering mocks', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('placeholder — ensures afterEach runs', () => {
    expect(true).toBe(true);
  });
});
