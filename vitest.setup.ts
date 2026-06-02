// Global test setup.
// Pin a deterministic timezone so streak/league date-key tests (added in P8)
// behave consistently regardless of the host machine's locale.
process.env.TZ = process.env.TZ || 'UTC';
