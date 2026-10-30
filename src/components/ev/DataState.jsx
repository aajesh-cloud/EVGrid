import React from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/api/client";

/**
 * Consistent loading / error surface for any API-backed section.
 *
 *   <DataState loading={loading} error={error} onRetry={load} empty={items.length === 0}
 *              emptyState={<EmptyState title="..." />}>
 *     {content}
 *   </DataState>
 */
export default function DataState({
  loading,
  error,
  onRetry,
  loadingLabel = "Loading…",
  empty = false,
  emptyState = null,
  children,
}) {
  if (loading) return <LoadingBlock label={loadingLabel} />;
  if (error) return <ErrorBlock error={error} onRetry={onRetry} />;
  if (empty && emptyState) return emptyState;
  return children;
}

export function LoadingBlock({ label = "Loading…" }) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-2xl border border-border/70 bg-card/60 px-6 py-14 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin text-emerald-700" aria-hidden="true" />
      {label}
    </div>
  );
}

export function ErrorBlock({ error, onRetry, title = "Could not load data" }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50/60 px-6 py-12 text-center"
    >
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-rose-100 text-rose-700">
        <AlertTriangle className="h-5 w-5" strokeWidth={1.9} />
      </span>
      <p className="mt-4 font-heading text-base font-semibold text-rose-900">{title}</p>
      <p className="mt-1.5 max-w-md text-sm text-rose-800/80">{getApiErrorMessage(error)}</p>
      {onRetry ? (
        <Button
          type="button"
          variant="outline"
          onClick={onRetry}
          className="mt-5 rounded-xl border-rose-300 bg-white/70 text-rose-800 hover:bg-white"
        >
          <RefreshCw className="mr-2 h-3.5 w-3.5" /> Try again
        </Button>
      ) : null}
    </div>
  );
}
