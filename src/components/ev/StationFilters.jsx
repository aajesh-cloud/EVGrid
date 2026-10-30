import React from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CITIES, CONNECTOR_TYPES, POWER_FILTERS } from "@/lib/evgrid";

export default function StationFilters({ filters, setFilters, onReset }) {
  const update = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-3 shadow-[0_1px_2px_rgba(16,40,34,0.04)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.query}
            onChange={(e) => update("query", e.target.value)}
            placeholder="Search by station name or city"
            className="h-10 rounded-xl border-border bg-background pl-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Select value={filters.city} onValueChange={(v) => update("city", v)}>
            <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="City" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All cities</SelectItem>
              {CITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.connector} onValueChange={(v) => update("connector", v)}>
            <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Connector" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any connector</SelectItem>
              {CONNECTOR_TYPES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.power} onValueChange={(v) => update("power", v)}>
            <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Power" /></SelectTrigger>
            <SelectContent>
              {POWER_FILTERS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.status} onValueChange={(v) => update("status", v)}>
            <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any status</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="ghost" onClick={onReset} className="h-10 rounded-xl text-muted-foreground">
          <SlidersHorizontal className="mr-2 h-4 w-4" /> Reset
        </Button>
      </div>
    </div>
  );
}