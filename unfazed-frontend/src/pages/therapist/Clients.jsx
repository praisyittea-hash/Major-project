import UpgradePrompt, { entitlementFailure } from '../../components/subscription/UpgradePrompt.jsx';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import api, { messageOf } from '../../api/axiosInstance.js';
import ClientTable from '../../components/crm/ClientTable.jsx';
import useEntitlement from '../../hooks/useEntitlement.js';
export default function Clients() {
  const [upgrade, setUpgrade] = useState(null);
  const [clients, setClients] = useState([]),
    [filter, setFilter] = useState({
      search: '',
      status: 'active',
      tag: '',
      sort: 'name',
      direction: 'asc',
      page: 1,
    }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [total, setTotal] = useState(0),
    [version, setVersion] = useState(0);
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm();
  const access = useEntitlement('crm');
  useEffect(() => {
    let active = true;
    setLoading(true);
    const timer = setTimeout(
      () =>
        api
          .get('/clients', {
            params: Object.fromEntries(Object.entries(filter).filter(([, v]) => v !== '')),
          })
          .then(({ data }) => {
            if (active) {
              setClients(data.clients);
              setTotal(data.total);
              setError('');
            }
          })
          .catch((e) => {
            if (active) setError(messageOf(e));
          })
          .finally(() => {
            if (active) setLoading(false);
          }),
      200,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [filter, version]);
  function set(key, value) {
    setFilter((f) => ({ ...f, [key]: value, page: 1 }));
  }
  async function create(values) {
    setError('');
    try {
      await api.post('/clients', {
        ...values,
        tags: values.tags
          .split(',')
          .map((label) => ({ label: label.trim() }))
          .filter((t) => t.label),
      });
      reset();
      setVersion((v) => v + 1);
    } catch (e) {
      setError(messageOf(e));
      setUpgrade(entitlementFailure(e));
    }
  }
  if (access.loading) return <main>Loading client access…</main>;
  if (!access.allowed)
    return (
      <main>
        <UpgradePrompt feature="crm" />
      </main>
    );
  return (
    <main>
      <p className="eyebrow">PEOPLE AT THE HEART OF YOUR PRACTICE</p>
      <h1>Your clients</h1>
      {upgrade && <UpgradePrompt feature={upgrade.feature} onDismiss={() => setUpgrade(null)} />}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <section className="card">
        <div className="grid">
          <label>
            Search by name
            <input value={filter.search} onChange={(e) => set('search', e.target.value)} />
          </label>
          <label>
            Status
            <select value={filter.status} onChange={(e) => set('status', e.target.value)}>
              <option value="">All</option>
              {['active', 'inactive', 'archived'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Filter by tag
            <input value={filter.tag} onChange={(e) => set('tag', e.target.value)} />
          </label>
        </div>
        {loading ? (
          <p aria-busy="true">Loading clients…</p>
        ) : (
          <ClientTable
            clients={clients}
            sort={filter.sort}
            direction={filter.direction}
            onSort={(key) =>
              setFilter((f) => ({
                ...f,
                sort: key,
                direction: f.sort === key && f.direction === 'asc' ? 'desc' : 'asc',
                page: 1,
              }))
            }
          />
        )}
        <p>{total} clients</p>
        <div className="row">
          <button
            className="secondary"
            disabled={filter.page === 1}
            onClick={() => setFilter((f) => ({ ...f, page: f.page - 1 }))}
          >
            Previous
          </button>
          <span>Page {filter.page}</span>
          <button
            className="secondary"
            disabled={filter.page * 50 >= total}
            onClick={() => setFilter((f) => ({ ...f, page: f.page + 1 }))}
          >
            Next
          </button>
        </div>
      </section>
      <form className="card" onSubmit={handleSubmit(create)}>
        <h2>Add a client</h2>
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
            Tags (comma separated)
            <input {...register('tags')} defaultValue="" />
          </label>
        </div>
        <button disabled={isSubmitting}>{isSubmitting ? 'Adding…' : 'Add client'}</button>
      </form>
    </main>
  );
}
