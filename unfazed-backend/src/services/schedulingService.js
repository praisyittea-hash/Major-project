import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import Availability from '../models/Availability.js';
import Session from '../models/Session.js';
import { HttpError } from '../middleware/errorHandler.js';
export function assertWeekly(weekly) {
  if (!Array.isArray(weekly) || weekly.length > 7)
    throw new HttpError(400, 'Provide at most seven weekly days');
  const days = new Set();
  for (const entry of weekly) {
    if (!Number.isInteger(entry.day) || entry.day < 0 || entry.day > 6 || days.has(entry.day))
      throw new HttpError(400, 'Weekly days must be unique (0–6)');
    days.add(entry.day);
    assertWindows(entry.windows);
  }
  return true;
}
export function assertWindows(windows) {
  if (!Array.isArray(windows) || windows.length > 12)
    throw new HttpError(400, 'Invalid availability windows');
  const ordered = [...windows].sort((a, b) => String(a.start).localeCompare(String(b.start)));
  for (let i = 0; i < ordered.length; i++) {
    const w = ordered[i];
    if (
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(w.start) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(w.end) ||
      w.start >= w.end ||
      (i > 0 && ordered[i - 1].end > w.start)
    )
      throw new HttpError(400, 'Windows must have valid times and cannot overlap');
  }
  return true;
}
export function conflict(candidate, existing) {
  return (
    new Date(candidate.start) <
      new Date(new Date(existing.end).getTime() + (existing.bufferMinutes || 0) * 60000) &&
    new Date(candidate.end).getTime() + (candidate.bufferMinutes || 0) * 60000 >
      new Date(existing.start).getTime()
  );
}
export async function availableSlots(therapist, startDate, endDate, duration, dbSession = null) {
  const start = new Date(`${startDate}T00:00:00Z`),
    end = new Date(`${endDate}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(endDate) ||
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(end.getTime()) ||
    end < start ||
    end - start > 31 * 86400000
  )
    throw new HttpError(400, 'Choose a date range of at most 31 days');
  const availability = await Availability.findOne({ therapist }).session(dbSession);
  if (!availability || !availability.durations.includes(duration)) return [];
  const booked = await Session.find({
    therapist,
    status: { $in: ['confirmed', 'pending_payment', 'completed'] },
    $or: [
      { holdExpiresAt: { $exists: false } },
      { holdExpiresAt: { $gt: new Date() } },
      { status: { $ne: 'pending_payment' } },
    ],
    start: { $lte: new Date(end.getTime() + 2 * 86400000) },
    end: { $gte: new Date(start.getTime() - 2 * 86400000) },
  }).session(dbSession);
  const slots = [];
  for (let day = start; day <= end; day = new Date(day.getTime() + 86400000)) {
    const date = day.toISOString().slice(0, 10);
    const override = availability.overrides.find((o) => o.date === date);
    const windows = override
      ? override.blocked
        ? []
        : override.windows
      : availability.weekly.find((w) => w.day === day.getUTCDay())?.windows || [];
    for (const window of windows) {
      const begin = fromZonedTime(`${date}T${window.start}:00`, availability.timezone),
        finish = fromZonedTime(`${date}T${window.end}:00`, availability.timezone);
      if (
        formatInTimeZone(begin, availability.timezone, 'HH:mm') !== window.start ||
        formatInTimeZone(finish, availability.timezone, 'HH:mm') !== window.end
      )
        continue;
      for (
        let time = begin.getTime();
        time + (duration + availability.bufferMinutes) * 60000 <= finish.getTime();
        time += 15 * 60000
      ) {
        const slot = {
          start: new Date(time),
          end: new Date(time + duration * 60000),
          duration,
          bufferMinutes: availability.bufferMinutes,
        };
        if (
          slot.start <= new Date() ||
          booked.some((existing) => conflict(slot, existing)) ||
          availability.blocked.some((block) => conflict(slot, block))
        )
          continue;
        slots.push({ start: slot.start.toISOString(), end: slot.end.toISOString(), duration });
      }
    }
  }
  return slots;
}
