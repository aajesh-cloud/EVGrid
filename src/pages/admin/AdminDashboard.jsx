import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, Building2, Plug, CalendarCheck, IndianRupee, BatteryCharging, Wrench, ArrowRight } from "lucide-react";
import { usersApi, operatorsApi, stationsApi, chargingPointsApi, bookingsApi, sessionsApi, paymentsApi, maintenanceApi, auditLogsApi } from "@/api";
import PageHeader from "@/components/ev/PageHeader";
import { ErrorBlock } from "@/components/ev/DataState";
import StatCard from "@/components/ev/StatCard";
import StatusBadge from "@/components/ev/StatusBadge";
import RevenueBarChart from "@/components/charts/RevenueBarChart";
import BookingTrendChart from "@/components/charts/BookingTrendChart";
import PaymentDonut from "@/components/charts/PaymentDonut";
import { Button } from "@/components/ui/button";
import { countsBy, dailySeries, monthlySeries } from "@/lib/analytics";
import { fmtDate, inr, num } from "@/lib/evgrid";

export default function AdminDashboard() {
  const [data, setData] = useState({ loading: true });
  const [error, setError] = useState(null);

  const load = async () => {
    setError(null);
    setData((prev) => ({ ...prev, loading: true }));
    try {
      const [users, operators, stationTotal, pointTotal, bookingTotal, sessionActive, energyAgg, paidAgg, pendingAgg, maintenanceTotal, paymentsPage, sessionsPage, bookingsPage, auditPage] = await Promise.all([
        usersApi.list({ limit: 200 }),
        operatorsApi.count(),
        stationsApi.count(),
        chargingPointsApi.count(),
        bookingsApi.count(),
        sessionsApi.count({ status: "in_progress" }),
        sessionsApi.aggregate({ query: { status: "completed" }, sum: ["energy_kwh"] }),
        paymentsApi.aggregate({ query: { status: "paid" }, sum: ["amount"] }),
        paymentsApi.aggregate({ query: { status: "pending" }, sum: ["amount"] }),
        maintenanceApi.count({ status: { $in: ["open", "assigned", "in_progress"] } }),
        paymentsApi.filter({}, { sort: "-created_date", limit: 200 }),
        sessionsApi.filter({}, { sort: "-start_time", limit: 200 }),
        bookingsApi.filter({}, { sort: "-created_date", limit: 200 }),
        auditLogsApi.filter({}, { sort: "-created_date", limit: 6 }),
      ]);
      const payments = paymentsPage.items || [];
      const bookings = bookingsPage.items || [];
      setData({
        loading: false,
        users: (users.items || []).length,
        operators,
        stations: stationTotal,
        points: pointTotal,
        bookings: bookingTotal,
        activeSessions: sessionActive,
        energy: energyAgg?.rows?.[0]?.sum_energy_kwh || 0,
        revenue: paidAgg?.rows?.[0]?.sum_amount || 0,
        pending: pendingAgg?.rows?.[0]?.sum_amount || 0,
        maintenance: maintenanceTotal,
        revenueSeries: monthlySeries(payments.filter((p) => p.status === "paid"), "paid_date", "amount"),
        bookingSeries: dailySeries(bookings, "created_date", null, 7),
        paymentMix: countsBy(payments, "status"),
        recentBookings: bookings.slice(0, 5),
        audit: auditPage.items || [],
      });
    } catch (err) {
      setError(err);
    } finally {
      setData((prev) => (prev.loading ? { ...prev, loading: false } : prev));
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Platform overview"
        description="Network-wide health, revenue and governance across every operator and station."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" className="rounded-xl"><Link to="/reports">Analytics</Link></Button>
            <Button asChild className="rounded-xl bg-emerald-800 hover:bg-emerald-900"><Link to="/admin/users">Manage users</Link></Button>
          </div>
        }
      />

      {error ? (
        <ErrorBlock error={error} onRetry={load} />
      ) : (
        <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="App users" value={data.loading ? "—" : num(data.users)} hint={`${num(data.operators)} operators`} icon={Users} tone="emerald" />
        <StatCard label="Stations" value={data.loading ? "—" : num(data.stations)} hint={`${num(data.points)} charging points`} icon={Building2} tone="sky" />
        <StatCard label="Bookings" value={data.loading ? "—" : num(data.bookings)} hint={`${num(data.activeSessions)} charging now`} icon={CalendarCheck} tone="lime" />
        <StatCard label="Revenue settled" value={data.loading ? "—" : inr(data.revenue)} hint={`${inr(data.pending)} outstanding`} icon={IndianRupee} tone="amber" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Energy delivered" value={data.loading ? "—" : `${num(data.energy, 1)} kWh`} hint="Completed sessions" icon={BatteryCharging} tone="emerald" />
        <StatCard label="Open maintenance" value={data.loading ? "—" : num(data.maintenance)} hint="Across all operators" icon={Wrench} tone="rose" />
        <StatCard label="Charging points" value={data.loading ? "—" : num(data.points)} hint="Installed hardware" icon={Plug} tone="sky" />
        <StatCard label="Operators" value={data.loading ? "—" : num(data.operators)} hint="Organisations onboarded" icon={Building2} tone="lime" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-2xl border border-border/70 bg-card p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-[15px] font-semibold">Revenue trend</h3>
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Last 6 months</span>
          </div>
          <RevenueBarChart data={data.revenueSeries || []} />
        </div>
        <div className="rounded-2xl border border-border/70 bg-card p-5">
          <h3 className="font-heading text-[15px] font-semibold">Payment status mix</h3>
          <PaymentDonut data={data.paymentMix || []} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-border/70 bg-card p-5">
          <h3 className="font-heading text-[15px] font-semibold">Booking trend</h3>
          <p className="text-[11px] text-muted-foreground">Reservations created per day</p>
          <BookingTrendChart data={data.bookingSeries || []} />
        </div>
        <div className="rounded-2xl border border-border/70 bg-card p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-[15px] font-semibold">Recent activity</h3>
            <Link to="/admin/audit" className="text-xs font-medium text-emerald-700 hover:underline">Audit log <ArrowRight className="ml-0.5 inline h-3 w-3" /></Link>
          </div>
          <ul className="mt-3 divide-y divide-border/60">
            {(data.audit || []).map((log) => (
              <li key={log.id} className="flex items-start justify-between gap-3 py-2.5">
                <div>
                  <p className="font-mono text-[11px] font-medium text-foreground">{log.action}</p>
                  <p className="text-[11px] text-muted-foreground">{log.actor_name} · {log.details}</p>
                </div>
                <span className="shrink-0 text-[10px] text-muted-foreground">{fmtDate(log.created_date)}</span>
              </li>
            ))}
            {!data.loading && (data.audit || []).length === 0 ? <li className="py-3 text-sm text-muted-foreground">No audit entries yet.</li> : null}
          </ul>
        </div>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-[15px] font-semibold">Latest bookings across the network</h3>
          <Link to="/bookings" className="text-xs font-medium text-emerald-700 hover:underline">View all</Link>
        </div>
        <div className="mt-3 space-y-2">
          {(data.recentBookings || []).map((b) => (
            <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">{b.user_name || "EV driver"} · {b.station_name}</p>
                <p className="text-[11px] text-muted-foreground">{fmtDate(b.booking_date)} · {b.start_time}–{b.end_time} · {b.point_code}</p>
              </div>
              <StatusBadge status={b.status} />
            </div>
          ))}
          {!data.loading && (data.recentBookings || []).length === 0 ? <p className="text-sm text-muted-foreground">No bookings yet.</p> : null}
        </div>
      </div>
        </>
      )}
    </div>
  );
}