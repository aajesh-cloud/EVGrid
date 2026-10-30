import React, { useEffect, useMemo, useState } from "react";
import { stationsApi, chargingPointsApi } from "@/api";
import { ErrorBlock } from "@/components/ev/DataState";
import PageHeader from "@/components/ev/PageHeader";
import StationCard from "@/components/ev/StationCard";
import StationFilters from "@/components/ev/StationFilters";
import EmptyState from "@/components/ev/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";

const EMPTY_FILTERS = { query: "", city: "all", connector: "all", power: "any", status: "all" };

export default function Discover() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [stations, setStations] = useState([]);
  const [availability, setAvailability] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { city, connector, power, status } = filters;

  const load = async () => {
    setError(null);
    try {
      const query = {};
      if (city !== "all") query.city = city;
      if (connector !== "all") query.connector_types = connector;
      if (status !== "all") query.status = status;
      if (power !== "any") query.max_power_kw = { $gte: Number(power) };

      const page = await stationsApi.filter(query, { sort: "-rating", limit: 60 });
      const items = page.items || [];
      setStations(items);

      let counts = {};
      if (items.length) {
        const pointsPage = await chargingPointsApi.filter(
          { status: "available", station_id: { $in: items.map((s) => s.id) } },
          { limit: 100 }
        );
        (pointsPage.items || []).forEach((p) => {
          counts[p.station_id] = (counts[p.station_id] || 0) + 1;
        });
      }
      setAvailability(counts);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  // One station request + one availability request per filter change — the
  // search box filters the already-loaded list locally, so typing never
  // re-queries the database.
  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => { load(); }, 350);
    return () => clearTimeout(timer);
  }, [city, connector, power, status]);

  const visible = useMemo(() => {
    const term = filters.query.trim().toLowerCase();
    if (!term) return stations;
    return stations.filter((s) =>
      `${s.name} ${s.city} ${s.operator_name || ""}`.toLowerCase().includes(term)
    );
  }, [stations, filters.query]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Network"
        title="Find a charging station"
        description="Search the EVGrid network by city, connector type, charging power and live availability."
      />
      <StationFilters filters={filters} setFilters={setFilters} onReset={() => setFilters(EMPTY_FILTERS)} />

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {loading ? "Searching the network…" : `${visible.length} station${visible.length === 1 ? "" : "s"} found`}
        </p>
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Live point availability</p>
      </div>

      {error ? (
        <ErrorBlock error={error} onRetry={load} />
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-border/70 bg-card">
              <Skeleton className="h-40 w-full" />
              <div className="space-y-2 p-4">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          title="No stations match those filters"
          description="Try widening your search — remove the connector or power filter, or pick another city."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((station) => (
            <StationCard
              key={station.id}
              station={station}
              availablePoints={availability[station.id] || 0}
              totalPoints={station.total_points || 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}