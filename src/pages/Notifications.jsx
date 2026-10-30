import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, CheckCheck, Trash2, CalendarCheck, CreditCard, Zap, Wrench, Info } from "lucide-react";
import { notificationsApi } from "@/api";
import { ErrorBlock } from "@/components/ev/DataState";
import PageHeader from "@/components/ev/PageHeader";
import EmptyState from "@/components/ev/EmptyState";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { fmtDateTime } from "@/lib/evgrid";
import { cn } from "@/lib/utils";

const ICONS = { booking: CalendarCheck, payment: CreditCard, session: Zap, maintenance: Wrench, system: Info };

export default function Notifications() {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setError(null);
    try {
      const page = await notificationsApi.filter({}, { sort: "-created_date", limit: 50 });
      setItems(page.items || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const markRead = async (n) => {
    if (n.is_read) return;
    const updated = await notificationsApi.update(n.id, { is_read: true });
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, ...updated } : x)));
  };

  const markAll = async () => {
    const unread = items.filter((n) => !n.is_read);
    if (!unread.length) return;
    await notificationsApi.bulkUpdate(unread.map((n) => ({ id: n.id, is_read: true })));
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    toast({ title: "All notifications marked as read" });
  };

  const remove = async (n) => {
    await notificationsApi.delete(n.id);
    setItems((prev) => prev.filter((x) => x.id !== n.id));
  };

  const unread = items.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        description={unread ? `${unread} unread update${unread === 1 ? "" : "s"} about bookings, sessions and payments.` : "You are all caught up."}
        actions={<Button variant="outline" onClick={markAll} disabled={!unread} className="rounded-xl"><CheckCheck className="mr-2 h-4 w-4" /> Mark all read</Button>}
      />

      {error ? (
        <ErrorBlock error={error} onRetry={load} />
      ) : loading ? (
        <p className="text-sm text-muted-foreground">Loading notifications…</p>
      ) : items.length === 0 ? (
        <EmptyState icon={Bell} title="Nothing here yet" description="Booking confirmations, charging updates and payment receipts will appear in this inbox." />
      ) : (
        <ul className="space-y-2.5">
          {items.map((n) => {
            const Icon = ICONS[n.type] || Info;
            return (
              <li
                key={n.id}
                className={cn(
                  "flex items-start gap-3 rounded-2xl border p-4 transition-colors",
                  n.is_read ? "border-border/60 bg-card" : "border-emerald-200 bg-emerald-50/40"
                )}
              >
                <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", n.is_read ? "bg-muted text-muted-foreground" : "bg-emerald-100 text-emerald-800")}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{n.title}</p>
                    {!n.is_read ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> : null}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{n.message}</p>
                  <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span>{fmtDateTime(n.created_date)}</span>
                    {n.link ? <Link to={n.link} onClick={() => markRead(n)} className="font-medium text-emerald-700 hover:underline">Open</Link> : null}
                    {!n.is_read ? <button onClick={() => markRead(n)} className="hover:text-foreground">Mark read</button> : null}
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-rose-600" onClick={() => remove(n)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}