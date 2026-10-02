import { useEffect, useState } from 'react';
import api, { messageOf } from '../../api/axiosInstance.js';
import useEntitlement from '../../hooks/useEntitlement.js';
import InvoiceView from '../../components/payments/InvoiceView.jsx';
import PackageManager from '../../components/payments/PackageManager.jsx';
export default function Billing() {
  const [payments, setPayments] = useState(null),
    [error, setError] = useState('');
  const access = useEntitlement('payments');
  async function load() {
    try {
      const { data } = await api.get('/payments');
      setPayments(data.payments);
      setError('');
    } catch (e) {
      setError(messageOf(e));
    }
  }
  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);
  if (access.loading)
    return (
      <main>
        Loading billing access…
        <PackageManager />
      </main>
    );
  if (!access.allowed)
    return (
      <main>
        Billing is unavailable.
        <PackageManager />
      </main>
    );
  return (
    <main>
      <p className="eyebrow">A CLEARER PICTURE</p>
      <h1>Billing</h1>
      <p>Payment confirmation is provided by a signed gateway webhook.</p>
      <button className="secondary" onClick={load}>
        Refresh payments
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <section className="card">
        {!payments ? (
          <p>Loading payments…</p>
        ) : payments.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Platform fee</th>
                  <th>Net amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p._id}>
                    <td>{new Date(p.createdAt).toLocaleDateString()}</td>
                    <td>INR {(p.amount / 100).toFixed(2)}</td>
                    <td>INR {(p.platform_fee / 100).toFixed(2)}</td>
                    <td>INR {(p.net_amount / 100).toFixed(2)}</td>
                    <td>
                      <span className="tag">{p.status}</span>
                      <InvoiceView payment={p} />
                      {p.failureReason && <p>{p.failureReason}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No payments yet.</p>
        )}
      </section>
      <PackageManager />
    </main>
  );
}
