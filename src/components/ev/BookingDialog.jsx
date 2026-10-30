import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Zap } from "lucide-react";
import { vehiclesApi, functionsApi, getApiErrorMessage } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { DURATIONS, SLOT_OPTIONS, addMinutes, inr, todayISO } from "@/lib/evgrid";

export default function BookingDialog({ open, onOpenChange, station, points, onBooked }) {
  const { toast } = useToast();
  const [vehicles, setVehicles] = useState([]);
  const [pointId, setPointId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [start, setStart] = useState("09:00");
  const [duration, setDuration] = useState(60);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setPointId("");
    setError("");
    setDate(todayISO());
    (async () => {
      try {
        const page = await vehiclesApi.filter({}, { sort: "-created_date", limit: 20 });
        const items = page.items || [];
        setVehicles(items);
        setVehicleId(items[0]?.id || "");
      } catch {
        setVehicles([]);
      }
    })();
  }, [open]);

  const bookable = (points || []).filter((p) => !["offline", "maintenance"].includes(p.status));
  const point = bookable.find((p) => p.id === pointId) || bookable[0];
  const end = addMinutes(start, duration);
  const estEnergy = point ? Math.round(point.power_kw * (duration / 60) * 0.8 * 10) / 10 : 0;
  const estCost = estEnergy * Number(station?.price_per_kwh || 0);

  const submit = async () => {
    if (!point) return setError("Select a charging point.");
    setSaving(true);
    setError("");
    try {
      const res = await functionsApi.createBooking({
        station_id: station.id,
        point_id: point.id,
        vehicle_id: vehicleId || undefined,
        booking_date: date,
        start_time: start,
        end_time: end,
        notes,
      });
      toast({
        title: "Slot booked",
        description: `${station.name} · ${point.code} · ${date} ${start}–${end}`,
      });
      onBooked && onBooked(res?.booking);
      onOpenChange(false);
    } catch (err) {
      setError(getApiErrorMessage(err) || "Could not create the booking.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Reserve a charging slot</DialogTitle>
          <DialogDescription>
            {station?.name} · {station?.city}. Double bookings are blocked automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Charging point</Label>
              <Select value={point?.id || ""} onValueChange={setPointId}>
                <SelectTrigger><SelectValue placeholder="Select point" /></SelectTrigger>
                <SelectContent>
                  {bookable.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.code} · {p.connector_type} · {p.power_kw} kW
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Vehicle</Label>
              <Select value={vehicleId || "none"} onValueChange={(v) => setVehicleId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No vehicle selected</SelectItem>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.make} {v.model} · {v.registration_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {vehicles.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  <Link to="/vehicles" className="font-medium text-emerald-700 underline">Add a vehicle</Link> to attach it to a booking.
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" min={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Start</Label>
              <Select value={start} onValueChange={setStart}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SLOT_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Duration</Label>
              <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DURATIONS.map((d) => <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/60 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-medium text-emerald-900">
                <Zap className="h-4 w-4" /> {start} – {end} · {point?.power_kw || 0} kW
              </span>
              <span className="font-heading font-semibold text-emerald-900">{inr(estCost)}</span>
            </div>
            <p className="mt-1 text-xs text-emerald-800/80">
              Estimated {estEnergy} kWh at {inr(station?.price_per_kwh)}/kWh. Final cost depends on energy actually delivered.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Notes for the operator (optional)</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Arriving with a 40 kWh battery at 20%." />
          </div>

          {error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !bookable.length} className="bg-emerald-800 hover:bg-emerald-900">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Confirm booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}