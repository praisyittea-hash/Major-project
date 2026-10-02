import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../context/AuthContext.jsx';
import api, { messageOf } from '../../api/axiosInstance.js';
export default function PackageManager() {
  const { therapist } = useAuth();
  const [data, setData] = useState(null),
    [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm();
  async function load() {
    try {
      const result = await api.get('/packages');
      setData(result.data);
    } catch (e) {
      setError(messageOf(e));
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function create(values) {
    try {
      await api.post('/packages', {
        ...values,
        sessionCount: Number(values.sessionCount),
        amount: Math.round(Number(values.amount) * 100),
        expiryDays: Number(values.expiryDays),
      });
      reset();
      await load();
      setError('');
    } catch (e) {
      setError(messageOf(e));
    }
  }
  async function archive(id) {
    try {
      await api.delete(`/packages/${id}`);
      await load();
    } catch (e) {
      setError(messageOf(e));
    }
  }
  return (
    <section className="card">
      <h2>Session packages</h2>
      {error && <p className="error">{error}</p>}
      {data?.packages.map((p) => (
        <div key={p._id} className="row">
          <p>
            {p.name} · {p.sessionCount} sessions · INR {(p.amount / 100).toFixed(2)} ·{' '}
            {p.expiryDays} days · {p.active ? 'available' : 'archived'}
          </p>
          {p.active && (
            <button className="secondary" onClick={() => archive(p._id)}>
              Archive
            </button>
          )}
        </div>
      ))}
      {data && (
        <form onSubmit={handleSubmit(create)}>
          <h3>Add a package</h3>
          <div className="grid">
            <label>
              Name
              <input {...register('name')} required minLength={2} />
            </label>
            <label>
              Service
              <select {...register('serviceId')} required>
                {therapist.services.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Sessions
              <select {...register('sessionCount')}>
                {data.options.counts.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label>
              Total price (INR)
              <input type="number" step="0.01" min="1" {...register('amount')} required />
            </label>
            <label>
              Expires after (days)
              <input
                type="number"
                min="1"
                max="730"
                defaultValue={data.options.expiryDays}
                {...register('expiryDays')}
                required
              />
            </label>
          </div>
          <button disabled={isSubmitting || !therapist.services.length}>Create package</button>
          {!therapist.services.length && <p>Add a service in your profile first.</p>}
        </form>
      )}
    </section>
  );
}
