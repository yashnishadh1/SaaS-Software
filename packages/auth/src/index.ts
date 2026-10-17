// Auth package barrel export
export { initFirebaseAdmin, getFirebaseAdmin, getAuth } from './firebase';
export { requireAuth } from './middleware';
export type { AuthenticatedUser, AuthenticatedRequest } from './middleware';
export { requireWorkspaceAccess, hasAtLeastRole } from './workspace-access';
export type { WorkspaceContext, RequestWithWorkspace } from './workspace-access';
