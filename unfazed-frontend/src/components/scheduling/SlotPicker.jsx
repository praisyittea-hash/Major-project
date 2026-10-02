import { formatInTimeZone } from 'date-fns-tz';
export default function SlotPicker({ slots, selected, onSelect, timezone }) {
  return (
    <div className="card">
      <h2>Available times</h2>
      <p className="muted">Displayed in {timezone}. Select a time to continue.</p>
      {slots.length ? (
        <div className="grid">
          {slots.map((slot) => (
            <button
              key={slot.start}
              className={selected?.start === slot.start ? '' : 'secondary'}
              aria-pressed={selected?.start === slot.start}
              onClick={() => onSelect(slot)}
            >
              {formatInTimeZone(new Date(slot.start), timezone, 'EEE, d MMM · h:mm a')}
            </button>
          ))}
        </div>
      ) : (
        <p>No times available in this date range. Try another date.</p>
      )}
    </div>
  );
}
