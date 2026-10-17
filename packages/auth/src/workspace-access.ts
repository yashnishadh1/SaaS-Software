import type { Request, Response, NextFunction } from 'express';
import { prisma, type MemberRole } from '@bizflow/database';
import type { AuthenticatedRequest } from './middleware';

// ─────────────────────────────────────────────────────────────────────────────
// Role hierarchy
// Higher index = more permissions.
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_HIERARCHY: Record<MemberRole, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

export function hasAtLeastRole(actual: MemberRole, required: MemberRole): boolean {
  return ROLE_HIERARCHY[actual] >= ROLE_HIERARCHY[required];
}

// ─────────────────────────────────────────────────────────────────────────────
// WorkspaceContext type — available on req after requireWorkspaceAccess
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkspaceContext {
  workspaceId: string;
  userId: string; // internal DB user ID
  role: MemberRole;
}

export interface RequestWithWorkspace extends AuthenticatedRequest {
  workspaceContext: WorkspaceContext;
}

// ─────────────────────────────────────────────────────────────────────────────
// requireWorkspaceAccess middleware factory
//
// Usage:
//   router.get('/:workspaceId/something',
//     requireAuth,
//     requireWorkspaceAccess('member'),
//     handler
//   );
//
// Security invariants:
//   - Must run AFTER requireAuth (relies on req.user)
//   - Checks workspace membership directly in the DB on EVERY request
//   - Never trusts role claims in JWT or client request body
//   - Fails closed on any error (returns 403, never leaks whether workspace exists)
//   - workspaceId must come from the route params, not from client-controlled input
// ─────────────────────────────────────────────────────────────────────────────

export function requireWorkspaceAccess(minimumRole: MemberRole = 'viewer') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const { uid } = authReq.user;

    const workspaceId = req.params['workspaceId'];
    if (!workspaceId || typeof workspaceId !== 'string') {
      res.status(400).json({
        error: 'bad_request',
        message: 'workspaceId route parameter is required.',
      });
      return;
    }

    try {
      // Look up the authenticated user's profile to get their internal DB id
      const user = await prisma.user.findUnique({
        where: { firebaseUid: uid },
        select: { id: true },
      });

      if (!user) {
        // User profile not created yet — treat as forbidden
        res.status(403).json({ error: 'forbidden', message: 'Access denied.' });
        return;
      }

      // Re-read membership from DB every request — no client claims trusted
      const membership = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId: user.id,
          },
        },
        select: { role: true },
      });

      if (!membership) {
        // Return same 403 regardless of whether workspace exists or user is not a member
        // This prevents workspace ID enumeration
        res.status(403).json({ error: 'forbidden', message: 'Access denied.' });
        return;
      }

      if (!hasAtLeastRole(membership.role, minimumRole)) {
        res.status(403).json({ error: 'forbidden', message: 'Access denied.' });
        return;
      }

      // Attach resolved membership context for downstream handlers
      (req as unknown as RequestWithWorkspace).workspaceContext = {
        workspaceId,
        userId: user.id,
        role: membership.role,
      };

      next();
    } catch {
      // Fail closed — deny access on any database error
      res.status(403).json({ error: 'forbidden', message: 'Access denied.' });
    }
  };
}
