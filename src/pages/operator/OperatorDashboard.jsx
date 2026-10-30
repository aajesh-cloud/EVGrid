import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Plug, Zap, IndianRupee, BatteryCharging, ArrowRight, Star, AlertTriangle } from "lucide-react";
import { stationsApi, chargingPointsApi, bookingsApi, sessionsApi, paymentsApi, maintenanceApi } from "@/api";
import { ErrorBlock } from "@/components/ev/DataState";
import PageHeader from "@/components/ev/PageHeader";
import StatCard from "@/components/ev/StatCard";
import StatusBadge from "@/components/ev/StatusBadge";
import EnergyAreaChart from "@/components/charts/EnergyAreaChart";
import RevenueBarChart from "@/components/charts/RevenueBarChart";
import UtilizationBars from "@/components/charts/UtilizationBars";
import { Button } from "@/components/ui/button";
import { dailySeries, groupSum, monthlySeries } from "@/lib/analytics";
import { fmtDate, inr, num } from "@/lib/evgrid";

export default function OperatorDashboard() {
  const [data, setData] = useState({ loading: true });
  const [error, setError] = useState(null);

  const load = async () => {
    setError(null);
    try {
      const [stationsPage, pointTotal, pointAvailable, bookingsPage, sessionsPage, paymentsPage, maintenancePage] = await Promise.all([
        stationsApi.list({ sort: "-rating", limit: 50 }),
        chargingPointsApi.count(),
        chargingPointsApi.count({ status: "available" }),
        bookingsApi.filter({}, { sort: "-created_date", limit: 100 }),
        sessionsApi.filter({}, { sort: "-start_time", limit: 200 }),
        paymentsApi.filter({}, { sort: "-created_date", limit: 200 }),
        maintenanceApi.filter({ status: { $in: ["open", "assigned", "in_progress"] } }, { limit: 50 }),
      ]);
      const sessions = sessionsPage.items || [];
      const payments = paymentsPage.items || [];
      const paid = payments.filter((p) => p.status === "paid");
      setData({
        loading: false,
        stations: stationsPage.items || [],
        points: pointTotal,
        available: pointAvailable,
        bookings: bookingsPage.items || [],
        sessions,
        payments,
        maintenance: maintenancePage.items || [],
        revenue: paid.reduce((s, p) => s + Number(p.amount || 0), 0),
        energy: sessions.filter((s) => s.status === "completed").reduce((s, x) => s + Number(x.energy_kwh || 0), 0),
        revenueSeries: monthlySeries(paid, "paid_date", "amount"),
        energySeries: dailySeries(sessions.filter((s) => s.status === "completed"), "start_time", "energy_kwh", 7),
        util: groupSum(sessions, "station_name", "energy_kwh").map((r) => ({ ...r, hint: `${num(r.value, 1)} kWh` })),
      });
    } catch (err) {
      setError(err);
    } finally {
      setData((prev) => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => { load(); }, []);

  const today = new Date().toISOString().slice(0, 10);
  const todaysBookings = (data.bookings || []).filter((b) => b.booking_date === today);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Operator overview"
        description="Network health, energy throughput and revenue across your charging estate."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" className="rounded-xl"><Link to="/reports">Full reports</Link></Button>
            <Button asChild className="rounded-xl bg-emerald-800 hover:bg-emerald-900"><Link to="/operator/stations">Manage stations</Link></Button>
          </div>
        }
      />

      {error ? (
        <ErrorBlock error={error} onRetry={load} />
      ) : (
        <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Stations" value={data.loading ? "—" : num((data.stations || []).length)} hint="Published locations" icon={Building2} tone="emerald" />
        <StatCard label="Charging points" value={data.loading ? "—" : `${num(data.available)} / ${num(data.points)}`} hint="Available now" icon={Plug} tone="lime" />
        <StatCard label="Revenue settled" value={data.loading ? "—" : inr(data.revenue)} hint="Mock gateway" icon={IndianRupee} tone="sky" />
        <StatCard label="Energy delivered" value={data.loading ? "—" : `${num(data.energy, 1)} kWh`} hint="Completed sessions" icon={BatteryCharging} tone="amber" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-border/70 bg-card p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-[15px] font-semibold">Revenue trend</h3>
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Last 6 months</span>
          </div>
          <RevenueBarChart data={data.revenueSeries || []} />
        </div>
        <div className="rounded-2xl border border-border/70 bg-card p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-[15px] font-semibold">Energy delivered</h3>
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Last 7 days</span>
          </div>
          <EnergyAreaChart data={data.energySeries || []} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-2xl border border-border/70 bg-card p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-[15px] font-semibold">Latest bookings</h3>
            <Link to="/bookings" className="text-xs font-medium text-emerald-700 hover:underline">All <ArrowRight className="ml-0.5 inline h-3 w-3" /></Link>
          </div>
          <div className="mt-3 space-y-2">
            {data.loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
            {(data.bookings || []).slice(0, 6).map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{b.user_name || "EV driver"} · {b.station_name}</p>
                  <p className="text-[11px] text-muted-foreground">{fmtDate(b.booking_date)} · {b.start_time}–{b.end_time} · {b.point_code}</p>
                </div>
                <StatusBadge status={b.status} />
              </div>
            ))}
            {!data.loading && (data.bookings || []).length === 0 ? <p className="text-sm text-muted-foreground">No bookings recorded yet.</p> : null}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-border/70 bg-card p-5">
            <h3 className="font-heading text-[15px] font-semibold">Utilisation by station</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Energy delivered per location</p>
            <div className="mt-4">
              <UtilizationBars data={data.util || []} />
            </div>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
            <div className="flex items-center gap-2 text-amber-900">
              <AlertTriangle className="h-4 w-4" />
              <p className="text-sm font-semibold">Open maintenance</p>
            </div>
            <p className="mt-1 text-xs text-amber-900/70">{(data.maintenance || []).length} issue(s) awaiting resolution across the network.</p>
            <Link to="/maintenance" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-amber-900 hover:underline">
              Open maintenance queue <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Today's bookings" value={num(todaysBookings.length)} hint="Scheduled for today" icon={Zap} tone="emerald" />
        <StatCard label="Total bookings" value={num((data.bookings || []).length)} hint="Last 100 records" icon={Star} tone="sky" />
        <StatCard label="Active sessions" value={num((data.sessions || []).filter((s) => s.status === "in_progress").length)} hint="Charging right now" icon={BatteryCharging} tone="lime" />
      </div>
        </>
      )}
    </div>
  );
}