import React from "react";
import { cn } from "@/lib/utils";
import { labelize, statusStyle } from "@/lib/evgrid";

export default function StatusBadge({ status, label, className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
        statusStyle(status),
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {label || labelize(status)}
    </span>
  );
}