import React, { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Plug, RefreshCw, ServerCrash, Settings as SettingsIcon, ShieldCheck } from "lucide-react";
import { API_BASE_URL, authApi, getApiErrorMessage, systemApi } from "@/api";
import { useAuth } from "@/lib/AuthContext";
import PageHeader from "@/components/ev/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { CONNECTOR_TYPES, CITIES, getRoles, labelize } from "@/lib/evgrid";
import { cn } from "@/lib/utils";

const IDLE = { state: "idle", message: null };

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({
    full_name: "",
    city: "",
    favorite_connector: "CCS2",
    notifications_enabled: true,
    auto_charge_reminders: true,
  });
  const [saving, setSaving] = useState(false);
  const [health, setHealth] = useState(IDLE);

  useEffect(() => {
    setForm({
      full_name: user?.full_name || "",
      city: user?.city || "",
      favorite_connector: user?.favorite_connector || "CCS2",
      notifications_enabled: user?.notifications_enabled !== false,
      auto_charge_reminders: user?.auto_charge_reminders !== false,
    });
  }, [user]);

  const save = async () => {
    setSaving(true);
    try {
      await authApi.updateMe({
        full_name: form.full_name,
        city: form.city,
        favorite_connector: form.favorite_connector,
        notifications_enabled: form.notifications_enabled,
        auto_charge_reminders: form.auto_charge_reminders,
      });
      toast({ title: "Preferences saved", description: "Your workspace settings were updated." });
    } catch (err) {
      toast({ title: "Could not save", description: getApiErrorMessage(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setHealth({ state: "loading", message: null });
    try {
      const result = await systemApi.health();
      setHealth({
        state: "ok",
        message: result?.status ? `Backend responded with status "${result.status}".` : "Backend is reachable.",
      });
    } catch (err) {
      setHealth({ state: "error", message: getApiErrorMessage(err) });
    }
  };

  const roles = getRoles(user);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        description="Application preferences, notification controls and backend connectivity."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-2xl border border-border/70 bg-card p-5 lg:col-span-2">
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4 text-emerald-700" />
            <h2 className="font-heading text-[15px] font-semibold">Preferences</h2>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Display name</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Your name" />
            </div>
            <div className="space-y-1.5">
              <Label>Home city</Label>
              <Select value={form.city || undefined} onValueChange={(v) => setForm({ ...form, city: v })}>
                <SelectTrigger><SelectValue placeholder="Select a city" /></SelectTrigger>
                <SelectContent>{CITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
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
            <div className="flex items-center justify-between rounded-xl border border-border p-3 sm:col-span-2">
              <div>
                <p className="text-sm font-medium">Charge session reminders</p>
                <p className="text-xs text-muted-foreground">Nudge me before a scheduled booking and when a session completes.</p>
              </div>
              <Switch checked={form.auto_charge_reminders} onCheckedChange={(v) => setForm({ ...form, auto_charge_reminders: v })} />
            </div>
          </div>
          <Button onClick={save} disabled={saving} className="mt-5 rounded-xl bg-emerald-800 hover:bg-emerald-900">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Save preferences
          </Button>
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-border/70 bg-card p-5">
            <div className="flex items-center gap-2">
              <Plug className="h-4 w-4 text-emerald-700" />
              <h2 className="font-heading text-[15px] font-semibold">Backend connection</h2>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              The frontend talks to a Node.js + Express API backed by MySQL.
            </p>
            <div className="mt-3 rounded-xl bg-muted/50 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">API base URL</p>
              <p className="mt-0.5 break-all font-mono text-[11px] text-foreground">{API_BASE_URL}</p>
            </div>

            {health.state === "ok" ? (
              <p className="mt-3 flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs text-emerald-900">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {health.message}
              </p>
            ) : null}
            {health.state === "error" ? (
              <p className="mt-3 flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-xs text-rose-900">
                <ServerCrash className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {health.message}
              </p>
            ) : null}

            <Button
              variant="outline"
              onClick={testConnection}
              disabled={health.state === "loading"}
              className="mt-3 w-full rounded-xl"
            >
              {health.state === "loading"
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <RefreshCw className="mr-2 h-4 w-4" />}
              Test connection
            </Button>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-5">
            <h2 className="font-heading text-[15px] font-semibold">Account</h2>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Email</span><span className="truncate font-medium">{user?.email || "—"}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Account role</span><span className="font-medium">{labelize(user?.app_role || user?.role || "ev_user")}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Workspace roles</span><span className="font-medium">{roles.map(labelize).join(", ")}</span></div>
            </div>
            <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-[11px] text-emerald-900/80">
              <span className="flex items-center gap-1.5 font-medium"><ShieldCheck className="h-3.5 w-3.5" /> Role assignments are managed by platform administrators.</span>
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-5">
            <h2 className="font-heading text-[15px] font-semibold">Appearance</h2>
            <p className="mt-1.5 text-xs text-muted-foreground">EVGrid ships with an optimised dark interface by default.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className={cn("rounded-xl border p-3 text-center", "border-emerald-300 bg-emerald-50/60")}>
                <div className="mx-auto h-8 w-full rounded-md bg-slate-900" />
                <p className="mt-2 text-[11px] font-semibold text-emerald-800">Dark · active</p>
              </div>
              <div className="rounded-xl border border-border p-3 text-center opacity-55">
                <div className="mx-auto h-8 w-full rounded-md bg-slate-200" />
                <p className="mt-2 text-[11px] font-medium text-muted-foreground">Light · planned</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
