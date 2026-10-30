import React, { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, Building2, Mail, Phone } from "lucide-react";
import { operatorsApi, stationsApi } from "@/api";
import PageHeader from "@/components/ev/PageHeader";
import { ErrorBlock } from "@/components/ev/DataState";
import StatusBadge from "@/components/ev/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { fmtDate, todayISO } from "@/lib/evgrid";

const BLANK = {
  org_name: "", contact_name: "", email: "", phone: "", city: "Mumbai",
  status: "pending", commission_percent: 8, onboarded_date: todayISO(),
};

export default function AdminOperators() {
  const { toast } = useToast();
  const [operators, setOperators] = useState([]);
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      const [operatorPage, stationPage] = await Promise.all([
        operatorsApi.list({ sort: "org_name", limit: 100 }),
        stationsApi.list({ limit: 200 }),
      ]);
      setOperators(operatorPage.items || []);
      setStations(stationPage.items || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(BLANK); setOpen(true); };
  const openEdit = (o) => {
    setEditing(o);
    setForm({
      org_name: o.org_name || "", contact_name: o.contact_name || "", email: o.email || "", phone: o.phone || "",
      city: o.city || "Mumbai", status: o.status || "pending", commission_percent: o.commission_percent || 8,
      onboarded_date: o.onboarded_date || todayISO(),
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.org_name || !form.email) {
      toast({ title: "Organisation name and email are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, commission_percent: Number(form.commission_percent) };
      if (editing) {
        await operatorsApi.update(editing.id, payload);
        toast({ title: "Operator updated" });
      } else {
        await operatorsApi.create({ ...payload, stations_count: 0 });
        toast({ title: "Operator onboarded" });
      }
      setOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (o) => {
    await operatorsApi.delete(o.id);
    toast({ title: "Operator removed" });
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Governance"
        title="Charging operators"
        description="Organisations running stations on the EVGrid network, their status and commission."
        actions={<Button onClick={openCreate} className="rounded-xl bg-emerald-800 hover:bg-emerald-900"><Plus className="mr-2 h-4 w-4" /> Add operator</Button>}
      />

      {error ? (
        <ErrorBlock error={error} onRetry={load} />
      ) : loading ? <p className="text-sm text-muted-foreground">Loading operators…</p> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {operators.map((o) => {
            const count = stations.filter((s) => s.operator_name === o.org_name).length;
            return (
              <div key={o.id} className="rounded-2xl border border-border/70 bg-card p-5">
                <div className="flex items-start justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Building2 className="h-5 w-5" strokeWidth={1.8} /></span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(o)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600 hover:bg-rose-50" onClick={() => remove(o)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                <h3 className="mt-3 font-heading text-base font-semibold">{o.org_name}</h3>
                <p className="text-xs text-muted-foreground">{o.contact_name || "No contact"} · {o.city}</p>
                <div className="mt-2 flex flex-col gap-1 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {o.email}</span>
                  {o.phone ? <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {o.phone}</span> : null}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                  <StatusBadge status={o.status} />
                  <span className="text-[11px] text-muted-foreground">{count} station(s) · {o.commission_percent}% fee</span>
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">Onboarded {fmtDate(o.onboarded_date)}</p>
              </div>
            );
          })}
          {operators.length === 0 ? <p className="text-sm text-muted-foreground">No operators yet.</p> : null}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">{editing ? "Edit operator" : "Add operator"}</DialogTitle>
            <DialogDescription>Operators are attributed to stations and see their own operational dashboards.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Organisation name *</Label>
              <Input value={form.org_name} onChange={(e) => setForm({ ...form, org_name: e.target.value })} placeholder="VoltHub Charging Pvt Ltd" />
            </div>
            <div className="space-y-1.5">
              <Label>Contact person</Label>
              <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Commission (%)</Label>
              <Input type="number" step="0.5" value={form.commission_percent} onChange={(e) => setForm({ ...form, commission_percent: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-emerald-800 hover:bg-emerald-900">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} {editing ? "Save operator" : "Add operator"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}