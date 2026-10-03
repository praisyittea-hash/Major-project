import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import api, { messageOf } from '../../api/axiosInstance.js';
import NotesPanel from '../../components/notes/NotesPanel.jsx';
import ClientCard from '../../components/crm/ClientCard.jsx';
export default function ClientProfile() {
  const { id } = useParams();
  const [client, setClient] = useState(null),
    [error, setError] = useState(''),
    [saved, setSaved] = useState('');
  const [history, setHistory] = useState(null);
  useEffect(() => {
    api
      .get(`/clients/${id}/history`)
      .then(({ data }) => setHistory(data))
      .catch((e) => setError(messageOf(e)));
  }, [id]);
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm();
  useEffect(() => {
    let active = true;
    api
      .get(`/clients/${id}`)
      .then(({ data }) => {
        if (active) {
          setClient(data.client);
          setAudit(data.consentAudit || []);
          reset({ ...data.client, tags: data.client.tags.map((t) => t.label).join(', ') });
        }
      })
      .catch((e) => {
        if (active) setError(messageOf(e));
      });
    return () => {
      active = false;
    };
  }, [id, reset]);
  async function submit(values) {
    setSaved('');
    setError('');
    try {
      const { data } = await api.patch(`/clients/${id}`, {
        ...values,
        tags: values.tags
          .split(',')
          .map((label) => ({ label: label.trim() }))
          .filter((t) => t.label),
      });
      setClient(data.client);
      setSaved('Client updated.');
    } catch (e) {
      setError(messageOf(e));
    }
  }
  const [portalUrl, setPortalUrl] = useState(''),
    [audit, setAudit] = useState([]);
  async function createPortal() {
    try {
      const { data } = await api.post(`/clients/${id}/portal-link`);
      setPortalUrl(data.url);
    } catch (e) {
      setError(messageOf(e));
    }
  }
  async function archive() {
    try {
      const { data } = await api.delete(`/clients/${id}`);
      setClient(data.client);
      reset({ ...data.client, tags: data.client.tags.map((t) => t.label).join(', ') });
      setSaved(data.message);
    } catch (e) {
      setError(messageOf(e));
    }
  }
  if (!client)
    return (
      <main>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : (
          'Loading client…'
        )}
        <section className="card">
          <h2>Session history</h2>
          {!history ? (
            <p>Loading sessions…</p>
          ) : history.sessions.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Duration</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.sessions.map((s) => (
                    <tr key={s._id}>
                      <td>{new Date(s.start).toLocaleString()}</td>
                      <td>{s.duration} minutes</td>
                      <td>{s.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No sessions yet.</p>
          )}
        </section>
        <section className="card">
          <h2>Payment history</h2>
          {!history ? (
            <p>Loading payments…</p>
          ) : history.payments.length ? (
            history.payments.map((p) => (
              <p key={p._id}>
                {new Date(p.createdAt).toLocaleDateString()} · INR {(p.amount / 100).toFixed(2)} ·{' '}
                {p.status}
              </p>
            ))
          ) : (
            <p>No payments yet.</p>
          )}
        </section>
        <section className="card">
          <h2>Notes history</h2>
          {!history ? (
            <p>Loading notes…</p>
          ) : history.notes.length ? (
            history.notes.map((n) => (
              <article className="card" key={n._id}>
                <p className="muted">{new Date(n.createdAt).toLocaleDateString()}</p>
                <h3>Private</h3>
                <p style={{ whiteSpace: 'pre-wrap' }}>{n.privateContent || 'No private content'}</p>
                <h3>Shared with client</h3>
                <p style={{ whiteSpace: 'pre-wrap' }}>{n.sharedContent || 'No shared content'}</p>
              </article>
            ))
          ) : (
            <p>No notes yet. Note authoring is planned for a later module.</p>
          )}
        </section>
        <section className="card">
          <h2>Consent audit</h2>
          {audit.length ? (
            audit.map((a) => (
              <article key={a._id}>
                <p>
                  {a.name} · {a.version} · {new Date(a.acceptedAt).toLocaleString()}
                </p>
                <p>{a.text}</p>
              </article>
            ))
          ) : (
            <p>Consent not yet recorded.</p>
          )}
        </section>
      </main>
    );
  return (
    <main>
      <Link to="/clients">← All clients</Link>
      <h1>Client profile</h1>
      <ClientCard client={client} />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className="success" role="status">
          {saved}
        </p>
      )}
      <section className="card">
        <h2>Client access</h2>
        <p>
          Portal links give access to this client’s own intake, bookings, payments and shared notes
          for 24 hours. Share securely with the client.
        </p>
        <button className="secondary" onClick={createPortal}>
          Create portal link
        </button>
        {portalUrl && (
          <label>
            Copy this link
            <input readOnly value={portalUrl} />
          </label>
        )}
      </section>
      <form className="card" onSubmit={handleSubmit(submit)}>
        <h2>Contact and status</h2>
        <div className="grid">
          <label>
            Name
            <input {...register('name')} required minLength={2} />
          </label>
          <label>
            Email
            <input type="email" {...register('email')} required />
          </label>
          <label>
            Phone
            <input {...register('phone')} />
          </label>
          <label>
            Status
            <select {...register('status')}>
              {['active', 'inactive', 'archived'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Tags
            <input {...register('tags')} />
          </label>
        </div>
        <div className="row">
          <button disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Save client'}</button>
          <button type="button" className="secondary" onClick={archive}>
            Archive client
          </button>
        </div>
      </form>
      {client.intake && (
        <section className="card">
          <h2>Intake</h2>
          <p>Submitted {new Date(client.intake.submittedAt).toLocaleString()}</p>
          <p style={{ whiteSpace: 'pre-wrap' }}>{client.intake.presentingConcern}</p>
          <dl>
            {Object.entries(client.intake.demographics || {}).map(([k, v]) => (
              <div key={k}>
                <dt>
                  <strong>{k}</strong>
                </dt>
                <dd>{v}</dd>
              </div>
            ))}
            {Object.entries(client.intake.history || {}).map(([k, v]) => (
              <div key={k}>
                <dt>
                  <strong>{k}</strong>
                </dt>
                <dd style={{ whiteSpace: 'pre-wrap' }}>{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      <section className="card">
        <h2>Session history</h2>
        {!history ? (
          <p>Loading sessions…</p>
        ) : history.sessions.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Duration</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.sessions.map((s) => (
                  <tr key={s._id}>
                    <td>{new Date(s.start).toLocaleString()}</td>
                    <td>{s.duration} minutes</td>
                    <td>{s.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No sessions yet.</p>
        )}
      </section>
      <section className="card">
        <h2>Payment history</h2>
        {!history ? (
          <p>Loading payments…</p>
        ) : history.payments.length ? (
          history.payments.map((p) => (
            <p key={p._id}>
              {new Date(p.createdAt).toLocaleDateString()} · INR {(p.amount / 100).toFixed(2)} ·{' '}
              {p.status}
            </p>
          ))
        ) : (
          <p>No payments yet.</p>
        )}
      </section>
      <NotesPanel key={id} clientId={id} />
      <section className="card">
        <h2>Consent audit</h2>
        {audit.length ? (
          audit.map((a) => (
            <article key={a._id}>
              <p>
                {a.name} · {a.version} · {new Date(a.acceptedAt).toLocaleString()}
              </p>
              <p>{a.text}</p>
            </article>
          ))
        ) : (
          <p>Consent not yet recorded.</p>
        )}
      </section>
    </main>
  );
}
