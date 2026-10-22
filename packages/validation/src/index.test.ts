import { describe, expect, it } from 'vitest';
import {
  baseEnvSchema,
  emailSchema,
  paginationSchema,
  passwordSchema,
  slugSchema,
  updateCustomerSchema,
  createTaskSchema,
  updateTaskSchema,
  taskQuerySchema,
} from './index.js';

describe('emailSchema', () => {
  it('accepts a valid email and normalises to lowercase', () => {
    const result = emailSchema.parse('User@Example.COM');
    expect(result).toBe('user@example.com');
  });

  it('rejects a malformed email', () => {
    expect(() => emailSchema.parse('not-an-email')).toThrow();
  });
});

describe('passwordSchema', () => {
  it('accepts a valid strong password', () => {
    expect(() => passwordSchema.parse('Str0ngPass!')).not.toThrow();
  });

  it('rejects a short password', () => {
    expect(() => passwordSchema.parse('Short1')).toThrow();
  });

  it('rejects a password without uppercase', () => {
    expect(() => passwordSchema.parse('nocaps123')).toThrow();
  });

  it('rejects a password without a number', () => {
    expect(() => passwordSchema.parse('NoNumbers!')).toThrow();
  });
});

describe('slugSchema', () => {
  it('accepts a valid slug', () => {
    expect(() => slugSchema.parse('my-workspace')).not.toThrow();
  });

  it('rejects uppercase characters', () => {
    expect(() => slugSchema.parse('My-Workspace')).toThrow();
  });

  it('rejects trailing hyphens', () => {
    expect(() => slugSchema.parse('bad-slug-')).toThrow();
  });
});

describe('baseEnvSchema', () => {
  it('applies defaults when values are missing', () => {
    const env = baseEnvSchema.parse({});
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.LOG_LEVEL).toBe('info');
  });

  it('coerces PORT from string to number', () => {
    const env = baseEnvSchema.parse({ PORT: '8080' });
    expect(env.PORT).toBe(8080);
  });

  it('rejects an invalid NODE_ENV', () => {
    expect(() => baseEnvSchema.parse({ NODE_ENV: 'staging' })).toThrow();
  });
});

describe('paginationSchema', () => {
  it('defaults to page 1 and limit 20', () => {
    const p = paginationSchema.parse({});
    expect(p.page).toBe(1);
    expect(p.limit).toBe(20);
  });

  it('rejects limit > 100', () => {
    expect(() => paginationSchema.parse({ limit: 200 })).toThrow();
  });
});

describe('updateCustomerSchema', () => {
  it('accepts null for email, phone, and notes to clear them in edit mode', () => {
    const parsed = updateCustomerSchema.parse({
      email: null,
      phone: null,
      notes: null,
    });
    expect(parsed.email).toBeNull();
    expect(parsed.phone).toBeNull();
    expect(parsed.notes).toBeNull();
  });

  it('accepts omitting fields', () => {
    const parsed = updateCustomerSchema.parse({ name: 'Updated Corp' });
    expect(parsed.name).toBe('Updated Corp');
    expect(parsed.email).toBeUndefined();
  });
});

describe('createTaskSchema', () => {
  it('validates a minimal task with defaults for status and priority', () => {
    const result = createTaskSchema.parse({ title: 'Complete onboarding' });
    expect(result.title).toBe('Complete onboarding');
    expect(result.status).toBe('todo');
    expect(result.priority).toBe('medium');
    expect(result.description).toBeUndefined();
    expect(result.dueDate).toBeUndefined();
    expect(result.assigneeId).toBeUndefined();
  });

  it('accepts full valid task input', () => {
    const result = createTaskSchema.parse({
      title: 'Fix issue',
      description: 'Detailed description',
      status: 'in_progress',
      priority: 'urgent',
      dueDate: '2026-11-01T12:00:00.000Z',
      assigneeId: 'user-cuid-123',
    });
    expect(result.status).toBe('in_progress');
    expect(result.priority).toBe('urgent');
    expect(result.dueDate).toBe('2026-11-01T12:00:00.000Z');
    expect(result.assigneeId).toBe('user-cuid-123');
  });

  it('rejects empty title', () => {
    expect(() => createTaskSchema.parse({ title: '' })).toThrow();
    expect(() => createTaskSchema.parse({ title: '   ' })).toThrow();
  });

  it('rejects invalid status and priority', () => {
    expect(() => createTaskSchema.parse({ title: 'Task', status: 'invalid_status' })).toThrow();
    expect(() => createTaskSchema.parse({ title: 'Task', priority: 'super_high' })).toThrow();
  });

  it('rejects invalid dueDate', () => {
    expect(() => createTaskSchema.parse({ title: 'Task', dueDate: 'invalid-date' })).toThrow();
  });
});

describe('updateTaskSchema', () => {
  it('allows partial updates and nullable fields to clear values', () => {
    const result = updateTaskSchema.parse({
      status: 'done',
      dueDate: null,
      assigneeId: null,
      description: null,
    });
    expect(result.status).toBe('done');
    expect(result.dueDate).toBeNull();
    expect(result.assigneeId).toBeNull();
    expect(result.description).toBeNull();
  });

  it('rejects empty title if provided', () => {
    expect(() => updateTaskSchema.parse({ title: '   ' })).toThrow();
  });
});

describe('taskQuerySchema', () => {
  it('parses query filters and applies pagination defaults', () => {
    const result = taskQuerySchema.parse({
      status: 'in_progress',
      priority: 'high',
      search: 'audit',
      page: '2',
      limit: '50',
    });
    expect(result.status).toBe('in_progress');
    expect(result.priority).toBe('high');
    expect(result.search).toBe('audit');
    expect(result.page).toBe(2);
    expect(result.limit).toBe(50);
  });
});
