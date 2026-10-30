import React from "react";
import { cn } from "@/lib/utils";

export default function StatCard({ label, value, hint, icon: Icon, tone = "emerald" }) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700",
    lime: "bg-lime-50 text-lime-700",
    sky: "bg-sky-50 text-sky-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
    slate: "bg-slate-100 text-slate-700",
  };
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-[0_1px_2px_rgba(16,40,34,0.04)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-28px_rgba(6,78,59,0.45)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        {Icon ? (
          <span className={cn("grid h-9 w-9 place-items-center rounded-xl", tones[tone] || tones.emerald)}>
            <Icon className="h-4 w-4" strokeWidth={1.9} />
          </span>
        ) : null}
      </div>
      <p className="mt-3 font-heading text-[26px] font-bold leading-none text-foreground">{value}</p>
      {hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}