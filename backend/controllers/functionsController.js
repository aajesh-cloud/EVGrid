/**
 * Multi-table operations that the frontend calls through `/functions/*`.
 *
 * Each handler runs inside a single database transaction so a partial write
 * (for example a session created but its payment missing) can never happen.
 *
 * See docs/BACKEND-ENDPOINTS.md §5.
 */

import { queryOne, txQuery, txQueryOne, withTransaction } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { isStaff } from '../utils/access.js';
import { newId, newInvoiceNumber, newTransactionRef } from '../utils/ids.js';
import { getResource } from '../utils/registry.js';
import { serialiseRow } from '../utils/serialize.js';
import { requireString } from '../utils/validate.js';

const SESSION_RESOURCE = getResource('charging-sessions');
const PAYMENT_RESOURCE = getResource('payments');

const PAYMENT_METHODS = ['upi', 'card', 'wallet', 'netbanking', 'cash'];
const BOOKING_CONFLICT_STATUSES = ['pending', 'confirmed', 'active'];

const round2 = (value) => Math.round(Number(value) * 100) / 100;

/** "09:30" | "09:30:00" -> 570 minutes past midnight. */
function toMinutes(value) {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value ?? ''));
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function durationBetween(startTime, endTime) {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  if (start === null || end === null) return null;
  const diff = end - start;
  return diff >= 0 ? diff : diff + 24 * 60; // slot crossing midnight
}

/** Only the caller's own rows, unless the caller is staff. */
function requireOwnership(resource, row, user, label) {
  if (!row) throw ApiError.notFound(`${label} not found.`);
  const scopeColumn = resource?.ownerColumn;
  if (!scopeColumn || isStaff(user)) return row;
  if (String(row[scopeColumn]) !== String(user.id)) {
    throw ApiError.forbidden(`You do not have access to this ${label.toLowerCase()}.`);
  }
  return row;
}

/* ------------------------------------------------------------------ */
/* POST /functions/create-booking                                     */
/* ------------------------------------------------------------------ */

