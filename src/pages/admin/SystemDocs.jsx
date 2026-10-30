import React from "react";
import { Database, Server, ShieldCheck, Rocket, GitBranch } from "lucide-react";
import PageHeader from "@/components/ev/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ENTITIES = [
  { name: "User", fields: "email, full_name, role, app_role, phone, city", relations: "1 → many vehicles, bookings, sessions, payments, notifications" },
  { name: "Vehicle", fields: "make, model, year, registration_number, battery_capacity_kwh, connector_type", relations: "belongs to User · referenced by Booking" },
  { name: "Operator", fields: "org_name, contact_name, email, phone, city, status, commission_percent", relations: "1 → many stations" },
  { name: "ChargingStation", fields: "name, city, address, max_power_kw, price_per_kwh, connector_types, status, rating", relations: "belongs to Operator · 1 → many points, tariffs, reviews" },
  { name: "ChargingPoint", fields: "station_id, code, connector_type, current_type, power_kw, status", relations: "belongs to Station · 1 → many bookings, sessions" },
  { name: "Tariff", fields: "station_id, name, price_per_kwh, session_fee, idle_fee_per_min, is_active", relations: "belongs to Station" },
  { name: "Booking", fields: "station_id, point_id, vehicle_id, booking_date, start_time, end_time, status, estimated_cost", relations: "User + Point + Vehicle → 1 session" },
  { name: "ChargingSession", fields: "booking_id, start_time, end_time, energy_kwh, avg_power_kw, cost, status, simulated", relations: "belongs to Booking · 1 → 1 payment" },
  { name: "Payment", fields: "session_id, amount, method, status, transaction_ref, invoice_number, refund_status", relations: "belongs to Session" },
  { name: "MaintenanceRecord", fields: "station_id, point_id, title, category, priority, status, assigned_to, reported_date, resolved_date", relations: "Station + Point + Technician" },
  { name: "Review", fields: "station_id, user_name, rating, comment", relations: "User → Station" },
  { name: "Notification", fields: "user_id, title, message, type, is_read, link", relations: "belongs to User" },
  { name: "Favorite", fields: "station_id, station_name, city", relations: "User → Station" },
  { name: "AuditLog", fields: "actor_name, actor_email, action, entity_type, entity_id, details, severity", relations: "append-only governance trail" },
  { name: "Technician", fields: "name, email, phone, specialization, city, status, completed_jobs", relations: "1 → many maintenance records" },
];

const ENDPOINTS = [
  ["POST", "/auth/register, /auth/login, /auth/profile", "Session auth via the platform identity service; role returned with profile"],
  ["GET/PUT", "/users, /users/:id", "Admin-only listing; role assignment guarded by admin check"],
  ["GET/POST/PUT/DELETE", "/stations", "Station CRUD with operator attribution"],
  ["GET/POST/PUT/DELETE", "/points, /tariffs", "Hardware and pricing per station"],
  ["GET/POST", "/bookings", "createBooking function — validates slot, blocks overlaps, writes audit + notification"],
  ["POST", "/sessions/start, /sessions/end", "chargingSession function — meters energy, computes cost, raises invoice"],
  ["GET", "/payments", "Payment history scoped to owner or admin"],
  ["POST", "/payments/mock", "mockPayment function — mock settlement and refunds"],
  ["GET/POST/PUT", "/maintenance", "Issue reporting, technician assignment, resolution"],
  ["GET", "/dashboard/user, /dashboard/operator, /dashboard/admin", "Aggregated KPIs per role"],
];

const SQL = `-- Reference DDL (MySQL 8) mirroring the platform data model
CREATE TABLE users (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  app_role ENUM('ev_user','operator','technician','admin') NOT NULL DEFAULT 'ev_user',
  city VARCHAR(80),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vehicles (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  make VARCHAR(60) NOT NULL, model VARCHAR(60) NOT NULL,
  registration_number VARCHAR(20) NOT NULL UNIQUE,
  battery_capacity_kwh DECIMAL(6,2),
  connector_type ENUM('Type 2','CCS2','CHAdeMO','Type 1','GB/T') NOT NULL,
  CONSTRAINT fk_vehicle_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE charging_stations (
  id CHAR(36) PRIMARY KEY,
  operator_id CHAR(36),
  name VARCHAR(120) NOT NULL,
  city VARCHAR(80) NOT NULL,
  address VARCHAR(255) NOT NULL,
  max_power_kw DECIMAL(6,1) NOT NULL,
  price_per_kwh DECIMAL(6,2) NOT NULL,
  status ENUM('online','offline','maintenance') NOT NULL DEFAULT 'online',
  INDEX idx_station_city (city),
  CONSTRAINT fk_station_operator FOREIGN KEY (operator_id) REFERENCES operators(id) ON DELETE SET NULL
);

CREATE TABLE charging_points (
  id CHAR(36) PRIMARY KEY,
  station_id CHAR(36) NOT NULL,
  code VARCHAR(20) NOT NULL,
  connector_type ENUM('Type 2','CCS2','CHAdeMO','Type 1','GB/T') NOT NULL,
  power_kw DECIMAL(6,1) NOT NULL,
  status ENUM('available','occupied','reserved','offline','maintenance') NOT NULL DEFAULT 'available',
  UNIQUE KEY uq_point (station_id, code),
  CONSTRAINT fk_point_station FOREIGN KEY (station_id) REFERENCES charging_stations(id) ON DELETE CASCADE
);

CREATE TABLE bookings (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  point_id CHAR(36) NOT NULL,
  vehicle_id CHAR(36),
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status ENUM('pending','confirmed','active','completed','cancelled','no_show') NOT NULL DEFAULT 'confirmed',
  estimated_cost DECIMAL(10,2),
  INDEX idx_booking_slot (point_id, booking_date, start_time),
  CONSTRAINT fk_booking_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_booking_point FOREIGN KEY (point_id) REFERENCES charging_points(id) ON DELETE RESTRICT
);

CREATE TABLE charging_sessions (
  id CHAR(36) PRIMARY KEY,
  booking_id CHAR(36) NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME,
  energy_kwh DECIMAL(8,2),
  cost DECIMAL(10,2),
  status ENUM('in_progress','completed','aborted') NOT NULL DEFAULT 'in_progress',
  CONSTRAINT fk_session_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

CREATE TABLE payments (
  id CHAR(36) PRIMARY KEY,
  session_id CHAR(36) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  method ENUM('card','upi','wallet','netbanking') NOT NULL,
  status ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
  transaction_ref VARCHAR(64),
  invoice_number VARCHAR(40) UNIQUE,
  CONSTRAINT fk_payment_session FOREIGN KEY (session_id) REFERENCES charging_sessions(id) ON DELETE CASCADE
);`;

