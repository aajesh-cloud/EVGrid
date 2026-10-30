import React, { useEffect, useState } from "react";
import { CreditCard, Loader2, Receipt, RotateCcw, ShieldCheck, FlaskConical } from "lucide-react";
import { paymentsApi, functionsApi, getApiErrorMessage } from "@/api";
import { ErrorBlock } from "@/components/ev/DataState";
import { useAuth } from "@/lib/AuthContext";
import PageHeader from "@/components/ev/PageHeader";
import StatCard from "@/components/ev/StatCard";
import EmptyState from "@/components/ev/EmptyState";
import StatusBadge from "@/components/ev/StatusBadge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { fmtDate, fmtDateTime, inr } from "@/lib/evgrid";

const METHODS = [
  { value: "upi", label: "UPI (mock)" },
  { value: "card", label: "Card (mock)" },
  { value: "wallet", label: "EVGrid wallet (mock)" },
  { value: "netbanking", label: "Net banking (mock)" },
];

export default function Payments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(null);
  const [method, setMethod] = useState("upi");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setError(null);
    try {
      const page = await paymentsApi.filter({}, { sort: "-created_date", limit: 50 });
      setPayments(page.items || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const paid = payments.filter((p) => p.status === "paid");
  const pending = payments.filter((p) => p.status === "pending");
  const refunded = payments.filter((p) => p.status === "refunded");
  const totalPaid = paid.reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalDue = pending.reduce((s, p) => s + Number(p.amount || 0), 0);

  const settle = async () => {
    if (!active) return;
    setBusy(true);
    try {
      await functionsApi.processPayment({ payment_id: active.id, method });
      toast({ title: "Mock payment successful", description: `${inr(active.amount)} settled via ${method.toUpperCase()}.` });
      setActive(null);
      await load();
    } catch (err) {
      toast({ title: "Payment failed", description: getApiErrorMessage(err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const refund = async (payment) => {
    setBusy(true);
    try {
      await functionsApi.processPayment({ payment_id: payment.id, action: "refund" });
      toast({ title: "Mock refund issued" });
      await load();
    } catch (err) {
      toast({ title: "Refund failed", description: getApiErrorMessage(err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Billing"
        title="Payments & invoices"
        description="Session invoices, settlement status and refund records."
      />

      {error ? (
        <ErrorBlock error={error} onRetry={load} />
      ) : (
        <>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total settled" value={inr(totalPaid)} hint={`${paid.length} paid transactions`} icon={ShieldCheck} tone="emerald" />
        <StatCard label="Outstanding" value={inr(totalDue)} hint={`${pending.length} awaiting payment`} icon={CreditCard} tone={totalDue ? "amber" : "slate"} />
        <StatCard label="Refunded" value={inr(refunded.reduce((s, p) => s + Number(p.amount || 0), 0))} hint={`${refunded.length} refunds`} icon={RotateCcw} tone="sky" />
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[12px] text-amber-800">
        <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Mock payment gateway — no real money moves and no card details are collected or stored. Amounts, references and invoices are generated for demonstration.
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading invoices…</p>
      ) : payments.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No invoices yet"
          description="An invoice is created automatically when a charging session ends."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
          <div className="hidden grid-cols-12 gap-3 border-b border-border/60 bg-muted/40 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground md:grid">
            <span className="col-span-4">Invoice</span>
            <span className="col-span-3">Station · session</span>
            <span className="col-span-2">Method</span>
            <span className="col-span-1 text-right">Amount</span>
            <span className="col-span-2 text-right">Status</span>
          </div>
          <ul className="divide-y divide-border/60">
            {payments.map((p) => (
              <li key={p.id} className="grid grid-cols-2 gap-3 px-5 py-4 text-sm transition-colors hover:bg-emerald-50/30 md:grid-cols-12 md:items-center">
                <div className="col-span-2 md:col-span-4">
                  <p className="font-mono text-[12px] font-medium text-foreground">{p.invoice_number || p.id.slice(0, 10)}</p>
                  <p className="text-[11px] text-muted-foreground">{p.paid_date ? fmtDateTime(p.paid_date) : fmtDate(p.created_date)}</p>
                </div>
                <div className="col-span-1 md:col-span-3">
                  <p className="text-sm">{p.station_name || "—"}</p>
                  <p className="text-[11px] text-muted-foreground">{p.energy_kwh ? `${p.energy_kwh} kWh` : "—"}{p.transaction_ref ? ` · ${p.transaction_ref}` : ""}</p>
                </div>
                <p className="col-span-1 text-xs uppercase text-muted-foreground md:col-span-2">{p.method || "—"}</p>
                <p className="col-span-1 text-right font-semibold md:col-span-1">{inr(p.amount)}</p>
                <div className="col-span-1 flex items-center justify-end gap-2 md:col-span-2">
                  <StatusBadge status={p.status} />
                  {p.status === "pending" ? (
                    <Button size="sm" onClick={() => { setActive(p); setMethod("upi"); }} className="h-7 rounded-md bg-emerald-800 px-2 text-[11px] hover:bg-emerald-900">Pay</Button>
                  ) : null}
                  {p.status === "paid" && user?.role === "admin" ? (
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => refund(p)} className="h-7 px-2 text-[11px] text-rose-700 hover:bg-rose-50">Refund</Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
        </>
      )}

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Settle invoice (mock)</DialogTitle>
            <DialogDescription>
              {active?.invoice_number} · {inr(active?.amount)} for {active?.energy_kwh || 0} kWh at {active?.station_name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm font-medium">Payment method</p>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
            <p className="rounded-lg bg-secondary px-3 py-2 text-[11px] text-muted-foreground">
              This is a simulated gateway. A mock transaction reference is recorded against the invoice.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActive(null)}>Cancel</Button>
            <Button onClick={settle} disabled={busy} className="bg-emerald-800 hover:bg-emerald-900">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Pay {inr(active?.amount)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}