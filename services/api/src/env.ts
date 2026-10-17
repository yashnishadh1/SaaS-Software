import { apiEnvSchema } from '@bizflow/validation';

/**
 * Validates and returns the API environment configuration.
 * Throws at startup if required variables are missing.
 * Never logs secret values.
 */
export function loadEnv() {
  const result = apiEnvSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map(
        (i: { path: readonly (string | number)[] | (string | number)[]; message: string }) =>
          `  - ${i.path.join('.')}: ${i.message}`,
      )
      .join('\n');
    throw new Error(
      `[api] Environment validation failed. Missing or invalid variables:\n${issues}\n` +
        'Refusing to start. Fix your .env file.',
    );
  }
  return result.data;
}

export type Env = ReturnType<typeof loadEnv>;
