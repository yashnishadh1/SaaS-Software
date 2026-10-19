import { describe, it, expect } from 'vitest';
import {
  canCreateCustomer,
  canEditCustomer,
  canArchiveCustomer,
  type Customer,
} from '../types/customer';
import { ApiError } from './api';

describe('Customer Frontend Role Permissions', () => {
  it('enforces creation permissions: owner, admin, and member can create; viewer cannot', () => {
    expect(canCreateCustomer('owner')).toBe(true);
    expect(canCreateCustomer('admin')).toBe(true);
    expect(canCreateCustomer('member')).toBe(true);
    expect(canCreateCustomer('viewer')).toBe(false);
  });

  it('enforces edit permissions: only owner and admin can edit', () => {
    expect(canEditCustomer('owner')).toBe(true);
    expect(canEditCustomer('admin')).toBe(true);
    expect(canEditCustomer('member')).toBe(false);
    expect(canEditCustomer('viewer')).toBe(false);
  });

  it('enforces archive permissions: only owner and admin can archive', () => {
    expect(canArchiveCustomer('owner')).toBe(true);
    expect(canArchiveCustomer('admin')).toBe(true);
    expect(canArchiveCustomer('member')).toBe(false);
    expect(canArchiveCustomer('viewer')).toBe(false);
  });
});

describe('ApiError class', () => {
  it('correctly sets status, code, message, and validation issues', () => {
    const issues = { name: ['Name must be at least 2 characters'] };
    const err = new ApiError(400, 'validation_error', 'Validation failed', issues);

    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ApiError');
    expect(err.status).toBe(400);
    expect(err.code).toBe('validation_error');
    expect(err.message).toBe('Validation failed');
    expect(err.issues).toEqual(issues);
  });
});

describe('Customer search filtering', () => {
  const sampleCustomers: Customer[] = [
    {
      id: 'c1',
      name: 'Acme Corporation',
      email: 'contact@acme.com',
      phone: '+1-555-0101',
      notes: 'Key enterprise account',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'c2',
      name: 'Globex Inc',
      email: 'sales@globex.org',
      phone: null,
      notes: null,
      createdAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    },
    {
      id: 'c3',
      name: 'Initech',
      email: null,
      phone: '+1-555-0202',
      notes: 'Consulting client',
      createdAt: '2026-01-03T00:00:00.000Z',
      updatedAt: '2026-01-03T00:00:00.000Z',
    },
  ];

  function filterCustomers(query: string, list: Customer[]): Customer[] {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.email?.toLowerCase().includes(q) ?? false) ||
        (c.phone?.toLowerCase().includes(q) ?? false),
    );
  }

  it('filters by customer name case-insensitively', () => {
    expect(filterCustomers('acme', sampleCustomers)).toHaveLength(1);
    expect(filterCustomers('ACME', sampleCustomers)[0]?.name).toBe('Acme Corporation');
  });

  it('filters by email address', () => {
    expect(filterCustomers('globex.org', sampleCustomers)).toHaveLength(1);
    expect(filterCustomers('globex.org', sampleCustomers)[0]?.name).toBe('Globex Inc');
  });

  it('filters by phone number', () => {
    expect(filterCustomers('0202', sampleCustomers)).toHaveLength(1);
    expect(filterCustomers('0202', sampleCustomers)[0]?.name).toBe('Initech');
  });

  it('returns all customers when search query is empty', () => {
    expect(filterCustomers('', sampleCustomers)).toHaveLength(3);
    expect(filterCustomers('   ', sampleCustomers)).toHaveLength(3);
  });

  it('returns empty array when no matches found', () => {
    expect(filterCustomers('nonexistent', sampleCustomers)).toHaveLength(0);
  });
});

describe('Workspace slug normalization', () => {
  function normalizeSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  it('normalizes name to lowercase with hyphens', () => {
    expect(normalizeSlug('Acme Corporation HQ')).toBe('acme-corporation-hq');
  });

  it('replaces multiple special characters with single hyphen and trims', () => {
    expect(normalizeSlug('  --Acme & Sons, LLC!!--  ')).toBe('acme-sons-llc');
  });
});
