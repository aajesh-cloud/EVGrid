import React, { useEffect, useState } from "react";
import { Loader2, LogOut, Mail, ShieldCheck, UserRound, Plug } from "lucide-react";
import { vehiclesApi, sessionsApi, authApi, getApiErrorMessage } from "@/api";
import { ErrorBlock } from "@/components/ev/DataState";
import { useAuth } from "@/lib/AuthContext";
import PageHeader from "@/components/ev/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { CONNECTOR_TYPES, fmtDate, getRoles, labelize, num } from "@/lib/evgrid";

export default function Profile() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({ full_name: "", phone: "", city: "", favorite_connector: "CCS2", notifications_enabled: true });
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({ vehicles: 0, sessions: 0, energy: 0 });
  const [error, setError] = useState(null);
  const roles = getRoles(user);

  const loadStats = async () => {
    setError(null);
    try {
      const [vehicles, agg] = await Promise.all([
        vehiclesApi.count(),
        sessionsApi.aggregate({ query: { status: "completed" }, sum: ["energy_kwh"] }),
      ]);
      setStats({
        vehicles,
        sessions: agg?.rows?.[0]?.count || 0,
        energy: agg?.rows?.[0]?.sum_energy_kwh || 0,
      });
    } catch (err) {
      setError(err);
    }
  };

  useEffect(() => {
    setForm({
      full_name: user?.full_name || "",
      phone: user?.phone || "",
      city: user?.city || "",
      favorite_connector: user?.favorite_connector || "CCS2",
      notifications_enabled: user?.notifications_enabled !== false,
    });
    loadStats();
  }, [user]);

  const save = async () => {
    setSaving(true);
    try {
      await authApi.updateMe({
        full_name: form.full_name,
        phone: form.phone,
        city: form.city,
        favorite_connector: form.favorite_connector,
        notifications_enabled: form.notifications_enabled,
      });
      toast({ title: "Profile saved", description: "Your details are updated across the platform." });
    } catch (err) {
      toast({ title: "Could not save", description: getApiErrorMessage(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account"
        title="Profile & settings"
        description="Your identity, preferences and workspace access."
        actions={<Button variant="outline" onClick={() => logout()} className="rounded-xl text-rose-700 hover:bg-rose-50"><LogOut className="mr-2 h-4 w-4" /> Sign out</Button>}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-2xl border border-border/70 bg-card p-5 lg:col-span-2">
          <h2 className="font-heading text-[15px] font-semibold">Personal details</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Full name</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={user?.email || ""} disabled className="bg-muted/50" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" />
            </div>
            <div className="space-y-1.5">
              <Label>Home city</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Mumbai" />
            </div>
            <div className="space-y-1.5">
              <Label>Preferred connector</Label>
              <Select value={form.favorite_connector} onValueChange={(v) => setForm({ ...form, favorite_connector: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CONNECTOR_TYPES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border p-3 sm:col-span-2">
              <div>
                <p className="text-sm font-medium">Notification emails & alerts</p>
                <p className="text-xs text-muted-foreground">Booking confirmations, charging receipts and maintenance updates.</p>
              </div>
              <Switch checked={form.notifications_enabled} onCheckedChange={(v) => setForm({ ...form, notifications_enabled: v })} />
            </div>
          </div>
          <Button onClick={save} disabled={saving} className="mt-5 rounded-xl bg-emerald-800 hover:bg-emerald-900">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Save changes
          </Button>
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-border/70 bg-card p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-800 font-heading text-base font-bold text-emerald-50">
                {(user?.full_name || user?.email || "E").slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate font-heading text-sm font-semibold">{user?.full_name || "EVGrid member"}</p>
                <p className="flex items-center gap-1 truncate text-xs text-muted-foreground"><Mail className="h-3 w-3" /> {user?.email}</p>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-xs">
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Workspace roles</span><span className="font-medium">{roles.map(labelize).join(", ")}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Account role</span><span className="font-medium">{labelize(user?.app_role || user?.role || "ev_user")}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Member since</span><span className="font-medium">{fmtDate(user?.created_date)}</span></div>
            </div>
            <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-[11px] text-emerald-900/80">
              <span className="flex items-center gap-1.5 font-medium"><ShieldCheck className="h-3.5 w-3.5" /> Role assignments are managed by platform administrators.</span>
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-5">
            <h2 className="font-heading text-[15px] font-semibold">Your charging summary</h2>
            {error ? (
              <div className="mt-3"><ErrorBlock error={error} onRetry={loadStats} /></div>
            ) : (
            <dl className="mt-3 space-y-2.5 text-sm">
              <div className="flex items-center justify-between"><dt className="flex items-center gap-1.5 text-muted-foreground"><UserRound className="h-3.5 w-3.5" /> Vehicles</dt><dd className="font-semibold">{num(stats.vehicles)}</dd></div>
              <div className="flex items-center justify-between"><dt className="flex items-center gap-1.5 text-muted-foreground"><Plug className="h-3.5 w-3.5" /> Sessions</dt><dd className="font-semibold">{num(stats.sessions)}</dd></div>
              <div className="flex items-center justify-between"><dt className="text-muted-foreground">Energy delivered</dt><dd className="font-semibold">{num(stats.energy, 1)} kWh</dd></div>
            </dl>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}