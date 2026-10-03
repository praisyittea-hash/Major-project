import { useEffect, useState } from 'react';
import api, { messageOf } from '../../api/axiosInstance.js';
export default function Subscription() {
  const [data, setData] = useState(null),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api
      .get('/subscription')
      .then(({ data }) => setData(data))
      .catch((e) => setError(messageOf(e)));
  }, []);
  async function request(targetKey) {
    setBusy(true);
    setError('');
    try {
      const result = await api.post('/subscription/upgrade-requests', { targetKey });
      setSaved(result.data.message);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main>
      <h1>Subscription options</h1>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="success">
          {saved}
        </p>
      )}
      {!data ? (
        <p>Loading subscription…</p>
      ) : (
        <>
          <p>Current plan: {data.current?.name || 'Configuration unavailable'}</p>
          <div className="grid">
            {data.tiers.map((tier) => (
              <article className="card" key={tier.key}>
                <h2>{tier.name || tier.key}</h2>
                <p>
                  {tier.pricePaise === null
                    ? 'Contact the practice administrator for pricing'
                    : `${tier.currency} ${(tier.pricePaise / 100).toFixed(2)}`}
                </p>
                <p>
                  Active client capacity:{' '}
                  {tier.caps.clients === null ? 'Unlimited' : tier.caps.clients}
                </p>
                <ul>
                  {Object.entries(tier.features)
                    .filter(([, allowed]) => allowed)
                    .map(([key]) => (
                      <li key={key}>{key.replaceAll('_', ' ')}</li>
                    ))}
                </ul>
                <button disabled={busy} onClick={() => request(tier.key)}>
                  Request this plan
                </button>
              </article>
            ))}
          </div>
          <p>
            Requests require administrator review. Access changes only when the subscription is
            activated.
          </p>
        </>
      )}
    </main>
  );
}