export default function SystemDocs() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reference"
        title="System documentation"
        description="Data model, endpoint map and deployment notes for the EVGrid platform."
      />

      <Tabs defaultValue="model" className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start gap-1 rounded-xl bg-secondary p-1.5">
          <TabsTrigger value="model" className="rounded-lg text-xs">Data model</TabsTrigger>
          <TabsTrigger value="api" className="rounded-lg text-xs">Endpoints</TabsTrigger>
          <TabsTrigger value="sql" className="rounded-lg text-xs">SQL reference</TabsTrigger>
          <TabsTrigger value="setup" className="rounded-lg text-xs">Setup & deployment</TabsTrigger>
        </TabsList>

        <TabsContent value="model" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { icon: Database, title: "15 relational tables", copy: "Normalised to 3NF with primary keys, foreign keys and unique constraints." },
              { icon: GitBranch, title: "Referential integrity", copy: "Cascade on ownership deletes, restrict on booked hardware." },
              { icon: ShieldCheck, title: "Row-level security", copy: "Personal records scoped to their owner; admins override." },
            ].map((c) => (
              <div key={c.title} className="rounded-2xl border border-border/70 bg-card p-5">
                <c.icon className="h-5 w-5 text-emerald-700" />
                <p className="mt-3 font-heading text-sm font-semibold">{c.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{c.copy}</p>
              </div>
            ))}
          </div>
          <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-semibold">Table</th>
                  <th className="px-5 py-3 font-semibold">Key columns</th>
                  <th className="px-5 py-3 font-semibold">Relationships</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {ENTITIES.map((e) => (
                  <tr key={e.name}>
                    <td className="whitespace-nowrap px-5 py-3 font-mono text-[12px] font-medium">{e.name}</td>
                    <td className="px-5 py-3 text-[12px] text-muted-foreground">{e.fields}</td>
                    <td className="px-5 py-3 text-[12px] text-muted-foreground">{e.relations}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="api">
          <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-semibold">Method</th>
                  <th className="px-5 py-3 font-semibold">Route</th>
                  <th className="px-5 py-3 font-semibold">Behaviour</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {ENDPOINTS.map(([method, route, note]) => (
                  <tr key={route}>
                    <td className="whitespace-nowrap px-5 py-3 font-mono text-[11px] font-semibold text-emerald-800">{method}</td>
                    <td className="px-5 py-3 font-mono text-[11px]">{route}</td>
                    <td className="px-5 py-3 text-[12px] text-muted-foreground">{note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Data reads and writes are authorised per role and per record. Server-side functions run the transactional
            booking, session and payment flows; the browser never computes a price or a conflict decision.
          </p>
        </TabsContent>

        <TabsContent value="sql">
          <div className="overflow-hidden rounded-2xl border border-border/70 bg-[#06120E]">
            <div className="flex items-center gap-2 border-b border-white/10 px-5 py-3 text-[11px] uppercase tracking-[0.16em] text-emerald-300/70">
              <Server className="h-3.5 w-3.5" /> MySQL 8 portability reference
            </div>
            <pre className="overflow-x-auto p-5 text-[11.5px] leading-relaxed text-emerald-100/85">{SQL}</pre>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            The shipped application stores these tables in the platform database, so no external MySQL server is needed
            to run it. The DDL above is the equivalent schema for teams porting EVGrid to their own MySQL deployment.
          </p>
        </TabsContent>

        <TabsContent value="setup">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <Rocket className="h-5 w-5 text-emerald-700" />
              <h3 className="mt-3 font-heading text-sm font-semibold">Run & publish</h3>
              <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                <li>1. Sign in to the editor and preview the app — no local database required.</li>
                <li>2. Publish from the top-right Publish button to get a live URL.</li>
                <li>3. Invite EV users from Administration → App users.</li>
                <li>4. Assign workspace roles (operator, technician) per user.</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <ShieldCheck className="h-5 w-5 text-emerald-700" />
              <h3 className="mt-3 font-heading text-sm font-semibold">Security & data notes</h3>
              <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                <li>Passwords are hashed by the managed identity provider — never stored in app code.</li>
                <li>Personal records (vehicles, bookings, sessions, payments, notifications) are owner-scoped.</li>
                <li>Charging sessions and payments are simulated and labelled as such in the UI.</li>
                <li>All privileged actions are written to the audit log.</li>
              </ul>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}