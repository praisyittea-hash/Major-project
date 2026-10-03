import { useEffect, useState } from 'react';
import api, { messageOf } from '../../api/axiosInstance.js';
import useEntitlement from '../../hooks/useEntitlement.js';
import Calendar from '../../components/scheduling/Calendar.jsx';
const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export default function Schedule() {
  const [availability, setAvailability] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState('');
  const [sessions, setSessions] = useState([]),
    [calendarDate, setCalendarDate] = useState(new Date());
  useEffect(() => {
    api
      .get('/scheduling/sessions')
      .then(({ data }) => setSessions(data.sessions))
      .catch((e) => setError(messageOf(e)));
  }, []);
  async function complete(id) {
    try {
      await api.post(`/scheduling/sessions/${id}/complete`);
      const { data } = await api.get('/scheduling/sessions');
      setSessions(data.sessions);
    } catch (e) {
      setError(messageOf(e));
    }
  }
  async function cancel(id) {
    setBusy(true);
    try {
      await api.post(`/scheduling/sessions/${id}/cancel`);
      const { data } = await api.get('/scheduling/sessions');
      setSessions(data.sessions);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  const access = useEntitlement('scheduling');
  useEffect(() => {
    api
      .get('/scheduling/availability')
      .then(({ data }) => setAvailability(data.availability))
      .catch((e) => setError(messageOf(e)));
  }, []);
  function set(key, value) {
    setAvailability((a) => ({ ...a, [key]: value }));
    setSaved('');
  }
  function updateDay(day, windows) {
    set('weekly', [...availability.weekly.filter((w) => w.day !== day), { day, windows }]);
  }
  async function save(path, body) {
    setBusy(true);
    setError('');
    setSaved('');
    try {
      const { data } = await api.put(path, body);
      setAvailability(data.availability);
      setSaved('Availability saved.');
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  if (access.loading) return <main>Loading scheduling access…</main>;
  if (!access.allowed) return <main>Scheduling is unavailable for your practice.</main>;
  if (!availability)
    return (
      <main>
        {error ? (
          <p role="alert" className="error">
            {error}
          </p>
        ) : (
          'Loading your schedule…'
        )}
      </main>
    );
  return (
    <main>
      <p className="eyebrow">MAKE ROOM FOR CARE</p>
      <h1>Your schedule</h1>
      <p className="muted">
        Hours are entered in your practice timezone. Clients see their local time.
      </p>
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
      <h2>Appointments</h2>
      <Calendar
        events={sessions
          .filter((s) => s.status !== 'cancelled')
          .map((s) => ({
            ...s,
            start: new Date(s.start),
            end: new Date(s.end),
            title: s.contact.name,
          }))}
        date={calendarDate}
        onNavigate={setCalendarDate}
      />
      <section className="card">
        {sessions.length ? (
          sessions.map((s) => (
            <div className="row" key={s._id}>
              <p>
                {s.contact.name} · {new Date(s.start).toLocaleString()} · {s.status}
              </p>
              {s.status === 'confirmed' && new Date(s.end) <= new Date() && (
                <button className="secondary" onClick={() => complete(s._id)}>
                  Mark completed
                </button>
              )}
              {s.status !== 'cancelled' && (
                <button className="secondary" disabled={busy} onClick={() => cancel(s._id)}>
                  Cancel session
                </button>
              )}
            </div>
          ))
        ) : (
          <p>No appointments yet.</p>
        )}
      </section>
      <section className="card">
        <h2>Session settings</h2>
        <div className="row">
          {[30, 45, 60, 90].map((d) => (
            <label key={d}>
              <input
                type="checkbox"
                checked={availability.durations.includes(d)}
                onChange={(e) =>
                  set(
                    'durations',
                    e.target.checked
                      ? [...availability.durations, d]
                      : availability.durations.filter((v) => v !== d),
                  )
                }
              />
              {d} minutes
            </label>
          ))}
        </div>
        <label>
          Buffer between sessions (minutes)
          <input
            type="number"
            min="0"
            max="120"
            value={availability.bufferMinutes}
            onChange={(e) => set('bufferMinutes', Number(e.target.value))}
          />
        </label>
        <button
          disabled={busy}
          onClick={() =>
            save('/scheduling/availability/settings', {
              durations: availability.durations,
              bufferMinutes: availability.bufferMinutes,
            })
          }
        >
          Save session settings
        </button>
      </section>
      <section className="card">
        <h2>Weekly hours</h2>
        <label>
          Practice timezone
          <input value={availability.timezone} onChange={(e) => set('timezone', e.target.value)} />
        </label>
        {days.map((day, i) => {
          const windows = availability.weekly.find((w) => w.day === i)?.windows || [];
          return (
            <div className="card" key={day}>
              <div className="row">
                <strong>{day}</strong>
                <button
                  className="secondary"
                  onClick={() => updateDay(i, [...windows, { start: '09:00', end: '17:00' }])}
                >
                  Add hours
                </button>
                {!windows.length && <span className="muted">Unavailable</span>}
              </div>
              {windows.map((w, j) => (
                <div className="row" key={j}>
                  <label>
                    From
                    <input
                      type="time"
                      value={w.start}
                      onChange={(e) =>
                        updateDay(
                          i,
                          windows.map((item, k) =>
                            k === j ? { ...item, start: e.target.value } : item,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    Until
                    <input
                      type="time"
                      value={w.end}
                      onChange={(e) =>
                        updateDay(
                          i,
                          windows.map((item, k) =>
                            k === j ? { ...item, end: e.target.value } : item,
                          ),
                        )
                      }
                    />
                  </label>
                  <button
                    className="secondary"
                    onClick={() =>
                      updateDay(
                        i,
                        windows.filter((_, k) => k !== j),
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          );
        })}
        <button
          disabled={busy}
          onClick={() =>
            save('/scheduling/availability/weekly', {
              weekly: availability.weekly,
              timezone: availability.timezone,
            })
          }
        >
          {busy ? 'Saving…' : 'Save weekly hours'}
        </button>
      </section>
      <section className="card">
        <h2>One-time changes</h2>
        <p className="muted">A date override replaces all regular hours for that date.</p>
        {availability.overrides.map((o, i) => (
          <div key={i} className="card">
            <div className="grid">
              <label>
                Date
                <input
                  type="date"
                  value={o.date}
                  onChange={(e) =>
                    set(
                      'overrides',
                      availability.overrides.map((v, j) =>
                        j === i ? { ...v, date: e.target.value } : v,
                      ),
                    )
                  }
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={o.blocked}
                  onChange={(e) =>
                    set(
                      'overrides',
                      availability.overrides.map((v, j) =>
                        j === i ? { ...v, blocked: e.target.checked } : v,
                      ),
                    )
                  }
                />
                Block entire day
              </label>
              {!o.blocked && (
                <>
                  <label>
                    From
                    <input
                      type="time"
                      value={o.windows[0]?.start || '09:00'}
                      onChange={(e) =>
                        set(
                          'overrides',
                          availability.overrides.map((v, j) =>
                            j === i
                              ? {
                                  ...v,
                                  windows: [
                                    { start: e.target.value, end: v.windows[0]?.end || '17:00' },
                                    ...v.windows.slice(1),
                                  ],
                                }
                              : v,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    Until
                    <input
                      type="time"
                      value={o.windows[0]?.end || '17:00'}
                      onChange={(e) =>
                        set(
                          'overrides',
                          availability.overrides.map((v, j) =>
                            j === i
                              ? {
                                  ...v,
                                  windows: [
                                    { start: v.windows[0]?.start || '09:00', end: e.target.value },
                                    ...v.windows.slice(1),
                                  ],
                                }
                              : v,
                          ),
                        )
                      }
                    />
                  </label>
                </>
              )}
            </div>
            <button
              className="secondary"
              onClick={() =>
                set(
                  'overrides',
                  availability.overrides.filter((_, j) => j !== i),
                )
              }
            >
              Remove override
            </button>
          </div>
        ))}
        <button
          className="secondary"
          onClick={() =>
            set('overrides', [
              ...availability.overrides,
              { date: '', blocked: false, windows: [{ start: '09:00', end: '17:00' }] },
            ])
          }
        >
          Add date override
        </button>
        <h3>Blocked times</h3>
        <p className="muted">Enter blocked times in your device timezone.</p>
        {availability.blocked.map((b, i) => (
          <div className="row" key={i}>
            <label>
              From
              <input
                type="datetime-local"
                onChange={(e) =>
                  e.target.value &&
                  set(
                    'blocked',
                    availability.blocked.map((v, j) =>
                      j === i ? { ...v, start: new Date(e.target.value).toISOString() } : v,
                    ),
                  )
                }
              />
            </label>
            <label>
              Until
              <input
                type="datetime-local"
                onChange={(e) =>
                  e.target.value &&
                  set(
                    'blocked',
                    availability.blocked.map((v, j) =>
                      j === i ? { ...v, end: new Date(e.target.value).toISOString() } : v,
                    ),
                  )
                }
              />
            </label>
            <span>
              {b.start && new Date(b.start).toLocaleString()} –{' '}
              {b.end && new Date(b.end).toLocaleString()}
            </span>
            <button
              className="secondary"
              onClick={() =>
                set(
                  'blocked',
                  availability.blocked.filter((_, j) => j !== i),
                )
              }
            >
              Remove
            </button>
          </div>
        ))}
        <p>
          <button
            className="secondary"
            onClick={() => set('blocked', [...availability.blocked, { start: '', end: '' }])}
          >
            Block a time
          </button>
        </p>
        <button
          disabled={busy}
          onClick={() =>
            save('/scheduling/availability/exceptions', {
              overrides: availability.overrides,
              blocked: availability.blocked,
            })
          }
        >
          Save exceptions
        </button>
      </section>
    </main>
  );
}
