import pino from 'pino';

/**
 * Structured logger. Pretty in dev, JSON in production.
 * Never log secrets/tokens (see security hardening in the plan).
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  redact: {
    paths: ['password', 'passwordHash', 'token', 'hashedToken', '*.password', '*.token', 'authorization'],
    censor: '[redacted]',
  },
  ...(process.env.NODE_ENV !== 'production'
    ? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } } }
    : {}),
});
