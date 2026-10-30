import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, Zap, X, Loader2, MapPin, Clock, Car } from "lucide-react";
import { bookingsApi, notificationsApi, functionsApi, getApiErrorMessage } from "@/api";
import { ErrorBlock } from "@/components/ev/DataState";
import PageHeader from "@/components/ev/PageHeader";
import EmptyState from "@/components/ev/EmptyState";
import StatusBadge from "@/components/ev/StatusBadge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { fmtDate, inr, num } from "@/lib/evgrid";

export default function Bookings() {
  const { toast } = useToast();
  const [bookings, setBookings] = useState([]);
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setError(null);
    try {
      const query = status === "all" ? {} : { status };
      const page = await bookingsApi.filter(query, { sort: "-booking_date", limit: 50 });
      setBookings(page.items || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setLoading(true); load(); }, [status]);

  const startSession = async (booking) => {
    setBusyId(booking.id);
    try {
      await functionsApi.chargingSession({ action: "start", booking_id: booking.id });
      toast({ title: "Charging started", description: `${booking.station_name} · ${booking.point_code}` });
      await load();
    } catch (err) {
      toast({ title: "Could not start", description: getApiErrorMessage(err), variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (booking) => {
    setBusyId(booking.id);
    try {
      await bookingsApi.update(booking.id, { status: "cancelled" });
      await notificationsApi.create({
        user_id: booking.created_by_id,
        title: "Booking cancelled",
        message: `Your slot at ${booking.station_name} on ${booking.booking_date} was cancelled.`,
        type: "booking",
        link: "/bookings",
      });
      toast({ title: "Booking cancelled" });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reservations"
        title="My bookings"
        description="Confirmed slots, active charging and your full reservation history."
        actions={
          <div className="flex items-center gap-2">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-10 w-[170px] rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Button asChild className="rounded-xl bg-emerald-800 hover:bg-emerald-900">
              <Link to="/discover">New booking</Link>
            </Button>
          </div>
        }
      />

      {error ? (
        <ErrorBlock error={error} onRetry={load} />
      ) : loading ? (
        <p className="text-sm text-muted-foreground">Loading bookings…</p>
      ) : bookings.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="No bookings here"
          description="Reserve a charging point to guarantee a slot when you arrive."
          action={<Button asChild className="rounded-xl bg-emerald-800 hover:bg-emerald-900"><Link to="/discover">Find a station</Link></Button>}
        />
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => (
            <div key={b.id} className="rounded-2xl border border-border/70 bg-card p-4 transition-shadow hover:shadow-[0_16px_36px_-30px_rgba(6,78,59,0.45)] sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                    <Zap className="h-5 w-5" strokeWidth={1.8} />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/stations/${b.station_id}`} className="font-heading text-[15px] font-semibold hover:text-emerald-800">{b.station_name}</Link>
                      <StatusBadge status={b.status} />
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> Point {b.point_code}</span>
                      <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {fmtDate(b.booking_date)} · {b.start_time}–{b.end_time}</span>
                      {b.vehicle_label ? <span className="inline-flex items-center gap-1"><Car className="h-3 w-3" /> {b.vehicle_label}</span> : null}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Est. {num(b.estimated_energy_kwh, 1)} kWh · {inr(b.estimated_cost)} · {b.duration_minutes} min
                      {b.notes ? ` · “${b.notes}”` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  {["pending", "confirmed"].includes(b.status) ? (
                    <>
                      <Button size="sm" onClick={() => startSession(b)} disabled={busyId === b.id} className="rounded-lg bg-emerald-800 hover:bg-emerald-900">
                        {busyId === b.id ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Zap className="mr-1.5 h-3.5 w-3.5" />} Start charging
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => cancel(b)} disabled={busyId === b.id} className="rounded-lg text-rose-700 hover:bg-rose-50">
                        <X className="mr-1.5 h-3.5 w-3.5" /> Cancel
                      </Button>
                    </>
                  ) : b.status === "active" ? (
                    <Button asChild size="sm" className="rounded-lg bg-lime-600 hover:bg-lime-700">
                      <Link to="/sessions">View live session</Link>
                    </Button>
                  ) : b.status === "completed" ? (
                    <Button asChild size="sm" variant="outline" className="rounded-lg"><Link to="/payments">View invoice</Link></Button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}