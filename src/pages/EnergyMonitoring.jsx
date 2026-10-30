import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, BatteryCharging, IndianRupee, Plug, Zap } from "lucide-react";
import { sessionsApi } from "@/api";
import { ErrorBlock, LoadingBlock } from "@/components/ev/DataState";
import PageHeader from "@/components/ev/PageHeader";
import StatCard from "@/components/ev/StatCard";
import EmptyState from "@/components/ev/EmptyState";
import StatusBadge from "@/components/ev/StatusBadge";
import EnergyAreaChart from "@/components/charts/EnergyAreaChart";
import RevenueBarChart from "@/components/charts/RevenueBarChart";
import UtilizationBars from "@/components/charts/UtilizationBars";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { dailySeries, groupSum, monthlySeries } from "@/lib/analytics";
import { fmtDateTime, inr, num } from "@/lib/evgrid";

const PERIODS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "all", label: "All time" },
];

export default function EnergyMonitoring() {
  const [period, setPeriod] = useState("30");
  const [raw, setRaw] = useState({ sessions: [], loading: true });
  const [error, setError] = useState(null);

  const load = async () => {
    setError(null);
    setRaw((prev) => ({ ...prev, loading: true }));
    try {
      const [completedPage, livePage] = await Promise.all([
        sessionsApi.filter({ status: "completed" }, { sort: "-start_time", limit: 500 }),
        sessionsApi.filter({ status: "in_progress" }, { sort: "-start_time", limit: 50 }),
      ]);
      setRaw({
        sessions: completedPage.items || [],
        live: livePage.items || [],
        loading: false,
      });
    } catch (err) {
      setError(err);
      setRaw((prev) => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => { load(); }, []);

  const data = useMemo(() => {
    const cutoff = period === "all" ? 0 : Date.now() - Number(period) * 86400000;
    const inRange = (value) => (period === "all" ? true : new Date(value).getTime() >= cutoff);
    const sessions = (raw.sessions || []).filter((s) => inRange(s.start_time));

    const energy = sessions.reduce((sum, s) => sum + Number(s.energy_kwh || 0), 0);
    const cost = sessions.reduce((sum, s) => sum + Number(s.cost || 0), 0);
    const minutes = sessions.reduce((sum, s) => sum + Number(s.duration_minutes || 0), 0);

    return {
      sessions,
      energy,
      cost,
      minutes,
      avgEnergy: sessions.length ? energy / sessions.length : 0,
      avgRate: energy > 0 ? cost / energy : 0,
      energySeries: dailySeries(sessions, "start_time", "energy_kwh", 14),
      costSeries: monthlySeries(sessions, "start_time", "cost", 6),
      byStation: groupSum(sessions, "station_name", "energy_kwh"),
      peak: [...sessions].sort((a, b) => Number(b.energy_kwh || 0) - Number(a.energy_kwh || 0)).slice(0, 6),
    };
  }, [raw, period]);

  const util = data.byStation.map((row) => ({ ...row, hint: `${num(row.value, 1)} kWh` }));
  const live = raw.live || [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Energy"
        title="Energy monitoring"
        description="Consumption, cost and load patterns computed from your completed charging sessions."
        actions={
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="h-10 w-[170px] rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>{PERIODS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
          </Select>
        }
      />

      {error ? (
        <ErrorBlock error={error} onRetry={load} />
      ) : raw.loading ? (
        <LoadingBlock label="Loading energy records…" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Energy delivered" value={`${num(data.energy, 1)} kWh`} hint={`${data.sessions.length} completed sessions`} icon={BatteryCharging} tone="lime" />
            <StatCard label="Charging spend" value={inr(data.cost)} hint={`Avg ${inr(data.avgRate)} / kWh`} icon={IndianRupee} tone="sky" />
            <StatCard label="Avg per session" value={`${num(data.avgEnergy, 1)} kWh`} hint={`${num(data.minutes / 60, 1)} h connected`} icon={Activity} tone="emerald" />
            <StatCard label="Charging now" value={num(live.length)} hint="Live in-progress sessions" icon={Zap} tone={live.length ? "amber" : "slate"} />
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <div className="rounded-2xl border border-border/70 bg-card p-5 lg:col-span-2">
              <h3 className="font-heading text-[15px] font-semibold">Consumption trend</h3>
              <p className="text-[11px] text-muted-foreground">kWh delivered per day · last 14 days in range</p>
              <EnergyAreaChart data={data.energySeries} />
            </div>
            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <h3 className="font-heading text-[15px] font-semibold">Energy by station</h3>
              <p className="text-[11px] text-muted-foreground">Where your electricity went</p>
              <div className="mt-4">
                <UtilizationBars data={util} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-5">
            <h3 className="font-heading text-[15px] font-semibold">Cost by month</h3>
            <p className="text-[11px] text-muted-foreground">Charging spend across the last 6 months</p>
            <RevenueBarChart data={data.costSeries} />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
              <div className="border-b border-border/60 px-5 py-4">
                <h3 className="font-heading text-[15px] font-semibold">Live sessions</h3>
                <p className="text-[11px] text-muted-foreground">Charging in progress right now</p>
              </div>
              {live.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">No session is charging at the moment.</p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {live.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{s.station_name} · {s.point_code}</p>
                        <p className="text-xs text-muted-foreground">Started {fmtDateTime(s.start_time)}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold text-foreground">{num(s.energy_kwh, 1)} kWh</p>
                        <StatusBadge status={s.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
              <div className="border-b border-border/60 px-5 py-4">
                <h3 className="font-heading text-[15px] font-semibold">Heaviest sessions</h3>
                <p className="text-[11px] text-muted-foreground">Highest energy drawn in the selected period</p>
              </div>
              {data.peak.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    icon={Plug}
                    title="No energy records yet"
                    description="Complete a charging session to start tracking consumption here."
                    action={<Button asChild size="sm" className="rounded-lg bg-emerald-800 hover:bg-emerald-900"><Link to="/discover">Find a charger</Link></Button>}
                  />
                </div>
              ) : (
                <ul className="divide-y divide-border/60">
                  {data.peak.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{s.station_name}</p>
                        <p className="text-xs text-muted-foreground">{fmtDateTime(s.start_time)} · {s.point_code}</p>
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

          <p className="text-center text-[11px] text-muted-foreground">
            All figures are computed live from charging session records.
          </p>
        </>
      )}
    </div>
  );
}
