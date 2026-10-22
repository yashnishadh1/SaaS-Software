import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from './client';

describe('Live PostgreSQL Tasks Integration & Tenant Isolation', () => {
  let isDbConnected = false;
  let connectionError: string | null = null;

  beforeAll(async () => {
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      isDbConnected = true;
    } catch (err: unknown) {
      isDbConnected = false;
      const rawMessage = err instanceof Error ? err.message : String(err);
      // Strip credentials if present in connection errors
      connectionError = rawMessage.replace(/:\/\/[^:]+:[^@]+@/, '://[REDACTED]@');
    }
  });

  afterAll(async () => {
    if (isDbConnected) {
      await prisma.$disconnect();
    }
  });

  it('enforces multi-tenant workspace isolation for tasks in real PostgreSQL', async (ctx) => {
    if (!isDbConnected) {
      if (process.env['CI']) {
        throw new Error(
          `PostgreSQL integration test failed to connect in CI: ${connectionError ?? 'unknown error'}`,
        );
      }
      ctx.skip();
      return;
    }

    const testRunId = Date.now().toString(36);

    // 1. Create two separate workspaces
    const wsAlpha = await prisma.workspace.create({
      data: {
        name: `Alpha Workspace ${testRunId}`,
        slug: `alpha-${testRunId}`,
      },
    });

    const wsBeta = await prisma.workspace.create({
      data: {
        name: `Beta Workspace ${testRunId}`,
        slug: `beta-${testRunId}`,
      },
    });

    // 2. Create users and memberships
    const userAlice = await prisma.user.create({
      data: {
        firebaseUid: `uid-alice-${testRunId}`,
        email: `alice-${testRunId}@example.com`,
        displayName: 'Alice Alpha',
      },
    });

    const userBob = await prisma.user.create({
      data: {
        firebaseUid: `uid-bob-${testRunId}`,
        email: `bob-${testRunId}@example.com`,
        displayName: 'Bob Beta',
      },
    });

    await prisma.workspaceMember.create({
      data: {
        workspaceId: wsAlpha.id,
        userId: userAlice.id,
        role: 'member',
      },
    });

    await prisma.workspaceMember.create({
      data: {
        workspaceId: wsBeta.id,
        userId: userBob.id,
        role: 'member',
      },
    });

    try {
      // 3. Create task in Workspace Alpha assigned to Alice
      const taskAlpha = await prisma.task.create({
        data: {
          workspaceId: wsAlpha.id,
          assigneeId: userAlice.id,
          title: 'Alpha Private Task',
          description: 'Top secret data for Alpha',
          status: 'in_progress',
          priority: 'high',
        },
      });

      // 4. Create task in Workspace Beta assigned to Bob
      const taskBeta = await prisma.task.create({
        data: {
          workspaceId: wsBeta.id,
          assigneeId: userBob.id,
          title: 'Beta Private Task',
          status: 'todo',
          priority: 'medium',
        },
      });

      // 5. Querying Workspace Alpha must ONLY return Alpha's tasks
      const alphaTasks = await prisma.task.findMany({
        where: { workspaceId: wsAlpha.id, archived: false },
      });

      expect(alphaTasks).toHaveLength(1);
      expect(alphaTasks[0]?.id).toBe(taskAlpha.id);
      expect(alphaTasks[0]?.title).toBe('Alpha Private Task');

      // 6. Querying Workspace Beta must ONLY return Beta's tasks
      const betaTasks = await prisma.task.findMany({
        where: { workspaceId: wsBeta.id, archived: false },
      });

      expect(betaTasks).toHaveLength(1);
      expect(betaTasks[0]?.id).toBe(taskBeta.id);
      expect(betaTasks[0]?.title).toBe('Beta Private Task');

      // 7. Verify cross-workspace isolation on direct lookup
      const crossLookup = await prisma.task.findFirst({
        where: { id: taskAlpha.id, workspaceId: wsBeta.id, archived: false },
      });
      expect(crossLookup).toBeNull();

      // 8. Soft-archive task in Alpha and verify active list excludes it
      await prisma.task.updateMany({
        where: { id: taskAlpha.id, workspaceId: wsAlpha.id, archived: false },
        data: { archived: true },
      });

      const alphaActiveAfterArchive = await prisma.task.findMany({
        where: { workspaceId: wsAlpha.id, archived: false },
      });
      expect(alphaActiveAfterArchive).toHaveLength(0);

      // 9. Cascade delete on workspace deletes tasks
      await prisma.workspace.delete({ where: { id: wsBeta.id } });
      const orphanedBetaTasks = await prisma.task.findMany({
        where: { id: taskBeta.id },
      });
      expect(orphanedBetaTasks).toHaveLength(0);
    } finally {
      // Cleanup Alpha
      await prisma.workspace.delete({ where: { id: wsAlpha.id } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: userAlice.id } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: userBob.id } }).catch(() => undefined);
    }
  });
});
