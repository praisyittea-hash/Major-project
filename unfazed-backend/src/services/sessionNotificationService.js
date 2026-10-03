import Session from '../models/Session.js';
import { NotificationService } from './notificationService.js';
import { notificationConfig } from '../config/notifications.js';
export async function scheduleSessionEvents(now = new Date()) {
  const horizon = new Date(now.getTime() + notificationConfig().reminderHours * 3600000);
  let published = 0;
  for (const [suffix, kind, match] of [
    ['reminder', 'session.reminder', { status: 'confirmed', start: { $gt: now, $lte: horizon } }],
    ['followup', 'session.followup', { status: 'completed', end: { $lte: now } }],
  ]) {
    const sessions = await Session.aggregate([
      { $match: match },
      { $addFields: { eventKey: { $concat: ['session:', { $toString: '$_id' }, `:${suffix}`] } } },
      {
        $lookup: { from: 'domainevents', localField: 'eventKey', foreignField: 'key', as: 'prior' },
      },
      { $match: { prior: { $size: 0 } } },
      { $sort: { start: 1 } },
      { $limit: 100 },
    ]);
    for (const candidate of sessions) {
      const session = await Session.findOne({ _id: candidate._id, ...match });
      if (!session) continue;
      await NotificationService.publish({
        key: candidate.eventKey,
        kind,
        therapist: session.therapist,
        client: session.client,
        recipient: session.contact.email,
        payload: { sessionId: session.id, start: session.start },
      });
      published++;
    }
  }
  return published;
}
export function startNotificationWorker() {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await scheduleSessionEvents();
      await NotificationService.dispatchPending();
    } catch (error) {
      console.error('Notification worker failed:', error.message);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(tick, notificationConfig().intervalMs);
  timer.unref();
  tick();
  return () => clearInterval(timer);
}
