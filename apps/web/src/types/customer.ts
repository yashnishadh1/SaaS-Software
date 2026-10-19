export type MemberRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerInput {
  name: string;
  email?: string | undefined;
  phone?: string | undefined;
  notes?: string | undefined;
}

export interface UpdateCustomerInput {
  name?: string | undefined;
  email?: string | null | undefined;
  phone?: string | null | undefined;
  notes?: string | null | undefined;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  role: MemberRole;
  createdAt: string;
  joinedAt?: string;
}

export interface CustomerPagination {
  page: number;
  limit: number;
  total: number;
}

export interface CustomerListResponse {
  customers: Customer[];
  pagination: CustomerPagination;
}

/**
 * Role permissions helper matching server-side requireWorkspaceAccess
 * - owner / admin: create, read, edit, archive
 * - member: create, read
 * - viewer: read only
 */
export function canCreateCustomer(role: MemberRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'member';
}

export function canEditCustomer(role: MemberRole): boolean {
  return role === 'owner' || role === 'admin';
}

export function canArchiveCustomer(role: MemberRole): boolean {
  return role === 'owner' || role === 'admin';
}
