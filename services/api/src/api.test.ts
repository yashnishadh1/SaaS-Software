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
    customer: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
    },
    task: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
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
  mockPrisma.customer.create.mockReset();
  mockPrisma.customer.findMany.mockReset();
  mockPrisma.customer.findUnique.mockReset();
  mockPrisma.customer.count.mockReset();
  mockPrisma.customer.updateMany.mockReset();
  mockPrisma.task.create.mockReset();
  mockPrisma.task.findMany.mockReset();
  mockPrisma.task.findFirst.mockReset();
  mockPrisma.task.findUnique.mockReset();
  mockPrisma.task.count.mockReset();
  mockPrisma.task.updateMany.mockReset();
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

describe('Customer CRUD and permissions', () => {
  const CUST_BASE = `/workspaces/${WS_A}/customers`;

  beforeEach(() => {
    clearMocks();
    setValidToken();
    setMembership(WS_A, 'member');
    mockPrisma.user.findUnique.mockResolvedValue({ id: DB_USER_ID });
  });

  it('POST — creates a customer for workspace A (member role)', async () => {
    const createdCustomer = {
      id: 'cust-1',
      name: 'Acme Corp',
      email: 'info@acme.com',
      phone: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockPrisma.customer.create.mockResolvedValue(createdCustomer);
    const res = await request(app)
      .post(CUST_BASE)
      .set('Authorization', 'Bearer valid.token')
      .send({ name: 'Acme Corp', email: 'info@acme.com' });
    expect(res.status).toBe(201);
    expect(res.body.customer).toMatchObject({ id: 'cust-1', name: 'Acme Corp' });
    expect(mockPrisma.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: WS_A,
          name: 'Acme Corp',
          email: 'info@acme.com',
        }),
      }),
    );
  });

  it('POST — validation error when name missing', async () => {
    const res = await request(app)
      .post(CUST_BASE)
      .set('Authorization', 'Bearer valid.token')
      .send({ email: 'no-name@example.com' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
    expect(res.body.issues).toHaveProperty('name');
  });

  it('GET — lists customers with pagination defaults', async () => {
    const mockList = [
      { id: 'c1', name: 'C1' },
      { id: 'c2', name: 'C2' },
    ];
    mockPrisma.customer.findMany.mockResolvedValue(mockList);
    mockPrisma.customer.count.mockResolvedValue(2);
    const res = await request(app).get(CUST_BASE).set('Authorization', 'Bearer valid.token');
    expect(res.status).toBe(200);
    expect(res.body.customers).toHaveLength(2);
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 20, total: 2 });
  });

  it('GET /:id — retrieves a customer in same workspace', async () => {
    const cust = {
      id: 'c1',
      name: 'C1',
      email: null,
      phone: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockPrisma.customer.findUnique.mockResolvedValue(cust);
    const res = await request(app)
      .get(`${CUST_BASE}/c1`)
      .set('Authorization', 'Bearer valid.token');
    expect(res.status).toBe(200);
    expect(res.body.customer).toMatchObject({ id: 'c1', name: 'C1' });
  });

  it('PATCH /:id — admin can update', async () => {
    setMembership(WS_A, 'admin');
    mockPrisma.customer.updateMany.mockResolvedValue({ count: 1 });
    const updated = {
      id: 'c1',
      name: 'New Name',
      email: null,
      phone: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockPrisma.customer.findUnique.mockResolvedValue(updated);
    const res = await request(app)
      .patch(`${CUST_BASE}/c1`)
      .set('Authorization', 'Bearer valid.token')
      .send({ name: 'New Name' });
    expect(res.status).toBe(200);
    expect(res.body.customer.name).toBe('New Name');
  });

  it('PATCH /:id — admin can clear optional fields by sending null', async () => {
    setMembership(WS_A, 'admin');
    mockPrisma.customer.updateMany.mockResolvedValue({ count: 1 });
    const cleared = {
      id: 'c1',
      name: 'Existing Name',
      email: null,
      phone: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockPrisma.customer.findUnique.mockResolvedValue(cleared);
    const res = await request(app)
      .patch(`${CUST_BASE}/c1`)
      .set('Authorization', 'Bearer valid.token')
      .send({ email: null, phone: null, notes: null });
    expect(res.status).toBe(200);
    expect(mockPrisma.customer.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: null,
          phone: null,
          notes: null,
        }),
      }),
    );
  });

  it('DELETE /:id — admin can archive', async () => {
    setMembership(WS_A, 'admin');
    mockPrisma.customer.updateMany.mockResolvedValue({ count: 1 });
    const res = await request(app)
      .delete(`${CUST_BASE}/c1`)
      .set('Authorization', 'Bearer valid.token');
    expect(res.status).toBe(204);
  });

  it('Cross-workspace isolation — cannot access customer from another workspace', async () => {
    mockPrisma.customer.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .get(`${CUST_BASE}/c-other`)
      .set('Authorization', 'Bearer valid.token');
    expect(res.status).toBe(404);
  });

  it('Viewer role cannot create a customer', async () => {
    setMembership(WS_A, 'viewer');
    const res = await request(app)
      .post(CUST_BASE)
      .set('Authorization', 'Bearer valid.token')
      .send({ name: 'Nope' });
    expect(res.status).toBe(403);
  });

  // ── Pagination ──────────────────────────────────────────────────────────

  it('GET — custom page and limit', async () => {
    mockPrisma.customer.findMany.mockResolvedValue([]);
    mockPrisma.customer.count.mockResolvedValue(0);
    const res = await request(app)
      .get(`${CUST_BASE}?page=3&limit=5`)
      .set('Authorization', 'Bearer valid.token');
    expect(res.status).toBe(200);
    expect(res.body.pagination).toMatchObject({ page: 3, limit: 5, total: 0 });
  });

  it('GET — invalid limit (>100) returns 400 validation error', async () => {
    const res = await request(app)
      .get(`${CUST_BASE}?limit=500`)
      .set('Authorization', 'Bearer valid.token');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
    expect(res.body.issues).toHaveProperty('limit');
  });

  it('GET — invalid page (<=0) returns 400 validation error', async () => {
    const res = await request(app)
      .get(`${CUST_BASE}?page=0`)
      .set('Authorization', 'Bearer valid.token');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
    expect(res.body.issues).toHaveProperty('page');
  });

  // ── Archived customer visibility ────────────────────────────────────────

  it('GET /:id — archived customer returns 404', async () => {
    mockPrisma.customer.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .get(`${CUST_BASE}/archived-id`)
      .set('Authorization', 'Bearer valid.token');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  it('DELETE /:id — already-archived returns 404', async () => {
    setMembership(WS_A, 'admin');
    mockPrisma.customer.updateMany.mockResolvedValue({ count: 0 });
    const res = await request(app)
      .delete(`${CUST_BASE}/already-gone`)
      .set('Authorization', 'Bearer valid.token');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  // ── Role permissions ────────────────────────────────────────────────────

  it('Member role cannot update a customer (requires admin+)', async () => {
    setMembership(WS_A, 'member');
    const res = await request(app)
      .patch(`${CUST_BASE}/c1`)
      .set('Authorization', 'Bearer valid.token')
      .send({ name: 'Updated' });
    expect(res.status).toBe(403);
  });

  it('Member role cannot archive a customer (requires admin+)', async () => {
    setMembership(WS_A, 'member');
    const res = await request(app)
      .delete(`${CUST_BASE}/c1`)
      .set('Authorization', 'Bearer valid.token');
    expect(res.status).toBe(403);
  });

  it('Viewer role cannot update a customer', async () => {
    setMembership(WS_A, 'viewer');
    const res = await request(app)
      .patch(`${CUST_BASE}/c1`)
      .set('Authorization', 'Bearer valid.token')
      .send({ name: 'Updated' });
    expect(res.status).toBe(403);
  });

  it('Viewer role cannot archive a customer', async () => {
    setMembership(WS_A, 'viewer');
    const res = await request(app)
      .delete(`${CUST_BASE}/c1`)
      .set('Authorization', 'Bearer valid.token');
    expect(res.status).toBe(403);
  });

  // ── Cross-workspace isolation (write paths) ─────────────────────────────

  it('PATCH /:id — cannot update customer from another workspace', async () => {
    setMembership(WS_A, 'admin');
    mockPrisma.customer.updateMany.mockResolvedValue({ count: 0 });
    const res = await request(app)
      .patch(`${CUST_BASE}/ws-b-cust`)
      .set('Authorization', 'Bearer valid.token')
      .send({ name: 'Stolen' });
    expect(res.status).toBe(404);
  });

  // ── Database error handling ─────────────────────────────────────────────

  it('POST — database error returns safe 500', async () => {
    mockPrisma.customer.create.mockRejectedValue(new Error('connection refused'));
    const res = await request(app)
      .post(CUST_BASE)
      .set('Authorization', 'Bearer valid.token')
      .send({ name: 'Will Fail' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('internal_server_error');
    // Must not leak internal details
    expect(res.body.message).not.toContain('connection refused');
  });

  it('GET — database error returns safe 500', async () => {
    mockPrisma.customer.findMany.mockRejectedValue(new Error('timeout'));
    const res = await request(app).get(CUST_BASE).set('Authorization', 'Bearer valid.token');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('internal_server_error');
  });

  // ── Authentication ──────────────────────────────────────────────────────

  it('POST — unauthenticated request rejected', async () => {
    const res = await request(app).post(CUST_BASE).send({ name: 'No Auth' });
    expect(res.status).toBe(401);
  });

  it('GET — unauthenticated request rejected', async () => {
    const res = await request(app).get(CUST_BASE);
    expect(res.status).toBe(401);
  });

  // ── Validation edge cases ───────────────────────────────────────────────

  it('POST — name too short', async () => {
    const res = await request(app)
      .post(CUST_BASE)
      .set('Authorization', 'Bearer valid.token')
      .send({ name: 'A' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  it('PATCH /:id — invalid email in update', async () => {
    setMembership(WS_A, 'admin');
    const res = await request(app)
      .patch(`${CUST_BASE}/c1`)
      .set('Authorization', 'Bearer valid.token')
      .send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  it('PATCH /:id — update not found returns 404', async () => {
    setMembership(WS_A, 'admin');
    mockPrisma.customer.updateMany.mockResolvedValue({ count: 0 });
    const res = await request(app)
      .patch(`${CUST_BASE}/nonexistent`)
      .set('Authorization', 'Bearer valid.token')
      .send({ name: 'Ghost' });
    expect(res.status).toBe(404);
  });
});

describe('Task CRUD, filtering, assignee validation, and permissions', () => {
  const TASK_BASE = `/workspaces/${WS_A}/tasks`;

  beforeEach(() => {
    clearMocks();
    setValidToken();
    setMembership(WS_A, 'member');
    mockPrisma.user.findUnique.mockResolvedValue({ id: DB_USER_ID });
  });

  it('POST — creates a task with minimal payload and defaults (member role)', async () => {
    const createdTask = {
      id: 'task-1',
      title: 'Setup repository',
      description: null,
      status: 'todo',
      priority: 'medium',
      dueDate: null,
      assigneeId: null,
      assignee: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockPrisma.task.create.mockResolvedValue(createdTask);

    const res = await request(app)
      .post(TASK_BASE)
      .set('Authorization', 'Bearer valid.token')
      .send({ title: 'Setup repository' });

    expect(res.status).toBe(201);
    expect(res.body.task).toMatchObject({
      id: 'task-1',
      title: 'Setup repository',
      status: 'todo',
      priority: 'medium',
    });
    expect(mockPrisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: WS_A,
          title: 'Setup repository',
          status: 'todo',
          priority: 'medium',
          assigneeId: null,
        }),
      }),
    );
  });

  it('POST — creates task with valid assignee in the workspace', async () => {
    const ASSIGNEE_ID = 'user-bob-id';
    mockPrisma.workspaceMember.findUnique.mockImplementation(
      ({ where }: { where: { workspaceId_userId: { workspaceId: string; userId: string } } }) => {
        if (
          where.workspaceId_userId.workspaceId === WS_A &&
          where.workspaceId_userId.userId === ASSIGNEE_ID
        ) {
          return Promise.resolve({ role: 'member' });
        }
        if (
          where.workspaceId_userId.workspaceId === WS_A &&
          where.workspaceId_userId.userId === DB_USER_ID
        ) {
          return Promise.resolve({ role: 'member' });
        }
        return Promise.resolve(null);
      },
    );

    const createdTask = {
      id: 'task-2',
      title: 'Assigned task',
      description: 'Check details',
      status: 'in_progress',
      priority: 'high',
      dueDate: new Date('2026-11-01T00:00:00.000Z'),
      assigneeId: ASSIGNEE_ID,
      assignee: { id: ASSIGNEE_ID, email: 'bob@example.com', displayName: 'Bob', avatarUrl: null },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockPrisma.task.create.mockResolvedValue(createdTask);

    const res = await request(app).post(TASK_BASE).set('Authorization', 'Bearer valid.token').send({
      title: 'Assigned task',
      description: 'Check details',
      status: 'in_progress',
      priority: 'high',
      dueDate: '2026-11-01T00:00:00.000Z',
      assigneeId: ASSIGNEE_ID,
    });

    expect(res.status).toBe(201);
    expect(res.body.task.assigneeId).toBe(ASSIGNEE_ID);
  });

  it('POST — rejects assignee who does NOT belong to the workspace', async () => {
    const INVALID_ASSIGNEE = 'user-outsider-id';
    mockPrisma.workspaceMember.findUnique.mockImplementation(
      ({ where }: { where: { workspaceId_userId: { workspaceId: string; userId: string } } }) => {
        // Current caller is member of WS_A
        if (
          where.workspaceId_userId.workspaceId === WS_A &&
          where.workspaceId_userId.userId === DB_USER_ID
        ) {
          return Promise.resolve({ role: 'member' });
        }
        // Outsider is NOT in WS_A
        return Promise.resolve(null);
      },
    );

    const res = await request(app).post(TASK_BASE).set('Authorization', 'Bearer valid.token').send({
      title: 'Unauthorized assignment',
      assigneeId: INVALID_ASSIGNEE,
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
    expect(res.body.message).toContain('Assignee must be an active member of this workspace');
    expect(mockPrisma.task.create).not.toHaveBeenCalled();
  });

  it('POST — rejects empty or whitespace-only title', async () => {
    const res = await request(app)
      .post(TASK_BASE)
      .set('Authorization', 'Bearer valid.token')
      .send({ title: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
    expect(res.body.issues).toHaveProperty('title');
  });

  it('POST — rejects invalid status or priority', async () => {
    const res = await request(app)
      .post(TASK_BASE)
      .set('Authorization', 'Bearer valid.token')
      .send({ title: 'Valid title', status: 'unknown_status' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
    expect(res.body.issues).toHaveProperty('status');
  });

  it('POST — viewer role cannot create tasks', async () => {
    setMembership(WS_A, 'viewer');
    const res = await request(app)
      .post(TASK_BASE)
      .set('Authorization', 'Bearer valid.token')
      .send({ title: 'Viewer trying to create' });

    expect(res.status).toBe(403);
  });

  it('POST — unauthenticated request rejected', async () => {
    const res = await request(app).post(TASK_BASE).send({ title: 'No token' });
    expect(res.status).toBe(401);
  });

  it('POST — database failure returns safe 500 without leaking error details', async () => {
    mockPrisma.task.create.mockRejectedValue(new Error('fatal db error'));
    const res = await request(app)
      .post(TASK_BASE)
      .set('Authorization', 'Bearer valid.token')
      .send({ title: 'Fail task' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('internal_server_error');
    expect(res.body.message).not.toContain('fatal db error');
  });

  // ── GET list ────────────────────────────────────────────────────────────

  it('GET — lists tasks with pagination defaults (viewer role)', async () => {
    setMembership(WS_A, 'viewer');
    const mockTasks = [
      {
        id: 't1',
        title: 'Task 1',
        status: 'todo',
        priority: 'medium',
        assignee: null,
        createdAt: new Date(),
      },
      {
        id: 't2',
        title: 'Task 2',
        status: 'done',
        priority: 'high',
        assignee: null,
        createdAt: new Date(),
      },
    ];
    mockPrisma.task.findMany.mockResolvedValue(mockTasks);
    mockPrisma.task.count.mockResolvedValue(2);

    const res = await request(app).get(TASK_BASE).set('Authorization', 'Bearer valid.token');

    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(2);
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 20, total: 2 });
    expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workspaceId: WS_A, archived: false }),
        skip: 0,
        take: 20,
      }),
    );
  });

  it('GET — filters by status, priority, assigneeId, and search keyword', async () => {
    setMembership(WS_A, 'viewer');
    mockPrisma.task.findMany.mockResolvedValue([]);
    mockPrisma.task.count.mockResolvedValue(0);

    const res = await request(app)
      .get(`${TASK_BASE}?status=in_progress&priority=urgent&assigneeId=user-1&search=security`)
      .set('Authorization', 'Bearer valid.token');

    expect(res.status).toBe(200);
    expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: WS_A,
          archived: false,
          status: 'in_progress',
          priority: 'urgent',
          assigneeId: 'user-1',
          OR: [
            { title: { contains: 'security', mode: 'insensitive' } },
            { description: { contains: 'security', mode: 'insensitive' } },
          ],
        }),
      }),
    );
  });

  it('GET — invalid pagination limit or page returns 400', async () => {
    const res = await request(app)
      .get(`${TASK_BASE}?limit=200`)
      .set('Authorization', 'Bearer valid.token');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
    expect(res.body.issues).toHaveProperty('limit');
  });

  // ── GET single task ─────────────────────────────────────────────────────

  it('GET /:taskId — retrieves single task for viewer', async () => {
    setMembership(WS_A, 'viewer');
    const task = {
      id: 'task-1',
      title: 'Detailed Task',
      description: 'More info',
      status: 'todo',
      priority: 'low',
      dueDate: null,
      assigneeId: null,
      assignee: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockPrisma.task.findFirst.mockResolvedValue(task);

    const res = await request(app)
      .get(`${TASK_BASE}/task-1`)
      .set('Authorization', 'Bearer valid.token');

    expect(res.status).toBe(200);
    expect(res.body.task.title).toBe('Detailed Task');
    expect(mockPrisma.task.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'task-1', workspaceId: WS_A, archived: false },
      }),
    );
  });

  it('GET /:taskId — returns 404 for task from another workspace (tenant isolation)', async () => {
    mockPrisma.task.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get(`${TASK_BASE}/other-workspace-task`)
      .set('Authorization', 'Bearer valid.token');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  // ── PATCH update task ───────────────────────────────────────────────────

  it('PATCH /:taskId — member can update task status and priority', async () => {
    mockPrisma.task.updateMany.mockResolvedValue({ count: 1 });
    const updated = {
      id: 'task-1',
      title: 'Setup repository',
      status: 'done',
      priority: 'urgent',
    };
    mockPrisma.task.findUnique.mockResolvedValue(updated);

    const res = await request(app)
      .patch(`${TASK_BASE}/task-1`)
      .set('Authorization', 'Bearer valid.token')
      .send({ status: 'done', priority: 'urgent' });

    expect(res.status).toBe(200);
    expect(res.body.task.status).toBe('done');
    expect(mockPrisma.task.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'task-1', workspaceId: WS_A, archived: false },
        data: expect.objectContaining({ status: 'done', priority: 'urgent' }),
      }),
    );
  });

  it('PATCH /:taskId — member can clear optional fields with null', async () => {
    mockPrisma.task.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.task.findUnique.mockResolvedValue({
      id: 'task-1',
      description: null,
      dueDate: null,
      assigneeId: null,
    });

    const res = await request(app)
      .patch(`${TASK_BASE}/task-1`)
      .set('Authorization', 'Bearer valid.token')
      .send({ description: null, dueDate: null, assigneeId: null });

    expect(res.status).toBe(200);
    expect(mockPrisma.task.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'task-1', workspaceId: WS_A, archived: false },
        data: expect.objectContaining({ description: null, dueDate: null, assigneeId: null }),
      }),
    );
  });

  it('PATCH /:taskId — rejects reassignment to non-member of workspace', async () => {
    mockPrisma.workspaceMember.findUnique.mockImplementation(
      ({ where }: { where: { workspaceId_userId: { workspaceId: string; userId: string } } }) => {
        if (
          where.workspaceId_userId.workspaceId === WS_A &&
          where.workspaceId_userId.userId === DB_USER_ID
        ) {
          return Promise.resolve({ role: 'member' });
        }
        return Promise.resolve(null);
      },
    );

    const res = await request(app)
      .patch(`${TASK_BASE}/task-1`)
      .set('Authorization', 'Bearer valid.token')
      .send({ assigneeId: 'outsider-id' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
    expect(res.body.message).toContain('Assignee must be an active member of this workspace');
    expect(mockPrisma.task.updateMany).not.toHaveBeenCalled();
  });

  it('PATCH /:taskId — viewer role cannot update tasks', async () => {
    setMembership(WS_A, 'viewer');
    const res = await request(app)
      .patch(`${TASK_BASE}/task-1`)
      .set('Authorization', 'Bearer valid.token')
      .send({ status: 'done' });

    expect(res.status).toBe(403);
  });

  it('PATCH /:taskId — cross-workspace isolation (cannot update other workspace task)', async () => {
    mockPrisma.task.updateMany.mockResolvedValue({ count: 0 });

    const res = await request(app)
      .patch(`${TASK_BASE}/other-ws-task`)
      .set('Authorization', 'Bearer valid.token')
      .send({ title: 'Compromised title' });

    expect(res.status).toBe(404);
  });

  // ── DELETE archive task ─────────────────────────────────────────────────

  it('DELETE /:taskId — admin can archive task (returns 204)', async () => {
    setMembership(WS_A, 'admin');
    mockPrisma.task.updateMany.mockResolvedValue({ count: 1 });

    const res = await request(app)
      .delete(`${TASK_BASE}/task-1`)
      .set('Authorization', 'Bearer valid.token');

    expect(res.status).toBe(204);
    expect(mockPrisma.task.updateMany).toHaveBeenCalledWith({
      where: { id: 'task-1', workspaceId: WS_A, archived: false },
      data: { archived: true },
    });
  });

  it('DELETE /:taskId — member cannot archive task (requires admin+)', async () => {
    setMembership(WS_A, 'member');
    const res = await request(app)
      .delete(`${TASK_BASE}/task-1`)
      .set('Authorization', 'Bearer valid.token');

    expect(res.status).toBe(403);
  });

  it('DELETE /:taskId — viewer cannot archive task', async () => {
    setMembership(WS_A, 'viewer');
    const res = await request(app)
      .delete(`${TASK_BASE}/task-1`)
      .set('Authorization', 'Bearer valid.token');

    expect(res.status).toBe(403);
  });

  it('DELETE /:taskId — already archived task returns 404', async () => {
    setMembership(WS_A, 'admin');
    mockPrisma.task.updateMany.mockResolvedValue({ count: 0 });

    const res = await request(app)
      .delete(`${TASK_BASE}/already-archived`)
      .set('Authorization', 'Bearer valid.token');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  it('DELETE /:taskId — cross-workspace isolation (cannot archive other workspace task)', async () => {
    setMembership(WS_A, 'admin');
    mockPrisma.task.updateMany.mockResolvedValue({ count: 0 });

    const res = await request(app)
      .delete(`${TASK_BASE}/other-ws-task`)
      .set('Authorization', 'Bearer valid.token');

    expect(res.status).toBe(404);
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
