import { describe, expect, it } from 'vitest';
import { hasAtLeastRole } from '../src/workspace-access';

// ─────────────────────────────────────────────────────────────────────────────
// Role hierarchy unit tests
// These test the pure role comparison function without requiring a database.
// ─────────────────────────────────────────────────────────────────────────────

describe('hasAtLeastRole', () => {
  it('owner satisfies all roles', () => {
    expect(hasAtLeastRole('owner', 'owner')).toBe(true);
    expect(hasAtLeastRole('owner', 'admin')).toBe(true);
    expect(hasAtLeastRole('owner', 'member')).toBe(true);
    expect(hasAtLeastRole('owner', 'viewer')).toBe(true);
  });

  it('admin satisfies admin, member, viewer but not owner', () => {
    expect(hasAtLeastRole('admin', 'owner')).toBe(false);
    expect(hasAtLeastRole('admin', 'admin')).toBe(true);
    expect(hasAtLeastRole('admin', 'member')).toBe(true);
    expect(hasAtLeastRole('admin', 'viewer')).toBe(true);
  });

  it('member satisfies member, viewer but not admin or owner', () => {
    expect(hasAtLeastRole('member', 'owner')).toBe(false);
    expect(hasAtLeastRole('member', 'admin')).toBe(false);
    expect(hasAtLeastRole('member', 'member')).toBe(true);
    expect(hasAtLeastRole('member', 'viewer')).toBe(true);
  });

  it('viewer only satisfies viewer', () => {
    expect(hasAtLeastRole('viewer', 'owner')).toBe(false);
    expect(hasAtLeastRole('viewer', 'admin')).toBe(false);
    expect(hasAtLeastRole('viewer', 'member')).toBe(false);
    expect(hasAtLeastRole('viewer', 'viewer')).toBe(true);
  });
});
