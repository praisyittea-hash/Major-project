import Session from '../models/Session.js';
import mongoose from 'mongoose';
import Payment from '../models/Payment.js';
import Client from '../models/Client.js';
import Therapist from '../models/Therapist.js';
import { HttpError } from '../middleware/errorHandler.js';
export function analyticsWindow(query, now = new Date()) {
  const from = query.from
    ? new Date(`${query.from}T00:00:00Z`)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const to = query.to
    ? new Date(new Date(`${query.to}T00:00:00Z`).getTime() + 86400000)
    : new Date(now.getTime() + 1);
  if (
    !Number.isFinite(from.getTime()) ||
    !Number.isFinite(to.getTime()) ||
    from >= to ||
    to - from > 366 * 86400000
  )
    throw new HttpError(400, 'Choose a valid analytics range of at most 366 days');
  return { from, to };
}
export function revenuePipeline(therapist, from, to, timezone) {
  return [
    {
      $match: {
        therapist,
        status: { $in: ['captured', 'refund_required'] },
        capturedAt: { $gte: from, $lt: to },
      },
    },
    {
      $group: {
        _id: { $dateToString: { date: '$capturedAt', format: '%Y-%m', timezone } },
        revenuePaise: { $sum: '$amount' },
        netPaise: { $sum: '$net_amount' },
        feesPaise: { $sum: '$platform_fee' },
        payments: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: { _id: 0, period: '$_id', revenuePaise: 1, netPaise: 1, feesPaise: 1, payments: 1 },
    },
  ];
}
export async function practiceAnalytics(therapistId, query) {
  const therapist = new mongoose.Types.ObjectId(therapistId),
    { from, to } = analyticsWindow(query);
  const account = await Therapist.findById(therapist).select('timezone');
  const [revenueTrend, clients, totals, attendance] = await Promise.all([
    Payment.aggregate(revenuePipeline(therapist, from, to, account.timezone)),
    Client.aggregate([{ $match: { therapist, status: 'active' } }, { $count: 'count' }]),
    Payment.aggregate([
      {
        $match: {
          therapist,
          status: { $in: ['captured', 'refund_required'] },
          capturedAt: { $gte: from, $lt: to },
        },
      },
      {
        $group: {
          _id: null,
          revenuePaise: { $sum: '$amount' },
          netPaise: { $sum: '$net_amount' },
          payments: { $sum: 1 },
        },
      },
      { $project: { _id: 0 } },
    ]),
    Session.aggregate(
      noShowPipeline(therapist, from, to, account.timezone, query.depth === 'advanced'),
    ),
  ]);
  const advanced = query.depth === 'advanced';
  return {
    depth: advanced ? 'advanced' : 'basic',
    range: { from, to, timezone: account.timezone },
    currency: 'INR',
    attendance: attendance[0]?.totals[0] || { outcomes: 0, noShows: 0, noShowRate: 0 },
    ...(advanced ? { attendanceTrend: attendance[0]?.trend || [] } : {}),
    activeClients: clients[0]?.count || 0,
    totals: totals[0] || { revenuePaise: 0, netPaise: 0, payments: 0 },
    revenueTrend: advanced
      ? revenueTrend
      : revenueTrend.map(({ period, revenuePaise }) => ({ period, revenuePaise })),
  };
}

export function noShowPipeline(therapist, from, to, timezone, advanced) {
  const group = (id) => ({
    $group: {
      _id: id,
      outcomes: { $sum: 1 },
      noShows: { $sum: { $cond: [{ $eq: ['$status', 'no_show'] }, 1, 0] } },
    },
  });
  const rate = {
    $addFields: {
      noShowRate: {
        $cond: [
          { $gt: ['$outcomes', 0] },
          { $multiply: [{ $divide: ['$noShows', '$outcomes'] }, 100] },
          0,
        ],
      },
    },
  };
  return [
    {
      $match: {
        therapist,
        start: { $gte: from, $lt: to },
        end: { $lte: new Date() },
        status: { $in: ['completed', 'no_show'] },
      },
    },
    {
      $facet: {
        totals: [group(null), rate, { $project: { _id: 0 } }],
        trend: advanced
          ? [
              group({ $dateToString: { date: '$start', format: '%Y-%m', timezone } }),
              rate,
              { $sort: { _id: 1 } },
              { $project: { _id: 0, period: '$_id', outcomes: 1, noShows: 1, noShowRate: 1 } },
            ]
          : [{ $match: { _id: null } }],
      },
    },
  ];
}
