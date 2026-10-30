import React, { useEffect, useState } from "react";
import { FileClock, Search } from "lucide-react";
import { auditLogsApi } from "@/api";
import PageHeader from "@/components/ev/PageHeader";
import { ErrorBlock } from "@/components/ev/DataState";
import StatusBadge from "@/components/ev/StatusBadge";
import EmptyState from "@/components/ev/EmptyState";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtDateTime } from "@/lib/evgrid";

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("all");

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      const page = await auditLogsApi.filter({}, { sort: "-created_date", limit: 100 });
      setLogs(page.items || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = logs.filter((l) => {
    const matchesSeverity = severity === "all" || l.severity === severity;
    const term = query.trim().toLowerCase();
    const matchesQuery = !term || `${l.action} ${l.actor_name} ${l.actor_email} ${l.details} ${l.entity_type}`.toLowerCase().includes(term);
    return matchesSeverity && matchesQuery;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Governance"
        title="Audit log"
        description="Every privileged action — bookings, sessions, payments and refunds — recorded with actor and target."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search actions, actors or records" className="h-10 rounded-xl pl-9" />
        </div>
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger className="h-10 w-[170px] rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <ErrorBlock error={error} onRetry={load} />
      ) : loading ? (
        <p className="text-sm text-muted-foreground">Loading audit trail…</p>
      ) : filtered.length === 0 ? (
        <EmptyState icon={FileClock} title="No audit entries" description="Privileged actions in the app will be listed here." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
          <div className="hidden grid-cols-12 gap-3 border-b border-border/60 bg-muted/40 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground md:grid">
            <span className="col-span-3">Action</span>
            <span className="col-span-3">Actor</span>
            <span className="col-span-4">Details</span>
            <span className="col-span-2 text-right">When</span>
          </div>
          <ul className="divide-y divide-border/60">
            {filtered.map((log) => (
              <li key={log.id} className="grid grid-cols-2 gap-3 px-5 py-3.5 text-sm md:grid-cols-12 md:items-center">
                <div className="col-span-2 md:col-span-3">
                  <p className="font-mono text-[12px] font-medium">{log.action}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{log.entity_type || "system"}</p>
                </div>
                <div className="col-span-1 md:col-span-3">
                  <p className="text-sm">{log.actor_name || "System"}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{log.actor_email}</p>
                </div>
                <p className="col-span-1 truncate text-[11px] text-muted-foreground md:col-span-4">{log.details}</p>
                <div className="col-span-2 flex items-center justify-end gap-2 md:col-span-2">
                  <span className="text-[10px] text-muted-foreground">{fmtDateTime(log.created_date)}</span>
                  <StatusBadge status={log.severity === "info" ? "available" : log.severity === "warning" ? "medium" : "critical"} label={log.severity} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}