import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import api, { messageOf } from '../../api/axiosInstance.js';
import UpgradePrompt, { entitlementFailure } from '../../components/subscription/UpgradePrompt.jsx';
const money = (paise) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(paise / 100);
export default function Analytics() {
  const [data, setData] = useState(null),
    [depth, setDepth] = useState('basic'),
    [range, setRange] = useState({ from: '', to: '' }),
    [error, setError] = useState(''),
    [upgrade, setUpgrade] = useState(null),
    [busy, setBusy] = useState(false),
    [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    setBusy(true);
    api
      .get('/analytics', {
        params: {
          depth,
          ...Object.fromEntries(Object.entries(range).filter(([, value]) => value)),
        },
      })
      .then(({ data }) => {
        if (active) {
          setData(data);
          setError('');
          setUpgrade(null);
        }
      })
      .catch((e) => {
        if (active) {
          setError(messageOf(e));
          setUpgrade(entitlementFailure(e));
        }
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [depth, range, version]);
  return (
    <main>
      <p className="eyebrow">YOUR PRACTICE IN PERSPECTIVE</p>
      <h1>Analytics</h1>
      <div className="grid">
        <label>
          Analytics depth
          <select value={depth} onChange={(e) => setDepth(e.target.value)}>
            <option value="basic">Overview</option>
            <option value="advanced">Advanced</option>
          </select>
        </label>
        <label>
          From (UTC)
          <input
            type="date"
            value={range.from}
            onChange={(e) => setRange({ ...range, from: e.target.value })}
          />
        </label>
        <label>
          Through (UTC)
          <input
            type="date"
            value={range.to}
            onChange={(e) => setRange({ ...range, to: e.target.value })}
          />
        </label>
      </div>
      <button className="secondary" disabled={busy} onClick={() => setVersion((n) => n + 1)}>
        Refresh analytics
      </button>
      {busy && <p role="status">Loading analytics…</p>}
      {upgrade ? (
        <UpgradePrompt feature={upgrade.feature} onDismiss={() => setUpgrade(null)} />
      ) : (
        error && (
          <p className="error" role="alert">
            {error}
          </p>
        )
      )}
      {data && (
        <>
          <p className="muted">
            Showing {data.depth} data ·{' '}
            {new Date(data.range.from).toLocaleDateString('en-IN', { timeZone: 'UTC' })} to{' '}
            {new Date(new Date(data.range.to).getTime() - 1).toLocaleDateString()} · monthly
            grouping in {data.range.timezone}.
          </p>
          <div className="grid">
            <article className="card">
              <h2>Collected revenue</h2>
              <p>{money(data.totals.revenuePaise)}</p>
              <small>
                Captured payments, including pending refund review; excludes refunded and failed
                payments.
              </small>
            </article>
            <article className="card">
              <h2>Active clients</h2>
              <p>{data.activeClients}</p>
              <small>Current active client records.</small>
            </article>
            <article className="card">
              <h2>No-show rate</h2>
              <p>{data.attendance.noShowRate.toFixed(1)}%</p>
              <small>
                {data.attendance.noShows} no-shows / {data.attendance.outcomes} finalized outcomes.
                Cancelled and unresolved sessions are excluded.
              </small>
            </article>
          </div>
          <section className="card">
            <h2>Revenue trend</h2>
            {data.revenueTrend.length ? (
              <>
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <LineChart data={data.revenueTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis tickFormatter={(value) => money(value)} />
                      <Tooltip formatter={(value) => money(value)} />
                      <Legend />
                      <Line
                        dataKey="revenuePaise"
                        name="Collected"
                        stroke="#245e50"
                        strokeWidth={2}
                      />
                      {data.depth === 'advanced' && (
                        <Line dataKey="netPaise" name="Net after platform fee" stroke="#817043" />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th>Revenue</th>
                        {data.depth === 'advanced' && (
                          <>
                            <th>Net amount</th>
                            <th>Platform fees</th>
                            <th>Payments</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {data.revenueTrend.map((row) => (
                        <tr key={row.period}>
                          <td>{row.period}</td>
                          <td>{money(row.revenuePaise)}</td>
                          {data.depth === 'advanced' && (
                            <>
                              <td>{money(row.netPaise)}</td>
                              <td>{money(row.feesPaise)}</td>
                              <td>{row.payments}</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p>No captured payments in this range.</p>
            )}
          </section>
          {data.attendanceTrend && (
            <section className="card">
              <h2>Attendance trend</h2>
              {data.attendanceTrend.length ? (
                <div style={{ width: '100%', height: 260 }}>
                  <ResponsiveContainer>
                    <LineChart data={data.attendanceTrend}>
                      <XAxis dataKey="period" />
                      <YAxis unit="%" />
                      <Tooltip />
                      <Line dataKey="noShowRate" name="No-show rate (%)" stroke="#245e50" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p>No finalized session outcomes in this range.</p>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}
