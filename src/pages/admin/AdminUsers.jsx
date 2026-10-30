import React, { useEffect, useState } from "react";
import { UserPlus, Loader2, Search, ShieldCheck } from "lucide-react";
import { usersApi, getApiErrorMessage } from "@/api";
import PageHeader from "@/components/ev/PageHeader";
import { ErrorBlock } from "@/components/ev/DataState";
import StatCard from "@/components/ev/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { fmtDate, labelize } from "@/lib/evgrid";

const APP_ROLES = ["ev_user", "operator", "technician", "admin"];

export default function AdminUsers() {
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      const page = await usersApi.list();
      setUsers(page.items || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const invite = async () => {
    if (!inviteEmail) return;
    setSaving(true);
    try {
      await usersApi.invite(inviteEmail, inviteRole);
      toast({ title: "Invitation sent", description: `${inviteEmail} was invited as ${inviteRole}.` });
      setOpen(false);
      setInviteEmail("");
      await load();
    } catch (err) {
      toast({ title: "Invite failed", description: getApiErrorMessage(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const changeAppRole = async (user, appRole) => {
    try {
      await usersApi.update(user.id, { app_role: appRole });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, app_role: appRole } : u)));
      toast({ title: "Role updated", description: `${user.full_name || user.email} is now ${labelize(appRole)}.` });
    } catch (err) {
      toast({ title: "Could not update role", description: getApiErrorMessage(err), variant: "destructive" });
    }
  };

  const filtered = users.filter((u) =>
    `${u.full_name || ""} ${u.email || ""}`.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Governance"
        title="App users"
        description="Invite team members and assign their workspace role. Role changes take effect immediately."
        actions={<Button onClick={() => setOpen(true)} className="rounded-xl bg-emerald-800 hover:bg-emerald-900"><UserPlus className="mr-2 h-4 w-4" /> Invite user</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total users" value={loading ? "—" : users.length} icon={ShieldCheck} tone="emerald" />
        <StatCard label="Operators" value={users.filter((u) => u.app_role === "operator").length} tone="sky" />
        <StatCard label="Technicians" value={users.filter((u) => u.app_role === "technician").length} tone="amber" />
        <StatCard label="Administrators" value={users.filter((u) => u.app_role === "admin" || u.role === "admin").length} tone="lime" />
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or email" className="h-10 rounded-xl pl-9" />
      </div>

      {error ? (
        <ErrorBlock error={error} onRetry={load} />
      ) : (
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
        <div className="hidden grid-cols-12 gap-3 border-b border-border/60 bg-muted/40 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground md:grid">
          <span className="col-span-5">User</span>
          <span className="col-span-2">Access role</span>
          <span className="col-span-3">Workspace role</span>
          <span className="col-span-2 text-right">Joined</span>
        </div>
        <ul className="divide-y divide-border/60">
          {loading ? <li className="px-5 py-4 text-sm text-muted-foreground">Loading users…</li> : null}
          {filtered.map((u) => (
            <li key={u.id} className="grid grid-cols-2 gap-3 px-5 py-4 md:grid-cols-12 md:items-center">
              <div className="col-span-2 flex items-center gap-3 md:col-span-5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-800 text-xs font-semibold text-emerald-50">
                  {(u.full_name || u.email || "U").slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{u.full_name || "Unnamed user"}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{u.email}</p>
                </div>
              </div>
              <p className="col-span-1 text-xs capitalize text-muted-foreground md:col-span-2">{u.role}</p>
              <div className="col-span-1 md:col-span-3">
                <Select value={u.app_role || "ev_user"} onValueChange={(v) => changeAppRole(u, v)}>
                  <SelectTrigger className="h-8 w-[150px] rounded-lg text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{APP_ROLES.map((r) => <SelectItem key={r} value={r}>{labelize(r)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <p className="col-span-2 text-right text-[11px] text-muted-foreground md:col-span-2">{fmtDate(u.created_date)}</p>
            </li>
          ))}
          {!loading && filtered.length === 0 ? <li className="px-5 py-6 text-center text-sm text-muted-foreground">No users match that search.</li> : null}
        </ul>
      </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Invite a user</DialogTitle>
            <DialogDescription>They receive an email invitation and can sign in with their own credentials.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Email address</Label>
              <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colleague@company.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Platform access</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User (operate the app)</SelectItem>
                  <SelectItem value="admin">Admin (manage users & data)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={invite} disabled={saving || !inviteEmail} className="bg-emerald-800 hover:bg-emerald-900">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Send invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}