export const createBooking = asyncHandler(async (req, res) => {
  const user = req.user;
  const stationId = requireString(req.body?.station_id, 'station_id', { min: 1, max: 64 });
  const pointId = requireString(req.body?.point_id, 'point_id', { min: 1, max: 64 });
  const bookingDate = requireString(req.body?.booking_date, 'booking_date', { min: 8, max: 32 });
  const startTime = requireString(req.body?.start_time, 'start_time', { min: 4, max: 8 });
  const endTime = requireString(req.body?.end_time, 'end_time', { min: 4, max: 8 });
  const vehicleId = req.body?.vehicle_id ? String(req.body.vehicle_id) : null;
  const notes = req.body?.notes ? String(req.body.notes) : null;

  const booking = await withTransaction(async (connection) => {
    const one = (sql, params) => txQueryOne(connection, sql, params);
    const run = (sql, params) => txQuery(connection, sql, params);

    const station = await one('SELECT * FROM `charging_stations` WHERE `id` = ? LIMIT 1', [stationId]);
    if (!station) throw ApiError.notFound('That charging station could not be found.');

    const point = await one('SELECT * FROM `charging_points` WHERE `id` = ? LIMIT 1', [pointId]);
    if (!point) throw ApiError.notFound('That charging point could not be found.');
    if (String(point.station_id) !== String(stationId)) {
      throw ApiError.badRequest('The selected charging point does not belong to that station.');
    }
    if (['offline', 'maintenance'].includes(point.status)) {
      throw ApiError.conflict(`Charging point ${point.code} is currently ${point.status}.`);
    }

    const clash = await one(
      `SELECT \`id\` FROM \`bookings\`
        WHERE \`point_id\` = ? AND \`booking_date\` = ?
          AND \`status\` IN (${BOOKING_CONFLICT_STATUSES.map(() => '?').join(', ')})
          AND \`start_time\` < ? AND \`end_time\` > ?
        LIMIT 1`,
      [pointId, bookingDate, ...BOOKING_CONFLICT_STATUSES, endTime, startTime]
    );
    if (clash) {
      throw ApiError.conflict('That charging point is already booked for an overlapping slot.');
    }

    let vehicleLabel = null;
    if (vehicleId) {
      const vehicle = await one('SELECT * FROM `vehicles` WHERE `id` = ? LIMIT 1', [vehicleId]);
      if (!vehicle) throw ApiError.badRequest('The selected vehicle could not be found.');
      if (!isStaff(user) && String(vehicle.user_id) !== String(user.id)) {
        throw ApiError.forbidden('The selected vehicle belongs to another account.');
      }
      vehicleLabel = [vehicle.make, vehicle.model].filter(Boolean).join(' ');
    }

    const duration = durationBetween(startTime, endTime);
    const providedEnergy = Number(req.body?.estimated_energy_kwh);
    const energyKwh = Number.isFinite(providedEnergy) && providedEnergy > 0
      ? round2(providedEnergy)
      : duration
        ? round2(Number(point.power_kw || 0) * (duration / 60))
        : null;
    const estimatedCost = energyKwh ? round2(energyKwh * Number(station.price_per_kwh || 0)) : null;

    const id = newId();
    await run(
      `INSERT INTO \`bookings\`
         (\`id\`, \`user_id\`, \`user_name\`, \`station_id\`, \`station_name\`, \`point_id\`, \`point_code\`,
          \`vehicle_id\`, \`vehicle_label\`, \`booking_date\`, \`start_time\`, \`end_time\`,
          \`duration_minutes\`, \`estimated_energy_kwh\`, \`estimated_cost\`, \`status\`, \`notes\`)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?)`,
      [
        id,
        user.id,
        user.full_name || user.email,
        stationId,
        station.name,
        pointId,
        point.code,
        vehicleId,
        vehicleLabel,
        bookingDate,
        startTime,
        endTime,
        duration,
        energyKwh,
        estimatedCost,
        notes,
      ]
    );

    if (point.status === 'available') {
      await run('UPDATE `charging_points` SET `status` = ? WHERE `id` = ?', ['reserved', pointId]);
    }

    await run(
      `INSERT INTO \`notifications\` (\`id\`, \`user_id\`, \`title\`, \`message\`, \`type\`, \`link\`)
       VALUES (?, ?, ?, ?, 'booking', ?)`,
      [
        newId(),
        user.id,
        'Booking confirmed',
        `${station.name} · ${point.code} on ${bookingDate} from ${startTime} to ${endTime}.`,
        '/bookings',
      ]
    );

    return one('SELECT * FROM `bookings` WHERE `id` = ? LIMIT 1', [id]);
  });

  const resource = getResource('bookings');
  res.status(201).json({
    booking: await serialiseRow('bookings', booking, resource),
    message: 'Booking confirmed.',
  });
});

/* ------------------------------------------------------------------ */
/* POST /functions/charging-session                                   */
/* ------------------------------------------------------------------ */

export const chargingSession = asyncHandler(async (req, res) => {
  const action = requireString(req.body?.action, 'action', { min: 4, max: 16 }).toLowerCase();
  if (action === 'start') return startSession(req, res);
  if (action === 'stop') return stopSession(req, res);
  throw ApiError.badRequest('"action" must be either "start" or "stop".', {
    field: 'action',
    allowed: ['start', 'stop'],
  });
});

