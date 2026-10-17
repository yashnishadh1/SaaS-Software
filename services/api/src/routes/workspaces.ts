import { Router, type Request, type Response } from 'express';
import { requireAuth, requireWorkspaceAccess } from '@bizflow/auth';
import type { AuthenticatedRequest, RequestWithWorkspace } from '@bizflow/auth';
import { prisma } from '@bizflow/database';
import { createWorkspaceSchema, inviteMemberSchema } from '@bizflow/validation';
import { logger } from '../logger';

export const workspacesRouter = Router();

// ── POST /workspaces — create workspace ──────────────────────────────────────

workspacesRouter.post('/', requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { uid, email } = authReq.user;

  const parsed = createWorkspaceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'validation_error',
      issues: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const { name, slug, description } = parsed.data;

  try {
    // Ensure the user profile exists (created by /me or here if first access)
    const user = await prisma.user.upsert({
      where: { firebaseUid: uid },
      create: { firebaseUid: uid, email },
      update: {},
      select: { id: true },
    });

    // Transactional: create workspace + owner membership + audit event atomically
    const workspace = await prisma.$transaction(async (tx) => {
      const ws = await tx.workspace.create({
        data: { name, slug, description: description ?? null },
        select: { id: true, name: true, slug: true, description: true, createdAt: true },
      });

      await tx.workspaceMember.create({
        data: { workspaceId: ws.id, userId: user.id, role: 'owner' },
      });

      await tx.auditEvent.create({
        data: {
          workspaceId: ws.id,
          actorId: user.id,
          action: 'workspace_created',
          targetType: 'workspace',
          targetId: ws.id,
        },
      });

      return ws;
    });

    logger.info({ workspaceId: workspace.id, userId: user.id }, 'Workspace created');
    res.status(201).json({ workspace });
  } catch (err: unknown) {
    const isUniqueConstraint = err instanceof Error && err.message.includes('Unique constraint');
    if (isUniqueConstraint) {
      res.status(409).json({
        error: 'conflict',
        message: 'A workspace with that slug already exists.',
      });
      return;
    }
    logger.error({ err: err instanceof Error ? err.message : err }, 'Workspace creation failed');
    res
      .status(500)
      .json({ error: 'internal_server_error', message: 'Failed to create workspace.' });
  }
});

// ── GET /workspaces — list caller's workspaces ───────────────────────────────

workspacesRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { uid } = authReq.user;

  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: uid },
      select: { id: true },
    });

    if (!user) {
      res.json({ workspaces: [] });
      return;
    }

    // Only return workspaces this user is a member of — no cross-tenant leak
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: user.id },
      include: {
        workspace: {
          select: { id: true, name: true, slug: true, description: true, createdAt: true },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    const workspaces = memberships.map((m) => ({
      ...m.workspace,
      role: m.role,
      joinedAt: m.joinedAt,
    }));

    res.json({ workspaces });
  } catch {
    res.status(500).json({ error: 'internal_server_error', message: 'Failed to list workspaces.' });
  }
});

// ── GET /workspaces/:workspaceId — single workspace ──────────────────────────

workspacesRouter.get(
  '/:workspaceId',
  requireAuth,
  requireWorkspaceAccess('viewer'),
  async (req: Request, res: Response) => {
    const ctx = (req as unknown as RequestWithWorkspace).workspaceContext;

    try {
      // Constrain query to the verified workspaceId — never use client-supplied body
      const workspace = await prisma.workspace.findUnique({
        where: { id: ctx.workspaceId },
        select: { id: true, name: true, slug: true, description: true, createdAt: true },
      });

      if (!workspace) {
        // Should not happen since middleware verified membership, but be safe
        res.status(404).json({ error: 'not_found', message: 'Workspace not found.' });
        return;
      }

      const members = await prisma.workspaceMember.findMany({
        where: { workspaceId: ctx.workspaceId },
        include: {
          user: { select: { id: true, email: true, displayName: true, avatarUrl: true } },
        },
        orderBy: { joinedAt: 'asc' },
      });

      res.json({
        workspace,
        members: members.map((m) => ({ ...m.user, role: m.role, joinedAt: m.joinedAt })),
        currentUserRole: ctx.role,
      });
    } catch {
      res.status(500).json({ error: 'internal_server_error', message: 'Failed to get workspace.' });
    }
  },
);

// ── POST /workspaces/:workspaceId/members — invite member ────────────────────

workspacesRouter.post(
  '/:workspaceId/members',
  requireAuth,
  requireWorkspaceAccess('admin'), // only admin+ can invite
  async (req: Request, res: Response) => {
    const ctx = (req as unknown as RequestWithWorkspace).workspaceContext;

    const parsed = inviteMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'validation_error',
        issues: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { email, role } = parsed.data;

    // Owner role cannot be granted via invite — must be transferred explicitly
    if ((role as string) === 'owner') {
      res.status(403).json({
        error: 'forbidden',
        message: 'Cannot invite with owner role.',
      });
      return;
    }

    try {
      // Check expiry: 7 days
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const invitation = await prisma.$transaction(async (tx) => {
        // Revoke any existing pending invitation for this email in this workspace
        await tx.invitation.updateMany({
          where: { workspaceId: ctx.workspaceId, email, status: 'pending' },
          data: { status: 'revoked' },
        });

        const inv = await tx.invitation.create({
          data: {
            workspaceId: ctx.workspaceId,
            invitedById: ctx.userId,
            email,
            role,
            expiresAt,
          },
          select: { id: true, email: true, role: true, expiresAt: true, token: true },
        });

        await tx.auditEvent.create({
          data: {
            workspaceId: ctx.workspaceId,
            actorId: ctx.userId,
            action: 'member_invited',
            targetType: 'invitation',
            targetId: inv.id,
            metadata: { email, role },
          },
        });

        return inv;
      });

      logger.info({ workspaceId: ctx.workspaceId, invitationId: invitation.id }, 'Member invited');

      res.status(201).json({
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          expiresAt: invitation.expiresAt,
          // token is returned so caller can send invite email — never log it
        },
      });
    } catch {
      res
        .status(500)
        .json({ error: 'internal_server_error', message: 'Failed to create invitation.' });
    }
  },
);
