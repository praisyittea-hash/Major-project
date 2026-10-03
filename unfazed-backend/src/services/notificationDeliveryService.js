import NotificationJob from '../models/NotificationJob.js';
import Session from '../models/Session.js';
import { whatsappStub } from './notificationProviders/whatsappStub.js';
import { emailProvider } from './notificationProviders/emailProvider.js';
export async function deliverNotifications(
  providers = { whatsapp: whatsappStub, email: emailProvider() },
) {
  let processed = 0;
  for (let i = 0; i < 100; i++) {
    const now = new Date();
    const job = await NotificationJob.findOneAndUpdate(
      {
        channel: { $in: ['whatsapp', 'email'] },
        $or: [
          { status: { $in: ['queued', 'failed'] }, nextAttemptAt: { $lte: now } },
          { status: 'processing', leaseUntil: { $lte: now } },
        ],
      },
      {
        $set: { status: 'processing', leaseUntil: new Date(now.getTime() + 60000) },
        $inc: { attempts: 1 },
      },
      { new: true, sort: { createdAt: 1 } },
    );
    if (!job) break;
    try {
      let outcome;
      if (['session.reminder', 'session.followup'].includes(job.kind)) {
        const session = await Session.findById(job.payload.sessionId);
        const valid =
          session &&
          (job.kind === 'session.reminder'
            ? session.status === 'confirmed' && session.start > now
            : session.status === 'completed' && session.end <= now);
        if (!valid) outcome = { status: 'disabled', detail: 'Session no longer eligible.' };
      }
      outcome ||= await providers[job.channel].send(job);
      await NotificationJob.updateOne(
        { _id: job.id, status: 'processing', leaseUntil: job.leaseUntil },
        {
          $set: {
            ...outcome,
            processedAt: new Date(),
            ...(outcome.status === 'sent' ? { acceptedAt: new Date() } : {}),
          },
          $unset: { leaseUntil: 1 },
        },
      );
    } catch {
      await NotificationJob.updateOne(
        { _id: job.id, status: 'processing', leaseUntil: job.leaseUntil },
        {
          $set: {
            status: 'failed',
            nextAttemptAt: new Date(
              Date.now() + Math.min(3600000, 30000 * 2 ** Math.min(job.attempts, 7)),
            ),
            detail: 'Provider unavailable; delivery will retry.',
          },
          $unset: { leaseUntil: 1 },
        },
      );
    }
    processed++;
  }
  return processed;
}
