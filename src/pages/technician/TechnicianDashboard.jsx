import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Wrench, ClipboardList, CheckCircle2, AlertTriangle, Loader2, MapPin, ArrowRight } from "lucide-react";
import { maintenanceApi, chargingPointsApi, getApiErrorMessage } from "@/api";
import { ErrorBlock } from "@/components/ev/DataState";
import { useAuth } from "@/lib/AuthContext";
import PageHeader from "@/components/ev/PageHeader";
import StatCard from "@/components/ev/StatCard";
import StatusBadge from "@/components/ev/StatusBadge";
import EmptyState from "@/components/ev/EmptyState";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { fmtDate, todayISO } from "@/lib/evgrid";

export default function TechnicianDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resolving, setResolving] = useState(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setError(null);
    try {
      const page = await maintenanceApi.filter({}, { sort: "-reported_date", limit: 100 });
      setRecords(page.items || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const myEmail = (user?.email || "").toLowerCase();
  const myJobs = records.filter((r) => (r.assigned_email || "").toLowerCase() === myEmail || (!r.assigned_email && r.status === "open"));
  const active = myJobs.filter((r) => ["open", "assigned", "in_progress"].includes(r.status));
  const resolved = myJobs.filter((r) => r.status === "resolved");

  const startJob = async (record) => {
    setBusy(true);
    try {
      await maintenanceApi.update(record.id, {
        status: "in_progress",
        assigned_to: record.assigned_to || user?.full_name || "",
        assigned_email: record.assigned_email || user?.email || "",
      });
      toast({ title: "Job started", description: `${record.station_name} · ${record.point_code || "station"}` });
      await load();
    } catch (err) {
      toast({ title: "Could not start job", description: getApiErrorMessage(err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const resolve = async () => {
    if (!resolving) return;
    setBusy(true);
    try {
      await maintenanceApi.update(resolving.id, {
        status: "resolved",
        resolved_date: todayISO(),
        resolution_notes: notes,
        assigned_to: resolving.assigned_to || user?.full_name || "",
        assigned_email: resolving.assigned_email || user?.email || "",
      });
      if (resolving.point_id) {
        await chargingPointsApi.update(resolving.point_id, { status: "available" });
      }
      toast({ title: "Issue resolved", description: "The charging point is back in service." });
      setResolving(null);
      setNotes("");
      await load();
    } catch (err) {
      toast({ title: "Could not resolve issue", description: getApiErrorMessage(err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Field operations"
        title="Technician workspace"
        description="Your assigned maintenance jobs, station context and resolution history."
        actions={<Button asChild variant="outline" className="rounded-xl"><Link to="/maintenance">Full queue <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Link></Button>}
      />

      {error ? (
        <ErrorBlock error={error} onRetry={load} />
      ) : (
        <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active jobs" value={active.length} hint="Assigned to you" icon={Wrench} tone="amber" />
        <StatCard label="In progress" value={myJobs.filter((r) => r.status === "in_progress").length} hint="On site now" icon={ClipboardList} tone="sky" />
        <StatCard label="Resolved" value={resolved.length} hint="Closed by you" icon={CheckCircle2} tone="emerald" />
        <StatCard label="Critical" value={active.filter((r) => r.priority === "critical").length} hint="Escalate first" icon={AlertTriangle} tone="rose" />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading your jobs…</p>
      ) : active.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="No active jobs" description="You are all clear. New faults assigned to you will appear here." />
      ) : (
        <div className="space-y-3">
          {active.map((r) => (
            <div key={r.id} className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700">
                    <Wrench className="h-5 w-5" strokeWidth={1.8} />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-heading text-[15px] font-semibold">{r.title}</p>
                      <StatusBadge status={r.status} />
                      <StatusBadge status={r.priority} />
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {r.station_name} {r.point_code ? `· ${r.point_code}` : ""}</span>
                      <span>Reported {fmtDate(r.reported_date)}</span>
                      <span className="capitalize">{r.category}</span>
                    </p>
                    <p className="mt-1.5 text-sm text-muted-foreground">{r.description}</p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  {r.status !== "in_progress" ? (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => startJob(r)} className="rounded-lg">Start job</Button>
                  ) : null}
                  <Button size="sm" onClick={() => { setResolving(r); setNotes(""); }} className="rounded-lg bg-emerald-800 hover:bg-emerald-900">Resolve</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {resolved.length > 0 ? (
        <div className="rounded-2xl border border-border/70 bg-card p-5">
          <h3 className="font-heading text-[15px] font-semibold">Recently resolved</h3>
          <ul className="mt-3 divide-y divide-border/60">
            {resolved.slice(0, 5).map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium">{r.title}</p>
                  <p className="text-xs text-muted-foreground">{r.station_name} · resolved {fmtDate(r.resolved_date)}</p>
                  {r.resolution_notes ? <p className="mt-0.5 text-xs text-muted-foreground">“{r.resolution_notes}”</p> : null}
                </div>
                <StatusBadge status="resolved" />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
        </>
      )}

      <Dialog open={!!resolving} onOpenChange={(o) => !o && setResolving(null)}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Resolve maintenance task</DialogTitle>
            <DialogDescription>{resolving?.title} · {resolving?.station_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Resolution notes</p>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Replaced the CCS2 connector latch and tested a 20-minute charge." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolving(null)}>Cancel</Button>
            <Button onClick={resolve} disabled={busy} className="bg-emerald-800 hover:bg-emerald-900">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Mark resolved
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}