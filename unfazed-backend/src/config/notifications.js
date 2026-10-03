export function notificationConfig() {
  const intervalMs = Number(process.env.NOTIFICATION_POLL_MS || 10000);
  if (!Number.isSafeInteger(intervalMs) || intervalMs < 1000 || intervalMs > 300000)
    throw new Error('Invalid NOTIFICATION_POLL_MS');
  return { intervalMs, reminderHours: 24 };
}
