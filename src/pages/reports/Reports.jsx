import React, { useEffect, useMemo, useState } from "react";
import { Download, BarChart3, BatteryCharging, IndianRupee, CalendarCheck } from "lucide-react";
import { sessionsApi, paymentsApi, bookingsApi } from "@/api";
import { ErrorBlock } from "@/components/ev/DataState";
import PageHeader from "@/components/ev/PageHeader";
import StatCard from "@/components/ev/StatCard";
import EnergyAreaChart from "@/components/charts/EnergyAreaChart";
import RevenueBarChart from "@/components/charts/RevenueBarChart";
import BookingTrendChart from "@/components/charts/BookingTrendChart";
import PaymentDonut from "@/components/charts/PaymentDonut";
import UtilizationBars from "@/components/charts/UtilizationBars";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { countsBy, dailySeries, groupSum, monthlySeries } from "@/lib/analytics";
import { inr, num } from "@/lib/evgrid";

const PERIODS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "all", label: "All time" },
];

export default function Reports() {
  const [period, setPeriod] = useState("30");
  const [raw, setRaw] = useState({ sessions: [], payments: [], bookings: [], loading: true });
  const [error, setError] = useState(null);

  const load = async () => {
    setError(null);
    try {
      const [sessionsPage, paymentsPage, bookingsPage] = await Promise.all([
        sessionsApi.filter({}, { sort: "-start_time", limit: 500 }),
        paymentsApi.filter({}, { sort: "-created_date", limit: 500 }),
        bookingsApi.filter({}, { sort: "-created_date", limit: 500 }),
      ]);
      setRaw({
        sessions: sessionsPage.items || [],
        payments: paymentsPage.items || [],
        bookings: bookingsPage.items || [],
        loading: false,
      });
    } catch (err) {
      setError(err);
    } finally {
      setRaw((prev) => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => { load(); }, []);

  const data = useMemo(() => {
    const cutoff = period === "all" ? 0 : Date.now() - Number(period) * 86400000;
    const after = (value) => (period === "all" ? true : new Date(value).getTime() >= cutoff);
    const sessions = raw.sessions.filter((s) => after(s.start_time));
    const payments = raw.payments.filter((p) => after(p.created_date));
    const bookings = raw.bookings.filter((b) => after(b.created_date));
    const completed = sessions.filter((s) => s.status === "completed");
    const paid = payments.filter((p) => p.status === "paid");

    const revenueByStation = groupSum(paid, "station_name", "amount");
    const energyByStation = groupSum(completed, "station_name", "energy_kwh");
    const stationRows = revenueByStation.map((row) => ({
      ...row,
      energy: energyByStation.find((e) => e.label === row.label)?.value || 0,
      sessions: completed.filter((s) => s.station_name === row.label).length,
    }));

    return {
      sessions,
      completed,
      payments,
      bookings,
      energy: completed.reduce((s, x) => s + Number(x.energy_kwh || 0), 0),
      revenue: paid.reduce((s, x) => s + Number(x.amount || 0), 0),
      energySeries: dailySeries(completed, "start_time", "energy_kwh", 14),
      revenueSeries: monthlySeries(paid, "paid_date", "amount", 6),
      bookingSeries: dailySeries(bookings, "created_date", null, 14),
      paymentMix: countsBy(payments, "status"),
      stationRows,
      util: energyByStation.map((r) => ({ ...r, hint: `${num(r.value, 1)} kWh` })),
    };
  }, [raw, period]);

  const exportCsv = () => {
    const header = ["Station", "Point", "Started", "Duration (min)", "Energy (kWh)", "Cost (INR)", "Status"];
    const rows = data.sessions.map((s) => [
      s.station_name, s.point_code, s.start_time, s.duration_minutes || 0, s.energy_kwh || 0, s.cost || 0, s.status,
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `evgrid-sessions-${period}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analytics"
        title="Reports & analytics"
        description="Energy, revenue and utilisation computed directly from platform records."
        actions={
          <div className="flex gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="h-10 w-[160px] rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>{PERIODS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
            </Select>
            <Button onClick={exportCsv} variant="outline" className="rounded-xl"><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
          </div>
        }
      />

      {error ? (
        <ErrorBlock error={error} onRetry={load} />
      ) : (
        <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Sessions" value={raw.loading ? "—" : num(data.completed.length)} hint={`${data.sessions.length} total in range`} icon={BarChart3} tone="emerald" />
        <StatCard label="Energy delivered" value={raw.loading ? "—" : `${num(data.energy, 1)} kWh`} hint="Completed sessions" icon={BatteryCharging} tone="lime" />
        <StatCard label="Revenue settled" value={raw.loading ? "—" : inr(data.revenue)} hint="Paid invoices" icon={IndianRupee} tone="sky" />
        <StatCard label="Bookings" value={raw.loading ? "—" : num(data.bookings.length)} hint="Created in range" icon={CalendarCheck} tone="amber" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-2xl border border-border/70 bg-card p-5 lg:col-span-2">
          <h3 className="font-heading text-[15px] font-semibold">Energy consumption</h3>
          <p className="text-[11px] text-muted-foreground">kWh delivered per day · last 14 days in range</p>
          <EnergyAreaChart data={data.energySeries} />
        </div>
        <div className="rounded-2xl border border-border/70 bg-card p-5">
          <h3 className="font-heading text-[15px] font-semibold">Payment status</h3>
          <PaymentDonut data={data.paymentMix} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-border/70 bg-card p-5">
          <h3 className="font-heading text-[15px] font-semibold">Revenue by month</h3>
          <RevenueBarChart data={data.revenueSeries} />
        </div>
        <div className="rounded-2xl border border-border/70 bg-card p-5">
          <h3 className="font-heading text-[15px] font-semibold">Booking trend</h3>
          <BookingTrendChart data={data.bookingSeries} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-border/70 bg-card p-5">
          <h3 className="font-heading text-[15px] font-semibold">Station utilisation</h3>
          <p className="text-[11px] text-muted-foreground">Energy delivered by station</p>
          <div className="mt-4"><UtilizationBars data={data.util} /></div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
          <div className="border-b border-border/60 px-5 py-4">
            <h3 className="font-heading text-[15px] font-semibold">Station performance</h3>
            <p className="text-[11px] text-muted-foreground">Revenue and throughput by location</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="px-5 py-2.5 text-left font-semibold">Station</th>
                <th className="px-3 py-2.5 text-right font-semibold">Sessions</th>
                <th className="px-3 py-2.5 text-right font-semibold">kWh</th>
                <th className="px-5 py-2.5 text-right font-semibold">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {data.stationRows.map((row) => (
                <tr key={row.label}>
                  <td className="px-5 py-2.5 text-[13px] font-medium">{row.label}</td>
                  <td className="px-3 py-2.5 text-right text-[12px]">{row.sessions}</td>
                  <td className="px-3 py-2.5 text-right text-[12px]">{num(row.energy, 1)}</td>
                  <td className="px-5 py-2.5 text-right text-[12px] font-semibold">{inr(row.value)}</td>
                </tr>
              ))}
              {data.stationRows.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-6 text-center text-sm text-muted-foreground">No settled revenue in this period.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}
    </div>
  );
}