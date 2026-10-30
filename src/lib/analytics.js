import { format, subMonths } from "date-fns";
import { labelize, toDate } from "@/lib/evgrid";

export function dailySeries(records, dateField, valueField = null, days = 7) {
  const buckets = new Map();
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    buckets.set(format(d, "dd MMM"), 0);
  }
  (records || []).forEach((r) => {
    const d = toDate(r[dateField]);
    if (!d) return;
    const key = format(d, "dd MMM");
    if (!buckets.has(key)) return;
    buckets.set(key, buckets.get(key) + (valueField ? Number(r[valueField] || 0) : 1));
  });
  return [...buckets.entries()].map(([label, value]) => ({ label, value: Math.round(value * 10) / 10 }));
}

export function monthlySeries(records, dateField, valueField, months = 6) {
  const buckets = new Map();
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    buckets.set(format(subMonths(now, i), "MMM"), 0);
  }
  (records || []).forEach((r) => {
    const d = toDate(r[dateField]);
    if (!d) return;
    const key = format(d, "MMM");
    if (!buckets.has(key)) return;
    buckets.set(key, buckets.get(key) + Number(r[valueField] || 0));
  });
  return [...buckets.entries()].map(([label, value]) => ({ label, value: Math.round(value * 10) / 10 }));
}

export function countsBy(records, field) {
  const map = new Map();
  (records || []).forEach((r) => {
    const key = r[field] || "unknown";
    map.set(key, (map.get(key) || 0) + 1);
  });
  return [...map.entries()].map(([label, value]) => ({ label: labelize(label), value }));
}

export function groupSum(records, groupField, valueField) {
  const map = new Map();
  (records || []).forEach((r) => {
    const key = r[groupField] || "Unassigned";
    map.set(key, (map.get(key) || 0) + Number(r[valueField] || 0));
  });
  return [...map.entries()]
    .map(([label, value]) => ({ label, value: Math.round(value * 10) / 10 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
}