async function startSession(req, res) {
  const user = req.user;
  const bookingId = req.body?.booking_id ? String(req.body.booking_id) : null;
  const pointId = req.body?.point_id ? String(req.body.point_id) : null;

  if (!bookingId && !pointId) {
    throw ApiError.badRequest('Provide either a "booking_id" or a "point_id" to start a session.', {
      fields: ['booking_id', 'point_id'],
    });
  }

  const session = await withTransaction(async (connection) => {
    const one = (sql, params) => txQueryOne(connection, sql, params);
    const run = (sql, params) => txQuery(connection, sql, params);

    let booking = null;
    let point = null;
    let station = null;

    if (bookingId) {
      booking = await one('SELECT * FROM `bookings` WHERE `id` = ? LIMIT 1', [bookingId]);
      requireOwnership(getResource('bookings'), booking, user, 'Booking');
      if (!['pending', 'confirmed'].includes(booking.status)) {
        throw ApiError.conflict(`A booking with status "${booking.status}" cannot be started.`);
      }
      point = await one('SELECT * FROM `charging_points` WHERE `id` = ? LIMIT 1', [booking.point_id]);
      station = booking.station_id
        ? await one('SELECT * FROM `charging_stations` WHERE `id` = ? LIMIT 1', [booking.station_id])
        : null;
    } else {
      point = await one('SELECT * FROM `charging_points` WHERE `id` = ? LIMIT 1', [pointId]);
      if (!point) throw ApiError.notFound('That charging point could not be found.');
      station = point.station_id
        ? await one('SELECT * FROM `charging_stations` WHERE `id` = ? LIMIT 1', [point.station_id])
        : null;
    }

    if (point && ['occupied', 'offline', 'maintenance'].includes(point.status)) {
      throw ApiError.conflict(`Charging point ${point.code} is currently ${point.status}.`);
    }

    const existing = point
      ? await one(
          `SELECT \`id\` FROM \`charging_sessions\` WHERE \`point_id\` = ? AND \`status\` = 'in_progress' LIMIT 1`,
          [point.id]
        )
      : null;
    if (existing) throw ApiError.conflict('A charging session is already in progress on this point.');

    const id = newId();
    await run(
      `INSERT INTO \`charging_sessions\`
         (\`id\`, \`booking_id\`, \`user_id\`, \`station_id\`, \`station_name\`, \`point_id\`, \`point_code\`,
          \`vehicle_id\`, \`vehicle_label\`, \`start_time\`, \`status\`)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'in_progress')`,
      [
        id,
        booking?.id ?? null,
        booking?.user_id ?? user.id,
        booking?.station_id ?? point?.station_id ?? null,
        booking?.station_name ?? station?.name ?? null,
        point?.id ?? null,
        booking?.point_code ?? point?.code ?? null,
        booking?.vehicle_id ?? null,
        booking?.vehicle_label ?? null,
      ]
    );

    if (point) {
      await run('UPDATE `charging_points` SET `status` = ? WHERE `id` = ?', ['occupied', point.id]);
    }
    if (booking) {
      await run('UPDATE `bookings` SET `status` = ? WHERE `id` = ?', ['active', booking.id]);
    }

    return one('SELECT * FROM `charging_sessions` WHERE `id` = ? LIMIT 1', [id]);
  });

  res.status(201).json({
    session: await serialiseRow('charging_sessions', session, SESSION_RESOURCE),
    message: 'Charging session started.',
  });
}

