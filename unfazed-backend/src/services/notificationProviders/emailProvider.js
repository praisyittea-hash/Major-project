import nodemailer from 'nodemailer';
import { notificationEvents } from '../../config/notificationEvents.js';
export function emailProvider(transport = null) {
  return {
    async send(job) {
      if (!transport && process.env.EMAIL_ENABLED !== 'true')
        return { status: 'disabled', detail: 'Email delivery is not configured.' };
      if (!transport && (!process.env.SMTP_HOST || !process.env.SMTP_FROM))
        throw new Error('SMTP configuration incomplete');
      const smtp =
        transport ||
        nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: process.env.SMTP_SECURE === 'true',
          auth: process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
            : undefined,
          connectionTimeout: 10000,
          socketTimeout: 15000,
        });
      const result = await smtp.sendMail({
        from: process.env.SMTP_FROM || 'Unfazed <care@example.test>',
        to: job.recipient,
        subject: notificationEvents[job.kind] || 'Practice update',
        text: `${notificationEvents[job.kind] || 'Practice update'}. Open your secure Unfazed portal for details.`,
        messageId: `<notification-${job.id}@unfazed.local>`,
      });
      return {
        status: 'sent',
        providerMessageId: result.messageId,
        detail: 'Email accepted by the SMTP provider.',
      };
    },
  };
}
