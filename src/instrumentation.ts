/**
 * Next server bootstrap hook (runs once per server instance, in every runtime).
 *
 * Used only to start the optional in-process cron scheduler when INPROCESS_CRON
 * is set — a single-container alternative to the supercronic sidecar.
 *
 * The Node-only scheduler (pino, the jobs graph, web-push) is imported INSIDE the
 * `NEXT_RUNTIME === 'nodejs'` branch so webpack dead-code-eliminates it from the
 * Edge bundle (middleware runs on Edge) — the pattern from the Next docs.
 * startInProcessCron() itself no-ops unless INPROCESS_CRON==='true'.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startInProcessCron } = await import('@/server/jobs/inProcessCron');
    startInProcessCron();
  }
}
