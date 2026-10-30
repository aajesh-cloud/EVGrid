import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Pencil, Trash2, Loader2, MapPin, Building2 } from "lucide-react";
import { stationsApi, operatorsApi, getApiErrorMessage } from "@/api";
import { ErrorBlock } from "@/components/ev/DataState";
import PageHeader from "@/components/ev/PageHeader";
import StatusBadge from "@/components/ev/StatusBadge";
import EmptyState from "@/components/ev/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { CONNECTOR_TYPES, CITIES, inr } from "@/lib/evgrid";
import { cn } from "@/lib/utils";

const IMAGE = "/images/ev-charging3.jpg";
const BLANK = {
  name: "", city: "Mumbai", state: "Maharashtra", address: "", status: "online",
  connector_types: ["CCS2"], max_power_kw: 60, price_per_kwh: 18, operator_name: "",
  open_24h: true, opening_hours: "06:00 – 23:00", amenities: "", description: "", image_url: IMAGE,
};

export default function Stations() {
  const { toast } = useToast();
  const [stations, setStations] = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setError(null);
    try {
      const [stationPage, operatorPage] = await Promise.all([
        stationsApi.list({ sort: "-created_date", limit: 100 }),
        operatorsApi.list({ sort: "org_name", limit: 50 }),
      ]);
      setStations(stationPage.items || []);
      setOperators(operatorPage.items || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...BLANK, operator_name: operators[0]?.org_name || "" });
    setOpen(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setForm({
      name: s.name || "", city: s.city || "Mumbai", state: s.state || "", address: s.address || "",
      status: s.status || "online", connector_types: s.connector_types || [], max_power_kw: s.max_power_kw || 60,
      price_per_kwh: s.price_per_kwh || 18, operator_name: s.operator_name || "", open_24h: s.open_24h !== false,
      opening_hours: s.opening_hours || "", amenities: (s.amenities || []).join(", "), description: s.description || "",
      image_url: s.image_url || IMAGE,
    });
    setOpen(true);
  };

  const toggleConnector = (c) => {
    setForm((prev) => ({
      ...prev,
      connector_types: prev.connector_types.includes(c)
        ? prev.connector_types.filter((x) => x !== c)
        : [...prev.connector_types, c],
    }));
  };

  const save = async () => {
    if (!form.name || !form.address) {
      toast({ title: "Missing details", description: "Station name and address are required.", variant: "destructive" });
      return;
    }
    if (!form.connector_types.length) {
      toast({ title: "Select a connector", description: "At least one connector type is required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        max_power_kw: Number(form.max_power_kw),
        price_per_kwh: Number(form.price_per_kwh),
        amenities: form.amenities ? form.amenities.split(",").map((a) => a.trim()).filter(Boolean) : [],
      };
      if (editing) {
        await stationsApi.update(editing.id, payload);
        toast({ title: "Station updated" });
      } else {
        await stationsApi.create({ ...payload, rating: 0, review_count: 0, total_points: 0 });
        toast({ title: "Station created", description: `${payload.name} is now live on the network.` });
      }
      setOpen(false);
      await load();
    } catch (err) {
      toast({ title: "Could not save station", description: getApiErrorMessage(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s) => {
    try {
      await stationsApi.delete(s.id);
      toast({ title: "Station removed", description: `${s.name} was deleted from the network.` });
      load();
    } catch (err) {
      toast({ title: "Could not remove station", description: getApiErrorMessage(err), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Station management"
        description="Create and maintain charging locations, their tariffs and public availability."
        actions={<Button onClick={openCreate} className="rounded-xl bg-emerald-800 hover:bg-emerald-900"><Plus className="mr-2 h-4 w-4" /> Add station</Button>}
      />

      {error ? (
        <ErrorBlock error={error} onRetry={load} />
      ) : loading ? (
        <p className="text-sm text-muted-foreground">Loading stations…</p>
      ) : stations.length === 0 ? (
        <EmptyState icon={Building2} title="No stations yet" description="Add your first charging location to start accepting bookings." action={<Button onClick={openCreate} className="rounded-xl bg-emerald-800 hover:bg-emerald-900">Add station</Button>} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
          <div className="hidden grid-cols-12 gap-3 border-b border-border/60 bg-muted/40 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground lg:grid">
            <span className="col-span-4">Station</span>
            <span className="col-span-2">City</span>
            <span className="col-span-2">Power · tariff</span>
            <span className="col-span-2">Status</span>
            <span className="col-span-2 text-right">Actions</span>
          </div>
          <ul className="divide-y divide-border/60">
            {stations.map((s) => (
              <li key={s.id} className="grid grid-cols-2 gap-3 px-5 py-4 lg:grid-cols-12 lg:items-center">
                <div className="col-span-2 lg:col-span-4">
                  <Link to={`/stations/${s.id}`} className="font-heading text-sm font-semibold hover:text-emerald-800">{s.name}</Link>
                  <p className="text-[11px] text-muted-foreground">{s.address}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(s.connector_types || []).map((c) => <span key={c} className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground">{c}</span>)}
                  </div>
                </div>
                <p className="col-span-1 flex items-center gap-1 text-xs text-muted-foreground lg:col-span-2"><MapPin className="h-3 w-3" /> {s.city}</p>
                <p className="col-span-1 text-right text-xs text-muted-foreground lg:col-span-2 lg:text-left">{s.max_power_kw} kW · {inr(s.price_per_kwh)}</p>
                <div className="col-span-1 lg:col-span-2"><StatusBadge status={s.status} /></div>
                <div className="col-span-1 flex justify-end gap-1 lg:col-span-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600 hover:bg-rose-50" onClick={() => remove(s)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">{editing ? "Edit station" : "Add a charging station"}</DialogTitle>
            <DialogDescription>Location, hardware and pricing shown to drivers on the discovery page.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Station name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="VoltHub BKC" />
            </div>
            <div className="space-y-1.5">
              <Label>City</Label>
              <Select value={form.city} onValueChange={(v) => setForm({ ...form, city: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>State</Label>
              <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="Maharashtra" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Address *</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Bandra Kurla Complex, Mumbai" />
            </div>
            <div className="space-y-1.5">
              <Label>Operator</Label>
              <Select value={form.operator_name || "none"} onValueChange={(v) => setForm({ ...form, operator_name: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Assign operator" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {operators.map((o) => <SelectItem key={o.id} value={o.org_name}>{o.org_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Operating status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Max power (kW)</Label>
              <Input type="number" value={form.max_power_kw} onChange={(e) => setForm({ ...form, max_power_kw: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Tariff (₹ per kWh)</Label>
              <Input type="number" step="0.1" value={form.price_per_kwh} onChange={(e) => setForm({ ...form, price_per_kwh: e.target.value })} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Connector types</Label>
              <div className="flex flex-wrap gap-2">
                {CONNECTOR_TYPES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleConnector(c)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                      form.connector_types.includes(c)
                        ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                        : "border-border bg-card text-muted-foreground hover:border-emerald-300"
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Opening hours</Label>
              <Input value={form.opening_hours} onChange={(e) => setForm({ ...form, opening_hours: e.target.value })} placeholder="06:00 – 23:00" disabled={form.open_24h} />
            </div>
            <div className="space-y-1.5">
              <Label>Amenities (comma separated)</Label>
              <Input value={form.amenities} onChange={(e) => setForm({ ...form, amenities: e.target.value })} placeholder="Café, Restrooms, WiFi" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Description</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-emerald-800 hover:bg-emerald-900">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editing ? "Save station" : "Create station"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}