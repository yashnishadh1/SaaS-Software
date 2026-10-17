import type { Request, Response, NextFunction } from 'express';
import { getAuth } from './firebase';
import type { DecodedIdToken } from 'firebase-admin/auth';

// ─────────────────────────────────────────────────────────────────────────────
// Typed authenticated request
//
// After requireAuth middleware runs successfully, req.user is guaranteed to be
// populated. Downstream handlers and middleware should use AuthenticatedRequest.
// ─────────────────────────────────────────────────────────────────────────────

export interface AuthenticatedUser {
  /** Firebase UID — the only user identifier that should be trusted server-side */
  uid: string;
  /** Verified email from the Firebase token claim */
  email: string;
  /** Whether the email address has been verified by Firebase */
  emailVerified: boolean;
  /** The raw decoded Firebase ID token — do not forward to clients */
  decodedToken: DecodedIdToken;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

// ─────────────────────────────────────────────────────────────────────────────
// requireAuth middleware
//
// Extracts and verifies the Firebase ID token from the Authorization header.
// Does NOT check workspace membership — that is requireWorkspaceAccess's job.
//
// Security properties:
//   - Rejects missing, malformed, expired, and revoked tokens
//   - Never logs bearer tokens or credential values
//   - Returns 401 with a generic message; no internal details leaked
//   - Sets req.user with only the verified claims we care about
// ─────────────────────────────────────────────────────────────────────────────

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'unauthorized',
      message: 'Authentication required. Provide a valid Bearer token.',
    });
    return;
  }

  // Do NOT log the token itself
  const idToken = authHeader.slice(7); // Remove "Bearer "

  if (!idToken || idToken.trim() === '') {
    res.status(401).json({
      error: 'unauthorized',
      message: 'Bearer token is empty.',
    });
    return;
  }

  // checkRevoked: true — verifies the token has not been explicitly revoked
  // in Firebase. This adds a network round-trip but is essential for
  // immediate account suspension use cases.
  getAuth()
    .verifyIdToken(idToken, /* checkRevoked= */ true)
    .then((decoded: DecodedIdToken) => {
      const email = decoded.email;
      if (!email) {
        res.status(401).json({
          error: 'unauthorized',
          message: 'Token does not contain a verified email claim.',
        });
        return;
      }

      (req as AuthenticatedRequest).user = {
        uid: decoded.uid,
        email,
        emailVerified: decoded.email_verified === true,
        decodedToken: decoded,
      };

      next();
    })
    .catch((err: unknown) => {
      // Distinguish between known Firebase auth errors and unexpected errors
      const code =
        err instanceof Error && 'code' in err ? (err as { code: string }).code : 'unknown';

      // Log at warn level with only the error code and message; never the token
      // pino logger will be configured at the service level
      if (process.env['NODE_ENV'] !== 'test') {
        console.warn('[requireAuth] Token verification failed:', code);
      }

      if (
        code === 'auth/id-token-expired' ||
        code === 'auth/id-token-revoked' ||
        code === 'auth/invalid-id-token' ||
        code === 'auth/user-disabled'
      ) {
        res.status(401).json({
          error: 'unauthorized',
          message: 'Token is invalid, expired or revoked.',
        });
        return;
      }

      // Unexpected error — fail closed
      res.status(401).json({
        error: 'unauthorized',
        message: 'Authentication failed.',
      });
    });
}
