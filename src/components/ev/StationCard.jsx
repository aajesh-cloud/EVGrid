import React from "react";
import { Link } from "react-router-dom";
import { MapPin, Star, Zap, Plug } from "lucide-react";
import StatusBadge from "@/components/ev/StatusBadge";
import { inr } from "@/lib/evgrid";

export default function StationCard({ station, availablePoints = 0, totalPoints = 0 }) {
  return (
    <Link
      to={`/stations/${station.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_1px_2px_rgba(16,40,34,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_26px_50px_-30px_rgba(6,78,59,0.5)]"
    >
      <div className="h-1 w-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-lime-400 opacity-80" />
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center justify-between gap-2">
          <StatusBadge status={station.status} />
          <span className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-secondary/60 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            <Zap className="h-3 w-3 text-emerald-600" />
            {station.max_power_kw || 0} kW
          </span>
        </div>
        <div className="mt-2.5 flex items-start justify-between gap-2">
          <h3 className="font-heading text-[15px] font-semibold leading-snug text-foreground">{station.name}</h3>
          <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-amber-600">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            {Number(station.rating || 0).toFixed(1)}
          </span>
        </div>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" /> {station.city}
          {station.operator_name ? ` · ${station.operator_name}` : ""}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(station.connector_types || []).slice(0, 3).map((c) => (
            <span key={c} className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
              <Plug className="h-3 w-3" /> {c}
            </span>
          ))}
        </div>
        <div className="mt-4 flex items-end justify-between border-t border-border/60 pt-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Tariff</p>
            <p className="font-heading text-sm font-semibold text-foreground">{inr(station.price_per_kwh)}<span className="text-[11px] font-normal text-muted-foreground">/kWh</span></p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
            <Zap className="h-3 w-3" /> {availablePoints}/{totalPoints || 0} free
          </span>
        </div>
      </div>
    </Link>
  );
}