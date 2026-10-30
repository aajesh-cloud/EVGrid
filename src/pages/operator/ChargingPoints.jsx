import React, { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, Plug, Zap } from "lucide-react";
import { stationsApi, chargingPointsApi, getApiErrorMessage } from "@/api";
import { ErrorBlock } from "@/components/ev/DataState";
import PageHeader from "@/components/ev/PageHeader";
import StatusBadge from "@/components/ev/StatusBadge";
import EmptyState from "@/components/ev/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { CONNECTOR_TYPES, todayISO } from "@/lib/evgrid";

const BLANK = { code: "", connector_type: "CCS2", current_type: "DC", power_kw: 60, status: "available", serial_number: "" };
const POINT_STATUSES = ["available", "occupied", "reserved", "offline", "maintenance"];

export default function ChargingPoints() {
  const { toast } = useToast();
  const [stations, setStations] = useState([]);
  const [stationId, setStationId] = useState("");
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);

  const loadStations = async () => {
    setError(null);
    try {
      const page = await stationsApi.list({ sort: "name", limit: 100 });
      const items = page.items || [];
      setStations(items);
      setStationId(items[0]?.id || "");
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStations(); }, []);

  const loadPoints = async (id) => {
    if (!id) return setPoints([]);
    setError(null);
    try {
      const page = await chargingPointsApi.filter({ station_id: id }, { sort: "code", limit: 50 });
      setPoints(page.items || []);
    } catch (err) {
      setError(err);
    }
  };

  useEffect(() => { loadPoints(stationId); }, [stationId]);

  const reload = () => (stationId ? loadPoints(stationId) : loadStations());

  const station = stations.find((s) => s.id === stationId);

  const syncStation = async () => {
    try {
      const all = await chargingPointsApi.count({ station_id: stationId });
      if (station) await stationsApi.update(station.id, { total_points: all });
    } catch (err) {
      setError(err);
    }
  };

  const openCreate = () => { setEditing(null); setForm({ ...BLANK, code: `P${points.length + 1}` }); setOpen(true); };
  const openEdit = (p) => {
    setEditing(p);
    setForm({
      code: p.code || "", connector_type: p.connector_type || "CCS2", current_type: p.current_type || "DC",
      power_kw: p.power_kw || 60, status: p.status || "available", serial_number: p.serial_number || "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.code) {
      toast({ title: "Point code required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        station_id: stationId,
        station_name: station?.name || "",
        power_kw: Number(form.power_kw),
        last_serviced_date: todayISO(),
      };
      if (editing) {
        await chargingPointsApi.update(editing.id, payload);
        toast({ title: "Charging point updated" });
      } else {
        await chargingPointsApi.create(payload);
        toast({ title: "Charging point added" });
      }
      setOpen(false);
      await loadPoints(stationId);
      await syncStation();
    } catch (err) {
      toast({ title: "Could not save charging point", description: getApiErrorMessage(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (point, status) => {
    try {
      const updated = await chargingPointsApi.update(point.id, { status });
      setPoints((prev) => prev.map((p) => (p.id === point.id ? updated : p)));
      toast({ title: `${point.code} is now ${status}` });
    } catch (err) {
      toast({ title: "Could not update status", description: getApiErrorMessage(err), variant: "destructive" });
    }
  };

  const remove = async (point) => {
    try {
      await chargingPointsApi.delete(point.id);
      toast({ title: "Charging point removed" });
      await loadPoints(stationId);
      await syncStation();
    } catch (err) {
      toast({ title: "Could not remove charging point", description: getApiErrorMessage(err), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Charging points"
        description="Hardware inventory per station — connector type, power rating and live operating state."
        actions={
          <div className="flex gap-2">
            <Select value={stationId} onValueChange={setStationId}>
              <SelectTrigger className="h-10 w-[220px] rounded-xl"><SelectValue placeholder="Select station" /></SelectTrigger>
              <SelectContent>{stations.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button onClick={openCreate} disabled={!stationId} className="rounded-xl bg-emerald-800 hover:bg-emerald-900"><Plus className="mr-2 h-4 w-4" /> Add point</Button>
          </div>
        }
      />

      {error ? (
        <ErrorBlock error={error} onRetry={reload} />
      ) : loading ? <p className="text-sm text-muted-foreground">Loading…</p> : !stationId ? (
        <EmptyState icon={Plug} title="No stations available" description="Create a station first, then add its charging points." />
      ) : points.length === 0 ? (
        <EmptyState icon={Plug} title="No charging points at this station" description="Add the physical chargers installed at this location." action={<Button onClick={openCreate} className="rounded-xl bg-emerald-800 hover:bg-emerald-900">Add point</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {points.map((p) => (
            <div key={p.id} className="rounded-2xl border border-border/70 bg-card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-heading text-base font-semibold">{p.code}</p>
                  <p className="text-[11px] text-muted-foreground">{p.serial_number || "No serial recorded"}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600 hover:bg-rose-50" onClick={() => remove(p)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5"><Plug className="h-3 w-3" /> {p.connector_type}</span>
                <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5"><Zap className="h-3 w-3" /> {p.power_kw} kW {p.current_type}</span>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                <StatusBadge status={p.status} />
                <Select value={p.status} onValueChange={(v) => setStatus(p, v)}>
                  <SelectTrigger className="h-8 w-[130px] rounded-lg text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{POINT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">{editing ? "Edit charging point" : "Add charging point"}</DialogTitle>
            <DialogDescription>{station?.name}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Point code *</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="P1" />
            </div>
            <div className="space-y-1.5">
              <Label>Serial number</Label>
              <Input value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Connector</Label>
              <Select value={form.connector_type} onValueChange={(v) => setForm({ ...form, connector_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CONNECTOR_TYPES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Current type</Label>
              <Select value={form.current_type} onValueChange={(v) => setForm({ ...form, current_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="DC">DC</SelectItem><SelectItem value="AC">AC</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Power (kW)</Label>
              <Input type="number" value={form.power_kw} onChange={(e) => setForm({ ...form, power_kw: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{POINT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-emerald-800 hover:bg-emerald-900">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} {editing ? "Save point" : "Add point"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}