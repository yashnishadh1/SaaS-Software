import { describe, expect, it } from 'vitest';
import {
  baseEnvSchema,
  emailSchema,
  paginationSchema,
  passwordSchema,
  slugSchema,
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
