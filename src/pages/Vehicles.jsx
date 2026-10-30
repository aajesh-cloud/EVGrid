import React, { useEffect, useState } from "react";
import { Car, Plus, Pencil, Trash2, BatteryCharging, Loader2, Plug } from "lucide-react";
import { vehiclesApi, getApiErrorMessage } from "@/api";
import { ErrorBlock } from "@/components/ev/DataState";
import PageHeader from "@/components/ev/PageHeader";
import EmptyState from "@/components/ev/EmptyState";
import StatusBadge from "@/components/ev/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { CONNECTOR_TYPES, num } from "@/lib/evgrid";

const BLANK = {
  nickname: "", make: "", model: "", year: new Date().getFullYear(),
  registration_number: "", battery_capacity_kwh: 40, range_km: 300, connector_type: "CCS2", is_primary: false,
};

export default function Vehicles() {
  const { toast } = useToast();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setError(null);
    try {
      const page = await vehiclesApi.filter({}, { sort: "-created_date", limit: 50 });
      setVehicles(page.items || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(BLANK); setOpen(true); };
  const openEdit = (v) => {
    setEditing(v);
    setForm({
      nickname: v.nickname || "", make: v.make || "", model: v.model || "", year: v.year || new Date().getFullYear(),
      registration_number: v.registration_number || "", battery_capacity_kwh: v.battery_capacity_kwh || 40,
      range_km: v.range_km || 300, connector_type: v.connector_type || "CCS2", is_primary: !!v.is_primary,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.make || !form.model || !form.registration_number) {
      toast({ title: "Missing details", description: "Make, model and registration number are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        year: Number(form.year),
        battery_capacity_kwh: Number(form.battery_capacity_kwh),
        range_km: Number(form.range_km),
        registration_number: form.registration_number.toUpperCase(),
      };
      if (editing) {
        await vehiclesApi.update(editing.id, payload);
        toast({ title: "Vehicle updated" });
      } else {
        await vehiclesApi.create(payload);
        toast({ title: "Vehicle added", description: `${payload.make} ${payload.model} is now available for bookings.` });
      }
      setOpen(false);
      await load();
    } catch (err) {
      toast({ title: "Could not save vehicle", description: getApiErrorMessage(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (v) => {
    try {
      await vehiclesApi.delete(v.id);
      toast({ title: "Vehicle removed" });
      load();
    } catch (err) {
      toast({ title: "Could not remove vehicle", description: getApiErrorMessage(err), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Garage"
        title="My vehicles"
        description="Register your EVs so bookings and charging sessions are attributed to the right battery and connector."
        actions={<Button onClick={openCreate} className="rounded-xl bg-emerald-800 hover:bg-emerald-900"><Plus className="mr-2 h-4 w-4" /> Add vehicle</Button>}
      />

      {error ? (
        <ErrorBlock error={error} onRetry={load} />
      ) : loading ? (
        <p className="text-sm text-muted-foreground">Loading your garage…</p>
      ) : vehicles.length === 0 ? (
        <EmptyState
          icon={Car}
          title="No vehicles registered"
          description="Add your first EV to unlock one-tap bookings and accurate energy estimates."
          action={<Button onClick={openCreate} className="rounded-xl bg-emerald-800 hover:bg-emerald-900"><Plus className="mr-2 h-4 w-4" /> Add your EV</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {vehicles.map((v) => (
            <div key={v.id} className="rounded-2xl border border-border/70 bg-card p-5 transition-shadow hover:shadow-[0_18px_40px_-30px_rgba(6,78,59,0.5)]">
              <div className="flex items-start justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                  <Car className="h-5 w-5" strokeWidth={1.8} />
                </span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(v)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600 hover:bg-rose-50" onClick={() => remove(v)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              <h3 className="mt-3 font-heading text-base font-semibold">{v.nickname || `${v.make} ${v.model}`}</h3>
              <p className="text-xs text-muted-foreground">{v.make} {v.model} · {v.year}</p>
              <p className="mt-1 inline-flex rounded-md bg-secondary px-2 py-0.5 font-mono text-[11px] font-medium text-secondary-foreground">{v.registration_number}</p>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border/60 pt-3 text-center">
                <div>
                  <p className="font-heading text-sm font-semibold">{num(v.battery_capacity_kwh, 1)}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">kWh</p>
                </div>
                <div>
                  <p className="font-heading text-sm font-semibold">{num(v.range_km)}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">km range</p>
                </div>
                <div>
                  <p className="truncate text-sm font-semibold">{v.connector_type}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">connector</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <StatusBadge status={v.is_primary ? "confirmed" : "offline"} label={v.is_primary ? "Primary vehicle" : "Secondary"} />
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Plug className="h-3 w-3" /> {v.connector_type}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">{editing ? "Edit vehicle" : "Add a vehicle"}</DialogTitle>
            <DialogDescription>Battery size and connector type drive the energy estimate shown at booking.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nickname</Label>
              <Input value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} placeholder="Weekend car" />
            </div>
            <div className="space-y-1.5">
              <Label>Make *</Label>
              <Input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} placeholder="Tata" />
            </div>
            <div className="space-y-1.5">
              <Label>Model *</Label>
              <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="Nexon EV" />
            </div>
            <div className="space-y-1.5">
              <Label>Year</Label>
              <Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Registration number *</Label>
              <Input value={form.registration_number} onChange={(e) => setForm({ ...form, registration_number: e.target.value })} placeholder="MH 01 AB 1234" />
            </div>
            <div className="space-y-1.5">
              <Label>Battery (kWh)</Label>
              <Input type="number" step="0.1" value={form.battery_capacity_kwh} onChange={(e) => setForm({ ...form, battery_capacity_kwh: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Range (km)</Label>
              <Input type="number" value={form.range_km} onChange={(e) => setForm({ ...form, range_km: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Connector type</Label>
              <Select value={form.connector_type} onValueChange={(v) => setForm({ ...form, connector_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CONNECTOR_TYPES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border p-3 sm:col-span-2">
              <div>
                <p className="text-sm font-medium">Primary vehicle</p>
                <p className="text-xs text-muted-foreground">Pre-selected when you book a slot.</p>
              </div>
              <Switch checked={form.is_primary} onCheckedChange={(v) => setForm({ ...form, is_primary: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-emerald-800 hover:bg-emerald-900">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BatteryCharging className="mr-2 h-4 w-4" />}
              {editing ? "Save changes" : "Add vehicle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}