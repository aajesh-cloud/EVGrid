import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Zap, CalendarCheck, Car, CreditCard, BatteryCharging, ArrowUpRight, ArrowRight, MapPin, Search } from "lucide-react";
import { stationsApi, chargingPointsApi, bookingsApi, sessionsApi, paymentsApi, vehiclesApi } from "@/api";
import { ErrorBlock } from "@/components/ev/DataState";
import { useAuth } from "@/lib/AuthContext";
import PageHeader from "@/components/ev/PageHeader";
import StatCard from "@/components/ev/StatCard";
import EmptyState from "@/components/ev/EmptyState";
import StatusBadge from "@/components/ev/StatusBadge";
import { Button } from "@/components/ui/button";
import { fmtDate, fmtDateTime, inr, num } from "@/lib/evgrid";

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState({ loading: true });
  const [error, setError] = useState(null);

  const load = async () => {
    setError(null);
    try {
      const [vehicles, bookingPage, sessionPage, activePage, paymentAgg, energyAgg, stationsPage] = await Promise.all([
        vehiclesApi.count(),
        bookingsApi.filter({ status: { $in: ["confirmed", "active"] } }, { sort: "booking_date", limit: 5 }),
        sessionsApi.filter({ status: "completed" }, { sort: "-start_time", limit: 4 }),
        sessionsApi.filter({ status: "in_progress" }, { sort: "-start_time", limit: 1 }),
        paymentsApi.aggregate({ query: { status: "pending" }, sum: ["amount"] }),
        sessionsApi.aggregate({ query: { status: "completed" }, sum: ["energy_kwh", "cost"] }),
        stationsApi.list({ sort: "-rating", limit: 3 }),
      ]);
      const stations = stationsPage.items || [];
      let availability = {};
      if (stations.length) {
        const pointsPage = await chargingPointsApi.filter(
          { station_id: { $in: stations.map((s) => s.id) }, status: "available" },
          { limit: 100 }
        );
        (pointsPage.items || []).forEach((p) => {
          availability[p.station_id] = (availability[p.station_id] || 0) + 1;
        });
      }
      setData({
        loading: false,
        vehicles,
        bookings: bookingPage.items || [],
        sessions: sessionPage.items || [],
        activeSession: (activePage.items || [])[0] || null,
        due: paymentAgg?.rows?.[0]?.sum_amount || 0,
        energy: energyAgg?.rows?.[0]?.sum_energy_kwh || 0,
        spend: energyAgg?.rows?.[0]?.sum_cost || 0,
        stations,
        availability,
      });
    } catch (err) {
      setError(err);
    } finally {
      setData((prev) => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => { load(); }, []);

  const nextBooking = (data.bookings || []).find((b) => b.status === "confirmed" || b.status === "active");

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="EV owner workspace"
        title={`Good to see you, ${(user?.full_name || "driver").split(" ")[0]}`}
        description="Your charging activity, upcoming reservations and live network availability."
        actions={
          <Button asChild className="rounded-xl bg-emerald-800 hover:bg-emerald-900">
            <Link to="/discover"><Search className="mr-2 h-4 w-4" /> Find a charger</Link>
          </Button>
        }
      />

      {error ? (
        <ErrorBlock error={error} onRetry={load} />
      ) : (
        <>
      {data.activeSession ? (
        <Link
          to="/sessions"
          className="flex items-center justify-between gap-4 rounded-2xl border border-lime-200 bg-lime-50/70 px-5 py-4 transition-colors hover:bg-lime-50"
        >
          <div className="flex items-center gap-3">
            <span className="relative grid h-10 w-10 place-items-center rounded-xl bg-lime-500/15 text-lime-700">
              <Zap className="h-5 w-5" />
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full bg-lime-500 ring-2 ring-lime-100" />
            </span>
            <div>
              <p className="font-heading text-sm font-semibold text-lime-900">Charging in progress</p>
              <p className="text-xs text-lime-800/70">
                {data.activeSession.station_name} · {data.activeSession.point_code} · started {fmtDateTime(data.activeSession.start_time)}
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-lime-800" />
        </Link>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="My vehicles" value={data.loading ? "—" : num(data.vehicles)} hint="Registered EVs" icon={Car} tone="emerald" />
        <StatCard label="Upcoming bookings" value={data.loading ? "—" : num((data.bookings || []).length)} hint="Confirmed slots" icon={CalendarCheck} tone="sky" />
        <StatCard label="Energy consumed" value={data.loading ? "—" : `${num(data.energy, 1)} kWh`} hint={`Lifetime spend ${inr(data.spend)}`} icon={BatteryCharging} tone="lime" />
        <StatCard label="Amount due" value={data.loading ? "—" : inr(data.due)} hint="Pending mock payments" icon={CreditCard} tone={data.due > 0 ? "amber" : "slate"} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="rounded-2xl border border-border/70 bg-card p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-[15px] font-semibold">Next reservation</h3>
              <Link to="/bookings" className="text-xs font-medium text-emerald-700 hover:underline">All bookings</Link>
            </div>
            {nextBooking ? (
              <div className="mt-4 flex flex-col gap-4 rounded-xl border border-border/70 bg-background/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-heading text-base font-semibold">{nextBooking.station_name}</p>
                    <StatusBadge status={nextBooking.status} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Point {nextBooking.point_code} · {fmtDate(nextBooking.booking_date)} · {nextBooking.start_time}–{nextBooking.end_time}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {nextBooking.vehicle_label || "No vehicle attached"} · est. {nextBooking.estimated_energy_kwh || 0} kWh · {inr(nextBooking.estimated_cost)}
                  </p>
                </div>
                <Button asChild size="sm" className="rounded-lg bg-emerald-800 hover:bg-emerald-900">
                  <Link to="/bookings">Manage</Link>
                </Button>
              </div>
            ) : (
              <div className="mt-4">
                <EmptyState
                  icon={CalendarCheck}
                  title="No upcoming charging slots"
                  description="Reserve a charging point ahead of time to guarantee availability."
                  action={<Button asChild size="sm" className="rounded-lg bg-emerald-800 hover:bg-emerald-900"><Link to="/discover">Book a slot</Link></Button>}
                />
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-[15px] font-semibold">Recent charging sessions</h3>
              <Link to="/sessions" className="text-xs font-medium text-emerald-700 hover:underline">View all</Link>
            </div>
            {data.loading ? (
              <p className="mt-4 text-sm text-muted-foreground">Loading sessions…</p>
            ) : (data.sessions || []).length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">No completed sessions yet. Start one from your bookings page.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border/60">
                {data.sessions.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{s.station_name}</p>
                      <p className="text-xs text-muted-foreground">{fmtDateTime(s.start_time)} · {s.duration_minutes} min</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-foreground">{num(s.energy_kwh, 1)} kWh</p>
                      <p className="text-xs text-muted-foreground">{inr(s.cost)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-5">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-emerald-700" />
            <h3 className="font-heading text-[15px] font-semibold">Top rated near you</h3>
          </div>
          <div className="mt-4 space-y-3">
            {data.loading ? (
              <p className="text-sm text-muted-foreground">Loading stations…</p>
            ) : (data.stations || []).map((s) => (
              <Link key={s.id} to={`/stations/${s.id}`} className="block rounded-xl border border-border/70 p-3 transition-colors hover:border-emerald-300 hover:bg-emerald-50/40">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{s.name}</p>
                  <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{s.city} · {s.max_power_kw} kW · {inr(s.price_per_kwh)}/kWh</p>
                <p className="mt-1 text-[11px] font-medium text-emerald-700">{data.availability[s.id] || 0} point(s) available</p>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { to: "/vehicles", icon: Car, title: "Manage vehicles", copy: "Keep battery and connector details current." },
          { to: "/payments", icon: CreditCard, title: "Settle invoices", copy: "Mock gateway settlement and downloadable invoice IDs." },
          { to: "/discover", icon: MapPin, title: "Explore the network", copy: "Filter by connector type, power and live availability." },
        ].map((item) => (
          <Link key={item.to} to={item.to} className="group flex items-start gap-3 rounded-2xl border border-border/70 bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-emerald-300">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
              <item.icon className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">{item.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{item.copy}</p>
            </div>
          </Link>
        ))}
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        All figures are computed live from platform records. Charging and payment flows are simulated for demonstration.
      </p>
        </>
      )}
    </div>
  );
}