async function stopSession(req, res) {
  const user = req.user;
  const sessionId = requireString(req.body?.session_id, 'session_id', { min: 1, max: 64 });

  const result = await withTransaction(async (connection) => {
    const one = (sql, params) => txQueryOne(connection, sql, params);
    const run = (sql, params) => txQuery(connection, sql, params);

    const session = await one('SELECT * FROM `charging_sessions` WHERE `id` = ? LIMIT 1', [sessionId]);
    requireOwnership(SESSION_RESOURCE, session, user, 'Charging session');
    if (session.status !== 'in_progress') {
      throw ApiError.conflict(`A session with status "${session.status}" cannot be stopped.`);
    }

    const durationRow = await one(
      'SELECT GREATEST(TIMESTAMPDIFF(MINUTE, `start_time`, NOW()), 0) AS `duration` FROM `charging_sessions` WHERE `id` = ?',
      [sessionId]
    );
    const duration = Number(durationRow?.duration || 0);

    const point = session.point_id
      ? await one('SELECT * FROM `charging_points` WHERE `id` = ? LIMIT 1', [session.point_id])
      : null;
    const station = session.station_id
      ? await one('SELECT * FROM `charging_stations` WHERE `id` = ? LIMIT 1', [session.station_id])
      : null;

    const providedEnergy = Number(req.body?.energy_kwh);
    const energyKwh = Number.isFinite(providedEnergy) && providedEnergy > 0
      ? round2(providedEnergy)
      : round2(Number(point?.power_kw || 0) * (duration / 60));

    const providedCost = Number(req.body?.cost);
    const cost = Number.isFinite(providedCost) && providedCost >= 0
      ? round2(providedCost)
      : round2(energyKwh * Number(station?.price_per_kwh || 0));

    await run(
      `UPDATE \`charging_sessions\`
          SET \`end_time\` = NOW(), \`duration_minutes\` = ?, \`energy_kwh\` = ?, \`cost\` = ?,
              \`status\` = 'completed'
        WHERE \`id\` = ?`,
      [duration, energyKwh, cost, sessionId]
    );

    if (point && point.status === 'occupied') {
      await run('UPDATE `charging_points` SET `status` = ? WHERE `id` = ?', ['available', point.id]);
    }
    if (session.booking_id) {
      await run('UPDATE `bookings` SET `status` = ? WHERE `id` = ?', ['completed', session.booking_id]);
    }

    const paymentId = newId();
    await run(
      `INSERT INTO \`payments\`
         (\`id\`, \`session_id\`, \`booking_id\`, \`user_id\`, \`station_id\`, \`station_name\`,
          \`invoice_number\`, \`amount\`, \`energy_kwh\`, \`status\`)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        paymentId,
        sessionId,
        session.booking_id ?? null,
        session.user_id,
        session.station_id ?? null,
        session.station_name ?? station?.name ?? null,
        newInvoiceNumber(),
        cost,
        energyKwh,
      ]
    );

    const updatedSession = await one('SELECT * FROM `charging_sessions` WHERE `id` = ? LIMIT 1', [sessionId]);
    const payment = await one('SELECT * FROM `payments` WHERE `id` = ? LIMIT 1', [paymentId]);
    return { updatedSession, payment };
  });

  res.json({
    session: await serialiseRow('charging_sessions', result.updatedSession, SESSION_RESOURCE),
    payment: await serialiseRow('payments', result.payment, PAYMENT_RESOURCE),
    message: 'Charging session completed and invoice generated.',
  });
}

/* ------------------------------------------------------------------ */
/* POST /functions/process-payment                                    */
/* ------------------------------------------------------------------ */

export const processPayment = asyncHandler(async (req, res) => {
  const user = req.user;
  const paymentId = requireString(req.body?.payment_id, 'payment_id', { min: 1, max: 64 });
  const action = req.body?.action ? String(req.body.action).toLowerCase() : 'settle';

  const payment = await queryOne('SELECT * FROM `payments` WHERE `id` = ? LIMIT 1', [paymentId]);
  requireOwnership(PAYMENT_RESOURCE, payment, user, 'Payment');

  if (action === 'refund') {
    if (!isStaff(user)) throw ApiError.forbidden('Only staff can issue a refund.');
    if (payment.status !== 'paid') {
      throw ApiError.conflict('Only a settled payment can be refunded.');
    }
    await withTransaction((connection) =>
      txQuery(connection, `UPDATE \`payments\` SET \`status\` = 'refunded' WHERE \`id\` = ?`, [paymentId])
    );
  } else if (action === 'settle') {
    const method = requireString(req.body?.method, 'method', { min: 2, max: 16 }).toLowerCase();
    if (!PAYMENT_METHODS.includes(method)) {
      throw ApiError.badRequest(`"method" must be one of: ${PAYMENT_METHODS.join(', ')}.`, {
        field: 'method',
        allowed: PAYMENT_METHODS,
      });
    }
    if (payment.status !== 'pending') {
      throw ApiError.conflict(`A payment with status "${payment.status}" cannot be settled.`);
    }

    await withTransaction(async (connection) => {
      await txQuery(
        connection,
        `UPDATE \`payments\`
            SET \`status\` = 'paid', \`method\` = ?, \`paid_date\` = NOW(), \`transaction_ref\` = ?,
                \`invoice_number\` = COALESCE(\`invoice_number\`, ?)
          WHERE \`id\` = ?`,
        [method, newTransactionRef(), newInvoiceNumber(), paymentId]
      );
    });
  } else {
    throw ApiError.badRequest('"action" must be either "settle" or "refund".', {
      field: 'action',
      allowed: ['settle', 'refund'],
    });
  }

  const updated = await queryOne('SELECT * FROM `payments` WHERE `id` = ? LIMIT 1', [paymentId]);
  res.json({
    payment: await serialiseRow('payments', updated, PAYMENT_RESOURCE),
    message: action === 'refund' ? 'Refund recorded.' : 'Payment settled.',
  });
});
