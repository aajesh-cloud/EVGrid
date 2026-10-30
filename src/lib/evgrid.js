import { format, parseISO, isValid } from "date-fns";

export const CONNECTOR_TYPES = ["Type 2", "CCS2", "CHAdeMO", "Type 1", "GB/T"];
export const CITIES = ["Mumbai", "Bengaluru", "Delhi", "Gurugram", "Pune", "Hyderabad", "Chennai", "Ahmedabad"];
export const POWER_FILTERS = [
  { label: "Any power", value: "any" },
  { label: "22 kW and above", value: "22" },
  { label: "50 kW and above", value: "50" },
  { label: "100 kW and above", value: "100" },
];
export const SLOT_OPTIONS = ["06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00"];
export const DURATIONS = [
  { label: "30 minutes", value: 30 },
  { label: "1 hour", value: 60 },
  { label: "1.5 hours", value: 90 },
  { label: "2 hours", value: 120 },
];

const STATUS_STYLES = {
  available: "bg-emerald-50 text-emerald-700 border-emerald-200",
  online: "bg-emerald-50 text-emerald-700 border-emerald-200",
  occupied: "bg-amber-50 text-amber-700 border-amber-200",
  reserved: "bg-sky-50 text-sky-700 border-sky-200",
  offline: "bg-slate-100 text-slate-600 border-slate-200",
  maintenance: "bg-orange-50 text-orange-700 border-orange-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  active: "bg-lime-50 text-lime-700 border-lime-200",
  in_progress: "bg-lime-50 text-lime-700 border-lime-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-rose-50 text-rose-700 border-rose-200",
  no_show: "bg-rose-50 text-rose-700 border-rose-200",
  aborted: "bg-rose-50 text-rose-700 border-rose-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  failed: "bg-rose-50 text-rose-700 border-rose-200",
  refunded: "bg-sky-50 text-sky-700 border-sky-200",
  open: "bg-rose-50 text-rose-700 border-rose-200",
  assigned: "bg-sky-50 text-sky-700 border-sky-200",
  resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  low: "bg-slate-100 text-slate-600 border-slate-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  critical: "bg-rose-50 text-rose-700 border-rose-200",
  suspended: "bg-rose-50 text-rose-700 border-rose-200",
  availableTech: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export function statusStyle(status) {
  return STATUS_STYLES[status] || "bg-slate-100 text-slate-600 border-slate-200";
}

export function labelize(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function inr(amount) {
  const n = Number(amount || 0);
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function num(value, digits = 0) {
  return Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function toDate(value) {
  if (!value) return null;
  const d = typeof value === "string" ? parseISO(value) : new Date(value);
  return isValid(d) ? d : null;
}

export function fmtDate(value) {
  const d = toDate(value);
  return d ? format(d, "dd MMM yyyy") : "—";
}

export function fmtDateTime(value) {
  const d = toDate(value);
  return d ? format(d, "dd MMM yyyy · hh:mm a") : "—";
}

export function fmtDay(value) {
  const d = toDate(value);
  return d ? format(d, "dd MMM") : "—";
}

export function todayISO() {
  return format(new Date(), "yyyy-MM-dd");
}

export function addMinutes(time, minutes) {
  const [h, m] = String(time || "00:00").split(":").map(Number);
  const total = Math.min(h * 60 + m + minutes, 23 * 60 + 45);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function getRoles(user) {
  if (!user) return [];
  const admin = user.role === "admin" || user.app_role === "admin";
  const appRole = user.app_role || (admin ? "admin" : "ev_user");
  const roles = ["ev_user"];
  if (admin || appRole === "operator") roles.push("operator");
  if (admin || appRole === "technician") roles.push("technician");
  if (admin) roles.push("admin");
  return roles;
}

export function monthKey(value) {
  const d = toDate(value);
  return d ? format(d, "MMM") : "";
}