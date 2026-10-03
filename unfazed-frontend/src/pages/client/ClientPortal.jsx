import ChatWindow from '../../components/chat/ChatWindow.jsx';
import { useCallback, useEffect, useState } from 'react';
import clientApi, { acceptPortalLink } from '../../api/clientApi.js';
import { messageOf } from '../../api/axiosInstance.js';
import SharedNotes from '../../components/notes/SharedNotes.jsx';
import IntakeForm from '../../components/crm/IntakeForm.jsx';
import InvoiceView from '../../components/payments/InvoiceView.jsx';
import ClientPackages from '../../components/payments/ClientPackages.jsx';
export default function ClientPortal() {
  const [client, setClient] = useState(null),
    [template, setTemplate] = useState(null),
    [history, setHistory] = useState(null),
    [error, setError] = useState(''),
    [saved, setSaved] = useState('');
  const refreshHistory = useCallback(async () => {
    try {
      const { data } = await clientApi.get('/portal/history');
      setHistory(data);
    } catch (e) {
      setError(messageOf(e));
    }
  }, []);
  useEffect(() => {
    acceptPortalLink();
    let active = true;
    clientApi
      .get('/portal/me')
      .then(({ data }) => {
        if (active) {
          setClient(data.client);
          setTemplate(data.template);
        }
      })
      .catch((e) => {
        if (active) setError(messageOf(e));
      });
    refreshHistory();
    const timer = setInterval(refreshHistory, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [refreshHistory]);
  async function submit(values) {
    setError('');
    try {
      const { data } = await clientApi.post('/portal/intake', values);
      setClient(data.client);
      setSaved('Your intake and consent have been securely saved.');
    } catch (e) {
      setError(messageOf(e));
    }
  }
  function signOut() {
    sessionStorage.removeItem('unfazed-client-token');
    setClient(null);
    setHistory(null);
    setError('Portal signed out. Open your secure link to return.');
  }
  if (!client)
    return (
      <main>
        <h1>Your client space</h1>
        {error ? (
          <p className="error" role="alert">
            {error}. Ask your therapist for a current portal link.
          </p>
        ) : (
          <p aria-busy="true">Opening your portal…</p>
        )}
      </main>
    );
  return (
    <main>
      <p className="eyebrow">A SPACE FOR YOUR CARE</p>
      <div className="row">
        <h1>Hello, {client.name}.</h1>
        <button className="secondary" onClick={signOut}>
          Sign out of portal
        </button>
      </div>
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
      <IntakeForm onSubmit={submit} intake={client.intake} template={template} />
      {client.consentAt && <ClientPackages onChanged={refreshHistory} />}
      <section className="card">
        <h2>Your sessions</h2>
        {!history ? (
          <p>Loading sessions…</p>
        ) : history.sessions.length ? (
          history.sessions.map((s) => (
            <p key={s._id}>
              {new Date(s.start).toLocaleString()} · {s.status}{' '}
              {['pending', 'failed'].includes(s.paymentStatus) &&
                s.status === 'pending_payment' && (
                  <a className="button" href={`/payment/${s._id}`}>
                    Pay for session
                  </a>
                )}
            </p>
          ))
        ) : (
          <p>No sessions yet.</p>
        )}
      </section>
      <ChatWindow clientId={client._id} role="client" />
      <SharedNotes notes={history?.notes} />
      <section className="card">
        <h2>Your payments</h2>
        {!history ? (
          <p>Loading payments…</p>
        ) : history.payments.length ? (
          history.payments.map((p) => (
            <div className="card" key={p._id}>
              <p>
                INR {(p.amount / 100).toFixed(2)} · {p.status}
              </p>
              <InvoiceView payment={p} client={clientApi} />
            </div>
          ))
        ) : (
          <p>No payments yet.</p>
        )}
      </section>
    </main>
  );
}
