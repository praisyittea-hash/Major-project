import { useEffect, useState } from 'react';
import api from '../../api/axiosInstance.js';
import clientApi from '../../api/clientApi.js';
const labels = {
  'booking.confirmed': 'Booking confirmed',
  'payment.captured': 'Payment received',
  'payment.failed': 'Payment attempt failed',
  'session.reminder': 'Session reminder',
  'session.followup': 'After your session',
  slot_available: 'Slot available',
};
export default function NotificationFeed({ client = false }) {
  const [jobs, setJobs] = useState(null),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const refresh = () =>
      (client ? clientApi : api)
        .get(client ? '/portal/notifications' : '/notifications')
        .then(({ data }) => {
          if (active) {
            setJobs(data.jobs);
            setError('');
          }
        })
        .catch(() => {
          if (active) setError('Notifications are unavailable.');
        });
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [client]);
  return (
    <section className="card">
      <h2>Notifications</h2>
      {error && <p role="alert">{error}</p>}
      {!jobs ? (
        <p>Loading notifications…</p>
      ) : jobs.length ? (
        jobs.map((job) => (
          <p key={job._id}>
            {labels[job.kind] || 'Practice update'} · {job.channel || 'stub'} ·{' '}
            {job.status === 'stubbed'
              ? 'Stub queued; no WhatsApp message sent'
              : job.status === 'sent'
                ? 'Accepted by email provider'
                : job.status === 'disabled'
                  ? 'Delivery disabled'
                  : job.status}
            {job.detail && <small> · {job.detail}</small>}
          </p>
        ))
      ) : (
        <p>No notifications yet.</p>
      )}
    </section>
  );
}
