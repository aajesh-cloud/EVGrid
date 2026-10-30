import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Zap, BatteryCharging, Clock, IndianRupee, Search, Loader2, Square, Activity, ChevronLeft, ChevronRight,
} from "lucide-react";
import { sessionsApi, functionsApi, getApiErrorMessage } from "@/api";
import { ErrorBlock } from "@/components/ev/DataState";
import PageHeader from "@/components/ev/PageHeader";
import StatCard from "@/components/ev/StatCard";
import EmptyState from "@/components/ev/EmptyState";
import StatusBadge from "@/components/ev/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { fmtDateTime, inr, num } from "@/lib/evgrid";

const PAGE_SIZE = 10;

const SORT_OPTIONS = [
  { value: "-start_time", label: "Newest first" },
  { value: "start_time", label: "Oldest first" },
  { value: "-energy_kwh", label: "Most energy" },
  { value: "-cost", label: "Highest cost" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "aborted", label: "Aborted" },
];

export default function Sessions() {
  const { toast } = useToast();
  const [sessions, setSessions] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ energy: 0, cost: 0, active: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("-start_time");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // Debounce the free-text search so typing does not fire a request per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filter = status === "all" ? {} : { status };
      const [pageResult, activeCount, completedCount, totals] = await Promise.all([
        sessionsApi.filter(filter, {
          sort,
          search: search || undefined,
          limit: PAGE_SIZE,
          skip: (page - 1) * PAGE_SIZE,
        }),
        sessionsApi.count({ status: "in_progress" }),
        sessionsApi.count({ status: "completed" }),
        sessionsApi.aggregate({ query: { status: "completed" }, sum: ["energy_kwh", "cost"] }),
      ]);

      setSessions(pageResult.items || []);
      setTotal(pageResult.total || 0);
      setStats({
        active: Number(activeCount) || 0,
        completed: Number(completedCount) || 0,
        energy: Number(totals?.rows?.[0]?.sum_energy_kwh) || 0,
        cost: Number(totals?.rows?.[0]?.sum_cost) || 0,
      });
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [status, sort, search, page]);

  useEffect(() => { load(); }, [load]);

  const stopSession = async (session) => {
    setBusyId(session.id);
    try {
      await functionsApi.chargingSession({ action: "stop", session_id: session.id });
      toast({ title: "Session stopped", description: `${session.station_name} · ${session.point_code}` });
      await load();
    } catch (err) {
      toast({ title: "Could not stop session", description: getApiErrorMessage(err), variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  const hasFilters = status !== "all" || Boolean(search);
  const emptyState = useMemo(
    () => (
      <EmptyState
        icon={Activity}
        title={hasFilters ? "No sessions match your filters" : "No charging sessions yet"}
        description={
          hasFilters
            ? "Try a different status or clear the search box."
            : "Start a charging session from one of your confirmed bookings to see it here."
        }
        action={
          hasFilters ? (
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => { setStatus("all"); setSearchInput(""); }}
            >
              Clear filters
            </Button>
          ) : (
            <Button asChild className="rounded-xl bg-emerald-800 hover:bg-emerald-900">
              <Link to="/bookings">Go to my bookings</Link>
            </Button>
          )
        }
      />
    ),
    [hasFilters]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Charging"
        title="Charging sessions"
        description="Live and historical charging sessions with energy delivered, duration and cost."
        actions={
          <Button asChild className="rounded-xl bg-emerald-800 hover:bg-emerald-900">
            <Link to="/bookings"><Zap className="mr-2 h-4 w-4" /> Start from a booking</Link>
          </Button>
        }
      />

      {error ? (
        <ErrorBlock error={error} onRetry={load} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Active now" value={num(stats.active)} hint="Sessions in progress" icon={Activity} tone={stats.active ? "lime" : "slate"} />
            <StatCard label="Completed" value={num(stats.completed)} hint="Lifetime finished sessions" icon={Zap} tone="emerald" />
            <StatCard label="Energy delivered" value={`${num(stats.energy, 1)} kWh`} hint="Across completed sessions" icon={BatteryCharging} tone="sky" />
            <StatCard label="Charging spend" value={inr(stats.cost)} hint="Billed to completed sessions" icon={IndianRupee} tone="amber" />
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by station or point code…"
                aria-label="Search sessions"
                className="h-10 rounded-xl pl-9"
              />
            </div>
            <Select value={status} onValueChange={(value) => { setStatus(value); setPage(1); }}>
              <SelectTrigger className="h-10 w-full rounded-xl md:w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(value) => { setSort(value); setPage(1); }}>
              <SelectTrigger className="h-10 w-full rounded-xl md:w-[190px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading charging sessions…</p>
          ) : sessions.length === 0 ? (
            emptyState
          ) : (
            <>
              <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
                <div className="hidden grid-cols-12 gap-3 border-b border-border/60 bg-muted/40 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground md:grid">
                  <span className="col-span-3">Station</span>
                  <span className="col-span-2">Point</span>
                  <span className="col-span-3">Started</span>
                  <span className="col-span-1 text-right">Duration</span>
                  <span className="col-span-1 text-right">Energy</span>
                  <span className="col-span-2 text-right">Status</span>
                </div>
                <ul className="divide-y divide-border/60">
                  {sessions.map((session) => (
                    <li
                      key={session.id}
                      className="grid grid-cols-2 gap-3 px-5 py-4 text-sm transition-colors hover:bg-emerald-50/30 md:grid-cols-12 md:items-center"
                    >
                      <div className="col-span-2 md:col-span-3">
                        <Link
                          to={session.station_id ? `/stations/${session.station_id}` : "/sessions"}
                          className="font-medium text-foreground hover:text-emerald-800"
                        >
                          {session.station_name || "Unknown station"}
                        </Link>
                        <p className="text-[11px] text-muted-foreground">{session.vehicle_label || "No vehicle attached"}</p>
                      </div>
                      <p className="col-span-1 font-mono text-[12px] text-muted-foreground md:col-span-2">
                        {session.point_code || "—"}
                      </p>
                      <p className="col-span-1 text-xs text-muted-foreground md:col-span-3">
                        {fmtDateTime(session.start_time)}
                      </p>
                      <p className="col-span-1 inline-flex items-center justify-end gap-1 text-xs text-muted-foreground md:col-span-1">
                        <Clock className="h-3 w-3" /> {session.duration_minutes ?? 0}m
                      </p>
                      <div className="col-span-1 text-right md:col-span-1">
                        <p className="font-semibold text-foreground">{num(session.energy_kwh, 1)}</p>
                        <p className="text-[11px] text-muted-foreground">{inr(session.cost)}</p>
                      </div>
                      <div className="col-span-2 flex items-center justify-end gap-2 md:col-span-2">
                        <StatusBadge status={session.status} />
                        {session.status === "in_progress" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === session.id}
                            onClick={() => stopSession(session)}
                            className="h-7 rounded-md px-2 text-[11px] text-rose-700 hover:bg-rose-50"
                          >
                            {busyId === session.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <><Square className="mr-1 h-3 w-3" /> Stop</>
                            )}
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                <p className="text-xs text-muted-foreground">
                  Showing {rangeStart}–{rangeEnd} of {num(total)} session{total === 1 ? "" : "s"}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Previous
                  </Button>
                  <span className="text-xs text-muted-foreground">Page {page} of {pageCount}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    disabled={page >= pageCount}
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  >
                    Next <ChevronRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
