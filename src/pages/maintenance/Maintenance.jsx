import React, { useEffect, useState } from "react";
import { Plus, Loader2, Wrench, UserCheck, ClipboardList } from "lucide-react";
import { maintenanceApi, stationsApi, techniciansApi, chargingPointsApi, authApi, getApiErrorMessage } from "@/api";
import { ErrorBlock } from "@/components/ev/DataState";
import PageHeader from "@/components/ev/PageHeader";
import StatCard from "@/components/ev/StatCard";
import StatusBadge from "@/components/ev/StatusBadge";
import EmptyState from "@/components/ev/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { fmtDate, todayISO } from "@/lib/evgrid";

const STATUS_TABS = ["all", "open", "assigned", "in_progress", "resolved"];

export default function Maintenance() {
  const { toast } = useToast();
  const [records, setRecords] = useState([]);
  const [stations, setStations] = useState([]);
  const [points, setPoints] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [tab, setTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [assigning, setAssigning] = useState(null);
  const [technicianEmail, setTechnicianEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    station_id: "", point_id: "", title: "", description: "", category: "hardware", priority: "medium",
  });
  const [error, setError] = useState(null);

  const load = async () => {
    setError(null);
    try {
      const [recordsPage, stationsPage, techniciansPage, pointsPage] = await Promise.all([
        maintenanceApi.filter({}, { sort: "-reported_date", limit: 100 }),
        stationsApi.list({ sort: "name", limit: 100 }),
        techniciansApi.list({ sort: "name", limit: 50 }),
        chargingPointsApi.list({ limit: 200 }),
      ]);
      setRecords(recordsPage.items || []);
      setStations(stationsPage.items || []);
      setTechnicians(techniciansPage.items || []);
      setPoints(pointsPage.items || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = tab === "all" ? records : records.filter((r) => r.status === tab);
  const openCount = records.filter((r) => ["open", "assigned", "in_progress"].includes(r.status)).length;

  const openCreate = () => {
    const firstStation = stations[0];
    setForm({
      station_id: firstStation?.id || "",
      point_id: (points.find((p) => p.station_id === firstStation?.id) || {}).id || "",
      title: "", description: "", category: "hardware", priority: "medium",
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.station_id || !form.title) {
      toast({ title: "Missing details", description: "Station and issue title are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const station = stations.find((s) => s.id === form.station_id);
      const point = points.find((p) => p.id === form.point_id);
      await maintenanceApi.create({
        ...form,
        station_name: station?.name || "",
        point_code: point?.code || "",
        status: "open",
        reported_date: todayISO(),
        reported_by_name: (await authApi.me())?.full_name || "",
      });
      if (point) await chargingPointsApi.update(point.id, { status: "maintenance" });
      toast({ title: "Issue reported", description: "The maintenance queue has been notified." });
      setOpen(false);
      await load();
    } catch (err) {
      toast({ title: "Could not report issue", description: getApiErrorMessage(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const assign = async () => {
    const tech = technicians.find((t) => t.email === technicianEmail);
    if (!tech) return;
    setSaving(true);
    try {
      await maintenanceApi.update(assigning.id, {
        status: "assigned",
        assigned_to: tech.name,
        assigned_email: tech.email,
      });
      toast({ title: "Technician assigned", description: `${tech.name} will handle this job.` });
      setAssigning(null);
      await load();
    } catch (err) {
      toast({ title: "Could not assign technician", description: getApiErrorMessage(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (record, status) => {
    const payload = { status };
    try {
      if (status === "resolved") {
        payload.resolved_date = todayISO();
        if (record.point_id) await chargingPointsApi.update(record.point_id, { status: "available" });
      }
      const updated = await maintenanceApi.update(record.id, payload);
      setRecords((prev) => prev.map((r) => (r.id === record.id ? updated : r)));
      toast({ title: `Marked ${status.replace("_", " ")}` });
    } catch (err) {
      toast({ title: "Could not update status", description: getApiErrorMessage(err), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Maintenance"
        title="Maintenance records"
        description="Fault reports, technician assignments and resolution history across the network."
        actions={<Button onClick={openCreate} className="rounded-xl bg-emerald-800 hover:bg-emerald-900"><Plus className="mr-2 h-4 w-4" /> Report issue</Button>}
      />

      {error ? (
        <ErrorBlock error={error} onRetry={load} />
      ) : (
        <>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Open issues" value={openCount} hint="Awaiting resolution" icon={Wrench} tone="amber" />
        <StatCard label="Assigned" value={records.filter((r) => ["assigned", "in_progress"].includes(r.status)).length} hint="With technicians" icon={UserCheck} tone="sky" />
        <StatCard label="Resolved" value={records.filter((r) => r.status === "resolved").length} hint="Lifetime" icon={ClipboardList} tone="emerald" />
      </div>

      <div className="flex flex-wrap gap-1.5 rounded-xl border border-border/70 bg-card p-1.5">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
              tab === s ? "bg-emerald-800 text-white" : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading maintenance records…</p>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Wrench} title="No records in this view" description="Nothing matches this status filter right now." />
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div key={r.id} className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-heading text-[15px] font-semibold">{r.title}</p>
                    <StatusBadge status={r.status} />
                    <StatusBadge status={r.priority} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.station_name}{r.point_code ? ` · ${r.point_code}` : ""} · {r.category} · reported {fmtDate(r.reported_date)}
                    {r.assigned_to ? ` · assigned to ${r.assigned_to}` : ""}
                    {r.resolved_date ? ` · resolved ${fmtDate(r.resolved_date)}` : ""}
                  </p>
                  <p className="mt-1.5 text-sm text-muted-foreground">{r.description}</p>
                  {r.resolution_notes ? <p className="mt-1 text-xs italic text-emerald-800">“{r.resolution_notes}”</p> : null}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {!r.assigned_to && r.status !== "resolved" ? (
                    <Button size="sm" variant="outline" onClick={() => { setAssigning(r); setTechnicianEmail(technicians[0]?.email || ""); }} className="rounded-lg">Assign</Button>
                  ) : null}
                  <Select value={r.status} onValueChange={(v) => updateStatus(r, v)}>
                    <SelectTrigger className="h-8 w-[150px] rounded-lg text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="assigned">Assigned</SelectItem>
                      <SelectItem value="in_progress">In progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Report a charging issue</DialogTitle>
            <DialogDescription>Faults immediately place the charging point into maintenance.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Station</Label>
              <Select value={form.station_id} onValueChange={(v) => setForm({ ...form, station_id: v, point_id: "" })}>
                <SelectTrigger><SelectValue placeholder="Select station" /></SelectTrigger>
                <SelectContent>{stations.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Charging point (optional)</Label>
              <Select value={form.point_id || "none"} onValueChange={(v) => setForm({ ...form, point_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Whole station" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Whole station</SelectItem>
                  {points.filter((p) => p.station_id === form.station_id).map((p) => <SelectItem key={p.id} value={p.id}>{p.code} · {p.connector_type}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Issue title *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Connector latch not locking" />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["hardware", "software", "cable", "connector", "network", "other"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["low", "medium", "high", "critical"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Description</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe what the driver reported and any error codes." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={saving} className="bg-emerald-800 hover:bg-emerald-900">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Report issue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!assigning} onOpenChange={(o) => !o && setAssigning(null)}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Assign technician</DialogTitle>
            <DialogDescription>{assigning?.title} · {assigning?.station_name}</DialogDescription>
          </DialogHeader>
          <Select value={technicianEmail} onValueChange={setTechnicianEmail}>
            <SelectTrigger><SelectValue placeholder="Select technician" /></SelectTrigger>
            <SelectContent>
              {technicians.map((t) => (
                <SelectItem key={t.id} value={t.email}>{t.name} · {t.city} · {t.specialization}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssigning(null)}>Cancel</Button>
            <Button onClick={assign} disabled={saving || !technicianEmail} className="bg-emerald-800 hover:bg-emerald-900">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Assign job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}