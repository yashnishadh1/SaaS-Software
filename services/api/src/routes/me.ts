import { Router, type Request, type Response } from 'express';
import { requireAuth } from '@bizflow/auth';
import type { AuthenticatedRequest } from '@bizflow/auth';
import { prisma } from '@bizflow/database';

export const meRouter = Router();

/**
 * GET /me
 * Returns the authenticated user's profile.
 * Creates a profile record on first access (lazy provisioning).
 */
meRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { uid, email, emailVerified } = authReq.user;

  try {
    // Upsert user profile — Firebase UID is the source of truth
    const user = await prisma.user.upsert({
      where: { firebaseUid: uid },
      create: {
        firebaseUid: uid,
        email,
        displayName: (authReq.user.decodedToken['name'] as string | undefined) ?? null,
      },
      update: {
        email, // keep email in sync with Firebase
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    res.json({ user: { ...user, emailVerified } });
  } catch {
    res.status(500).json({
      error: 'internal_server_error',
      message: 'Failed to retrieve profile.',
    });
  }
});
