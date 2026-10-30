/**
 * `npm run seed`
 *
 * Seeds a realistic Hyderabad (India) charging network so the app can be
 * exercised end-to-end — discover, station detail and the booking flow —
 * without an admin account:
 *
 *   • 3  operators          (operators)
 *   • 9  charging stations  (charging_stations, city = "Hyderabad")
 *   • 28 charging points    (charging_points, 3–4 per station)
 *   • 9  active tariffs     (tariffs, one per station)
 *
 * Re-running the script is safe: every row is matched on a stable natural key
 * (operator org_name / station name / station+point code / station+tariff name)
 * and updated in place, so no duplicates are created.
 *
 * The script only ever inserts or updates rows in the four tables listed above.
 * It never deletes anything, and it never touches `users`, `bookings`,
 * `payments`, `charging_sessions` or any other table — existing data is safe.
 */

import { createHash } from 'node:crypto';
import { query, txQuery, txQueryOne, withTransaction, closePool } from '../config/db.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CITY = 'Hyderabad';
const STATE = 'Telangana';

/** Reused image paths that already ship with the frontend. */
const IMAGES = [
  '/images/ev-charging1.webp',
  '/images/ev-charging2.jpg',
  '/images/ev-charging3.jpg',
];

/** Local-time `YYYY-MM-DD` (avoids the UTC day-shift for +05:30). */
function localDate(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const TODAY = localDate(0);
const LAST_SERVICED = localDate(-45);

const REQUIRED_TABLES = ['operators', 'charging_stations', 'charging_points', 'tariffs'];

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const OPERATORS = [
  {
    org_name: 'EVGrid Networks',
    contact_name: 'Arjun Reddy',
    email: 'network@evgrid.example',
    phone: '+91 40 4455 1200',
    commission_percent: 8.0,
  },
  {
    org_name: 'VoltUp Charging',
    contact_name: 'Priya Nair',
    email: 'ops@voltup.example',
    phone: '+91 40 4455 3400',
    commission_percent: 9.5,
  },
  {
    org_name: 'GreenDrive Mobility',
    contact_name: 'Sameer Khan',
    email: 'support@greendrive.example',
    phone: '+91 40 4455 7800',
    commission_percent: 7.5,
  },
];

const STATIONS = [
  {
    key: 'hitec-city-cyber-towers',
    name: 'Hitec City Cyber Towers EV Hub',
    address: 'Cyber Towers, Hitec City Main Road, Madhapur, Hyderabad, Telangana 500081',
    latitude: 17.450417,
    longitude: 78.38079,
    operator_name: 'EVGrid Networks',
    open_24h: 1,
    opening_hours: null,
    connector_types: ['CCS2', 'Type 2'],
    max_power_kw: 120,
    price_per_kwh: 19.5,
    amenities: ['Wi-Fi', 'Café', 'Restroom', 'Covered Parking', 'CCTV'],
    description:
      'High-throughput DC hub in the heart of Hitec City, a short walk from Cyber Towers and Mindspace. Ideal for a top-up during office hours.',
    rating: 4.7,
    review_count: 214,
    points: [
      { code: 'HTC-DC1', connector_type: 'CCS2', current_type: 'DC', power_kw: 120, status: 'available' },
      { code: 'HTC-DC2', connector_type: 'CCS2', current_type: 'DC', power_kw: 120, status: 'available' },
      { code: 'HTC-AC1', connector_type: 'Type 2', current_type: 'AC', power_kw: 22, status: 'available' },
    ],
  },
  {
    key: 'gachibowli-stadium',
    name: 'Gachibowli Stadium Charging Plaza',
    address: 'GMC Balayogi Athletic Stadium Road, Gachibowli, Hyderabad, Telangana 500032',
    latitude: 17.440124,
    longitude: 78.348935,
    operator_name: 'VoltUp Charging',
    open_24h: 1,
    opening_hours: null,
    connector_types: ['CCS2', 'CHAdeMO', 'Type 2'],
    max_power_kw: 150,
    price_per_kwh: 21.0,
    amenities: ['Restroom', 'Convenience Store', 'Open Air Parking', 'CCTV'],
    description:
      '150 kW ultra-fast plaza beside the Gachibowli stadium, serving the Financial District and University of Hyderabad corridor.',
    rating: 4.55,
    review_count: 168,
    points: [
      { code: 'GBL-DC1', connector_type: 'CCS2', current_type: 'DC', power_kw: 150, status: 'available' },
      { code: 'GBL-DC2', connector_type: 'CHAdeMO', current_type: 'DC', power_kw: 50, status: 'occupied' },
      { code: 'GBL-AC1', connector_type: 'Type 2', current_type: 'AC', power_kw: 22, status: 'available' },
    ],
  },
  {
    key: 'banjara-hills-road-12',
    name: 'Banjara Hills Road No. 12 ChargePoint',
    address: 'Road No. 12, Banjara Hills, Hyderabad, Telangana 500034',
    latitude: 17.412633,
    longitude: 78.439238,
    operator_name: 'EVGrid Networks',
    open_24h: 0,
    opening_hours: '06:00 – 23:00',
    connector_types: ['CCS2', 'Type 2'],
    max_power_kw: 60,
    price_per_kwh: 17.0,
    amenities: ['Café', 'Restroom', 'Street Parking', 'CCTV'],
    description:
      'Neighbourhood AC/DC combo point on Road No. 12, convenient for residents and shoppers around Banjara Hills and Jubilee Hills.',
    rating: 4.35,
    review_count: 96,
    points: [
      { code: 'BNH-AC1', connector_type: 'Type 2', current_type: 'AC', power_kw: 22, status: 'available' },
      { code: 'BNH-AC2', connector_type: 'Type 2', current_type: 'AC', power_kw: 22, status: 'available' },
      { code: 'BNH-DC1', connector_type: 'CCS2', current_type: 'DC', power_kw: 60, status: 'available' },
    ],
  },
  {
    key: 'jubilee-hills-check-post',
    name: 'Jubilee Hills Check Post Fast Charge',
    address: 'Road No. 36, Jubilee Hills Check Post, Hyderabad, Telangana 500033',
    latitude: 17.427042,
    longitude: 78.407531,
    operator_name: 'GreenDrive Mobility',
    open_24h: 1,
    opening_hours: null,
    connector_types: ['CCS2', 'Type 2'],
    max_power_kw: 100,
    price_per_kwh: 20.0,
    amenities: ['Wi-Fi', 'Restroom', 'Coffee Kiosk', 'CCTV'],
    description:
      'Two 100 kW CCS2 bays at the Jubilee Hills check post — a quick turnaround spot on the way to Film Nagar and Banjara Hills.',
    rating: 4.6,
    review_count: 143,
    points: [
      { code: 'JHC-DC1', connector_type: 'CCS2', current_type: 'DC', power_kw: 100, status: 'available' },
      { code: 'JHC-DC2', connector_type: 'CCS2', current_type: 'DC', power_kw: 100, status: 'available' },
      { code: 'JHC-AC1', connector_type: 'Type 2', current_type: 'AC', power_kw: 22, status: 'maintenance' },
    ],
  },
  {
    key: 'kondapur-botanical-garden',
    name: 'Kondapur Botanical Garden EV Station',
    address: 'Kondapur Main Road, near Botanical Garden, Hyderabad, Telangana 500084',
    latitude: 17.461523,
    longitude: 78.357094,
    operator_name: 'EVGrid Networks',
    open_24h: 0,
    opening_hours: '05:30 – 22:30',
    connector_types: ['Type 2', 'GB/T', 'CCS2'],
    max_power_kw: 50,
    price_per_kwh: 16.5,
    amenities: ['Restroom', 'Children Play Area', 'Parking', 'CCTV'],
    description:
      'Mixed-connector station beside the Kondapur Botanical Garden, with a GB/T bay for imported and commercial EVs.',
    rating: 4.2,
    review_count: 74,
    points: [
      { code: 'KDP-AC1', connector_type: 'Type 2', current_type: 'AC', power_kw: 22, status: 'available' },
      { code: 'KDP-AC2', connector_type: 'GB/T', current_type: 'DC', power_kw: 50, status: 'available' },
      { code: 'KDP-DC1', connector_type: 'CCS2', current_type: 'DC', power_kw: 50, status: 'available' },
    ],
  },
  {
    key: 'secunderabad-railway-station',
    name: 'Secunderabad Railway Station EV Park',
    address: 'Rail Nilayam Road, Secunderabad Railway Station, Hyderabad, Telangana 500003',
    latitude: 17.439901,
    longitude: 78.501544,
    operator_name: 'VoltUp Charging',
    open_24h: 1,
    opening_hours: null,
    connector_types: ['CCS2', 'CHAdeMO', 'Type 2'],
    max_power_kw: 120,
    price_per_kwh: 19.0,
    amenities: ['Wi-Fi', 'Restroom', 'Waiting Lounge', 'Luggage Drop', 'CCTV'],
    description:
      'Round-the-clock charging park at Secunderabad station, sized for long-distance travellers and cab fleets.',
    rating: 4.45,
    review_count: 231,
    points: [
      { code: 'SCB-DC1', connector_type: 'CCS2', current_type: 'DC', power_kw: 120, status: 'available' },
      { code: 'SCB-DC2', connector_type: 'CHAdeMO', current_type: 'DC', power_kw: 50, status: 'available' },
      { code: 'SCB-DC3', connector_type: 'CCS2', current_type: 'DC', power_kw: 120, status: 'offline' },
      { code: 'SCB-AC1', connector_type: 'Type 2', current_type: 'AC', power_kw: 22, status: 'available' },
    ],
  },
  {
    key: 'kukatpally-forum-mall',
    name: 'Kukatpally Forum Mall Charging Bay',
    address: 'Forum Mall Road, Kukatpally Housing Board Colony, Hyderabad, Telangana 500072',
    latitude: 17.484901,
    longitude: 78.41381,
    operator_name: 'GreenDrive Mobility',
    open_24h: 0,
    opening_hours: '09:00 – 23:00',
    connector_types: ['Type 2', 'CCS2'],
    max_power_kw: 60,
    price_per_kwh: 18.0,
    amenities: ['Shopping Mall', 'Food Court', 'Restroom', 'Covered Parking'],
    description:
      'Basement charging bays at Forum Mall, Kukatpally — park, shop and charge in a single stop.',
    rating: 4.4,
    review_count: 118,
    points: [
      { code: 'KKP-AC1', connector_type: 'Type 2', current_type: 'AC', power_kw: 22, status: 'available' },
      { code: 'KKP-DC1', connector_type: 'CCS2', current_type: 'DC', power_kw: 60, status: 'reserved' },
      { code: 'KKP-AC2', connector_type: 'Type 2', current_type: 'AC', power_kw: 22, status: 'available' },
    ],
  },
  {
    key: 'lb-nagar-metro',
    name: 'LB Nagar Metro EV Hub',
    address: 'LB Nagar Metro Station Road, Saroornagar, Hyderabad, Telangana 500074',
    latitude: 17.345701,
    longitude: 78.552239,
    operator_name: 'EVGrid Networks',
    open_24h: 1,
    opening_hours: null,
    connector_types: ['CCS2', 'Type 1', 'Type 2'],
    max_power_kw: 90,
    price_per_kwh: 18.5,
    amenities: ['Wi-Fi', 'Restroom', 'Metro Access', 'CCTV'],
    description:
      'Metro-linked hub at LB Nagar with a 90 kW CCS2 bay plus Type 1 and Type 2 points for older models.',
    rating: 4.25,
    review_count: 87,
    points: [
      { code: 'LBN-DC1', connector_type: 'CCS2', current_type: 'DC', power_kw: 90, status: 'available' },
      { code: 'LBN-AC1', connector_type: 'Type 1', current_type: 'AC', power_kw: 7.4, status: 'available' },
      { code: 'LBN-AC2', connector_type: 'Type 2', current_type: 'AC', power_kw: 22, status: 'available' },
    ],
  },
  {
    key: 'rgia-airport',
    name: 'RGIA Airport EV Charging Court',
    address: 'Rajiv Gandhi International Airport, Shamshabad, Hyderabad, Telangana 501218',
    latitude: 17.240099,
    longitude: 78.42943,
    operator_name: 'VoltUp Charging',
    open_24h: 1,
    opening_hours: null,
    connector_types: ['CCS2', 'CHAdeMO', 'Type 2'],
    max_power_kw: 150,
    price_per_kwh: 22.0,
    amenities: ['Wi-Fi', 'Restroom', 'Café', 'Valet Parking', '24x7 Security', 'CCTV'],
    description:
      'Airport charging court at RGIA Shamshabad with 150 kW CCS2 bays — charge while you wait for a flight or a pickup.',
    rating: 4.8,
    review_count: 342,
    points: [
      { code: 'RGI-DC1', connector_type: 'CCS2', current_type: 'DC', power_kw: 150, status: 'available' },
      { code: 'RGI-DC2', connector_type: 'CHAdeMO', current_type: 'DC', power_kw: 50, status: 'available' },
      { code: 'RGI-AC1', connector_type: 'Type 2', current_type: 'AC', power_kw: 22, status: 'available' },
    ],
  },
];

const TARIFF = {
  name: 'Pay-as-you-go',
  session_fee: 0,
  idle_fee_per_min: 2,
  currency: 'INR',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Deterministic CHAR(36) id derived from a natural key. The primary-key
 * collision is a second line of defence against duplicates when a station is
 * renamed between runs.
 */
function seedId(scope, key) {
  const hex = createHash('sha256').update(`evgrid-seed|${scope}|${key}`).digest('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `a${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join('-');
}

async function assertSchema() {
  const rows = await query(
    `SELECT TABLE_NAME AS name FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?, ?, ?, ?)`,
    REQUIRED_TABLES
  );
  const found = new Set(rows.map((r) => r.name));
  const missing = REQUIRED_TABLES.filter((t) => !found.has(t));
  if (missing.length) {
    throw new Error(
      `Missing table(s) in "${process.env.DB_NAME || 'evgrid'}": ${missing.join(', ')}. ` +
        'Run "npm run db:setup" first.'
    );
  }
}

async function seedOperator(conn, op) {
  const candidateId = seedId('operator', op.org_name);
  const existing = await txQueryOne(
    conn,
    'SELECT id FROM operators WHERE org_name = ? OR id = ? LIMIT 1',
    [op.org_name, candidateId]
  );
  const id = existing?.id ?? candidateId;

  if (existing) {
    await txQuery(
      conn,
      `UPDATE operators
          SET contact_name = ?, email = ?, phone = ?, city = ?, status = ?, commission_percent = ?
        WHERE id = ?`,
      [op.contact_name, op.email, op.phone, CITY, 'active', op.commission_percent, id]
    );
  } else {
    await txQuery(
      conn,
      `INSERT INTO operators
         (id, org_name, contact_name, email, phone, city, status, commission_percent, onboarded_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, op.org_name, op.contact_name, op.email, op.phone, CITY, 'active', op.commission_percent, TODAY]
    );
  }
  return { id, created: !existing };
}

async function seedStation(conn, station, imageUrl) {
  const candidateId = seedId('station', station.key);
  const existing = await txQueryOne(
    conn,
    'SELECT id FROM charging_stations WHERE name = ? OR id = ? LIMIT 1',
    [station.name, candidateId]
  );
  const id = existing?.id ?? candidateId;

  const values = [
    station.name,
    CITY,
    STATE,
    station.address,
    'online',
    JSON.stringify(station.connector_types),
    station.max_power_kw,
    station.price_per_kwh,
    station.operator_name,
    station.open_24h,
    station.opening_hours,
    JSON.stringify(station.amenities),
    station.description,
    imageUrl,
    station.rating,
    station.review_count,
    station.latitude,
    station.longitude,
  ];

  if (existing) {
    await txQuery(
      conn,
      `UPDATE charging_stations
          SET name = ?, city = ?, state = ?, address = ?, status = ?, connector_types = ?,
              max_power_kw = ?, price_per_kwh = ?, operator_name = ?, open_24h = ?,
              opening_hours = ?, amenities = ?, description = ?, image_url = ?, rating = ?,
              review_count = ?, latitude = ?, longitude = ?
        WHERE id = ?`,
      [...values, id]
    );
  } else {
    await txQuery(
      conn,
      `INSERT INTO charging_stations
         (id, name, city, state, address, status, connector_types, max_power_kw, price_per_kwh,
          operator_name, open_24h, opening_hours, amenities, description, image_url, rating,
          review_count, latitude, longitude)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, ...values]
    );
  }
  return { id, created: !existing };
}

async function seedPoint(conn, stationId, point) {
  const candidateId = seedId('point', `${stationId}:${point.code}`);
  const serial = `EVG-${point.code}-${stationId.slice(0, 6).toUpperCase()}`;
  const existing = await txQueryOne(
    conn,
    'SELECT id FROM charging_points WHERE (station_id = ? AND code = ?) OR id = ? LIMIT 1',
    [stationId, point.code, candidateId]
  );
  const id = existing?.id ?? candidateId;

  const values = [
    stationId,
    point.code,
    point.connector_type,
    point.current_type,
    point.power_kw,
    point.status,
    serial,
    LAST_SERVICED,
  ];

  if (existing) {
    await txQuery(
      conn,
      `UPDATE charging_points
          SET station_id = ?, code = ?, connector_type = ?, current_type = ?, power_kw = ?,
              status = ?, serial_number = ?, last_serviced_date = ?
        WHERE id = ?`,
      [...values, id]
    );
  } else {
    await txQuery(
      conn,
      `INSERT INTO charging_points
         (id, station_id, code, connector_type, current_type, power_kw, status, serial_number,
          last_serviced_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, ...values]
    );
  }
  return { id, created: !existing };
}

async function seedTariff(conn, station, stationId) {
  const candidateId = seedId('tariff', `${station.key}:${TARIFF.name}`);
  const existing = await txQueryOne(
    conn,
    'SELECT id FROM tariffs WHERE (station_id = ? AND name = ?) OR id = ? LIMIT 1',
    [stationId, TARIFF.name, candidateId]
  );
  const id = existing?.id ?? candidateId;

  const values = [
    stationId,
    station.name,
    TARIFF.name,
    station.price_per_kwh,
    TARIFF.session_fee,
    TARIFF.idle_fee_per_min,
    TARIFF.currency,
    1,
    TODAY,
  ];

  if (existing) {
    await txQuery(
      conn,
      `UPDATE tariffs
          SET station_id = ?, station_name = ?, name = ?, price_per_kwh = ?, session_fee = ?,
              idle_fee_per_min = ?, currency = ?, is_active = ?, valid_from = ?
        WHERE id = ?`,
      [...values, id]
    );
  } else {
    await txQuery(
      conn,
      `INSERT INTO tariffs
         (id, station_id, station_name, name, price_per_kwh, session_fee, idle_fee_per_min,
          currency, is_active, valid_from)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, ...values]
    );
  }
  return { id, created: !existing };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  await assertSchema();

  const stats = await withTransaction(async (conn) => {
    const totals = {
      operators: { created: 0, updated: 0 },
      stations: { created: 0, updated: 0 },
      points: { created: 0, updated: 0 },
      tariffs: { created: 0, updated: 0 },
    };
    const operatorIds = new Map();

    for (const op of OPERATORS) {
      const res = await seedOperator(conn, op);
      operatorIds.set(op.org_name, res.id);
      totals.operators[res.created ? 'created' : 'updated'] += 1;
    }

    for (let i = 0; i < STATIONS.length; i += 1) {
      const station = STATIONS[i];
      const stationRes = await seedStation(conn, station, IMAGES[i % IMAGES.length]);
      totals.stations[stationRes.created ? 'created' : 'updated'] += 1;

      let pointCount = 0;
      for (const point of station.points) {
        const pointRes = await seedPoint(conn, stationRes.id, point);
        totals.points[pointRes.created ? 'created' : 'updated'] += 1;
        pointCount += 1;
      }

      // Keep the StationCard "free / total points" chip accurate.
      await txQuery(conn, 'UPDATE charging_stations SET total_points = ? WHERE id = ?', [
        pointCount,
        stationRes.id,
      ]);

      const tariffRes = await seedTariff(conn, station, stationRes.id);
      totals.tariffs[tariffRes.created ? 'created' : 'updated'] += 1;
    }

    for (const op of OPERATORS) {
      await txQuery(
        conn,
        `UPDATE operators
            SET stations_count = (SELECT COUNT(*) FROM charging_stations WHERE operator_name = ?)
          WHERE id = ?`,
        [op.org_name, operatorIds.get(op.org_name)]
      );
    }

    return totals;
  });

  const line = (label, s) => `  ${label.padEnd(10)} ${s.created} inserted, ${s.updated} updated`;
  console.info(`[evgrid] Sample Hyderabad network seeded into "${process.env.DB_NAME || 'evgrid'}":`);
  console.info(line('operators', stats.operators));
  console.info(line('stations', stats.stations));
  console.info(line('points', stats.points));
  console.info(line('tariffs', stats.tariffs));
  console.info('[evgrid] No existing rows were deleted. Re-running this script is safe.');
}

main()
  .catch((error) => {
    console.error('[evgrid] seed failed:', error.message);
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('[evgrid] Check DB_USER / DB_PASSWORD in backend/.env.');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('[evgrid] Check that MySQL is running and DB_HOST / DB_PORT are correct.');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('[evgrid] Database does not exist — run "npm run db:setup" first.');
    }
    process.exitCode = 1;
  })
  .finally(() => closePool());
