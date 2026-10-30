import React, { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, IndianRupee, Power } from "lucide-react";
import { stationsApi, tariffsApi, getApiErrorMessage } from "@/api";
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
import { fmtDate, inr, todayISO } from "@/lib/evgrid";

const BLANK = { name: "Standard", price_per_kwh: 18, session_fee: 20, idle_fee_per_min: 2, is_active: true, valid_from: todayISO() };

export default function Tariffs() {
  const { toast } = useToast();
  const [stations, setStations] = useState([]);
  const [stationId, setStationId] = useState("");
  const [tariffs, setTariffs] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const loadStations = async () => {
    setError(null);
    try {
      const page = await stationsApi.list({ sort: "name", limit: 100 });
      setStations(page.items || []);
      setStationId(page.items?.[0]?.id || "");
    } catch (err) {
      setError(err);
    }
  };

  useEffect(() => { loadStations(); }, []);

  const loadTariffs = async (id) => {
    if (!id) return;
    setError(null);
    try {
      const page = await tariffsApi.filter({ station_id: id }, { sort: "-created_date", limit: 20 });
      setTariffs(page.items || []);
    } catch (err) {
      setError(err);
    }
  };

  useEffect(() => { loadTariffs(stationId); }, [stationId]);

  const station = stations.find((s) => s.id === stationId);

  const openCreate = () => { setEditing(null); setForm(BLANK); setOpen(true); };
  const openEdit = (t) => {
    setEditing(t);
    setForm({
      name: t.name || "", price_per_kwh: t.price_per_kwh || 0, session_fee: t.session_fee || 0,
      idle_fee_per_min: t.idle_fee_per_min || 0, is_active: t.is_active !== false, valid_from: t.valid_from || todayISO(),
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name) {
      toast({ title: "Tariff name required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        station_id: stationId,
        station_name: station?.name || "",
        price_per_kwh: Number(form.price_per_kwh),
        session_fee: Number(form.session_fee),
        idle_fee_per_min: Number(form.idle_fee_per_min),
        currency: "INR",
      };
      if (editing) {
        await tariffsApi.update(editing.id, payload);
        toast({ title: "Tariff updated" });
      } else {
        await tariffsApi.create(payload);
        toast({ title: "Tariff created" });
      }
      setOpen(false);
      await loadTariffs(stationId);
    } catch (err) {
      toast({ title: "Could not save tariff", description: getApiErrorMessage(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (t) => {
    try {
      const updated = await tariffsApi.update(t.id, { is_active: !t.is_active });
      setTariffs((prev) => prev.map((x) => (x.id === t.id ? updated : x)));
      if (!t.is_active) {
        await stationsApi.update(stationId, { price_per_kwh: Number(t.price_per_kwh) });
      }
      toast({ title: updated.is_active ? "Tariff activated" : "Tariff deactivated" });
    } catch (err) {
      toast({ title: "Could not update tariff", description: getApiErrorMessage(err), variant: "destructive" });
    }
  };

  const remove = async (t) => {
    try {
      await tariffsApi.delete(t.id);
      toast({ title: "Tariff deleted" });
      loadTariffs(stationId);
    } catch (err) {
      toast({ title: "Could not delete tariff", description: getApiErrorMessage(err), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Tariff management"
        description="Set energy rates, session fees and idle charges. The active tariff is applied to new bookings."
        actions={
          <div className="flex gap-2">
            <Select value={stationId} onValueChange={setStationId}>
              <SelectTrigger className="h-10 w-[220px] rounded-xl"><SelectValue placeholder="Select station" /></SelectTrigger>
              <SelectContent>{stations.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button onClick={openCreate} disabled={!stationId} className="rounded-xl bg-emerald-800 hover:bg-emerald-900"><Plus className="mr-2 h-4 w-4" /> New tariff</Button>
          </div>
        }
      />

      {error ? (
        <ErrorBlock error={error} onRetry={() => (stationId ? loadTariffs(stationId) : loadStations())} />
      ) : tariffs.length === 0 ? (
        <EmptyState icon={IndianRupee} title="No tariffs configured" description="Add a tariff so drivers see a clear per-kWh price before booking." action={<Button onClick={openCreate} disabled={!stationId} className="rounded-xl bg-emerald-800 hover:bg-emerald-900">Create tariff</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {tariffs.map((t) => (
            <div key={t.id} className="rounded-2xl border border-border/70 bg-card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-heading text-base font-semibold">{t.name}</p>
                  <p className="text-[11px] text-muted-foreground">From {fmtDate(t.valid_from)}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600 hover:bg-rose-50" onClick={() => remove(t)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              <p className="mt-3 font-heading text-2xl font-bold text-emerald-900">{inr(t.price_per_kwh)}<span className="text-xs font-medium text-muted-foreground">/kWh</span></p>
              <dl className="mt-3 space-y-1.5 text-xs">
                <div className="flex justify-between"><dt className="text-muted-foreground">Session fee</dt><dd className="font-medium">{inr(t.session_fee)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Idle fee</dt><dd className="font-medium">{inr(t.idle_fee_per_min)}/min</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Currency</dt><dd className="font-medium">{t.currency || "INR"}</dd></div>
              </dl>
              <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                <StatusBadge status={t.is_active ? "active" : "offline"} label={t.is_active ? "Active" : "Inactive"} />
                <Button size="sm" variant="outline" onClick={() => toggleActive(t)} className="h-8 rounded-lg text-[11px]">
                  <Power className="mr-1.5 h-3.5 w-3.5" /> {t.is_active ? "Deactivate" : "Activate"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">{editing ? "Edit tariff" : "New tariff"}</DialogTitle>
            <DialogDescription>{station?.name}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Tariff name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Standard / Peak / Night" />
            </div>
            <div className="space-y-1.5">
              <Label>Price per kWh (₹)</Label>
              <Input type="number" step="0.1" value={form.price_per_kwh} onChange={(e) => setForm({ ...form, price_per_kwh: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Session fee (₹)</Label>
              <Input type="number" step="0.5" value={form.session_fee} onChange={(e) => setForm({ ...form, session_fee: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Idle fee (₹/min)</Label>
              <Input type="number" step="0.5" value={form.idle_fee_per_min} onChange={(e) => setForm({ ...form, idle_fee_per_min: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Valid from</Label>
              <Input type="date" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-emerald-800 hover:bg-emerald-900">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} {editing ? "Save tariff" : "Create tariff"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}