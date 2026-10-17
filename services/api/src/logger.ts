import pino from 'pino';

/**
 * Structured logger with PII/secret redaction.
 * Never log bearer tokens, passwords, or service-account credentials.
 */
export const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'body.password',
      'body.token',
      'body.secret',
      '*.password',
      '*.token',
      '*.secret',
      '*.apiKey',
      '*.serviceAccountJson',
    ],
    censor: '[REDACTED]',
  },
  ...(process.env['NODE_ENV'] === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true },
        },
      }
    : {}),
});
