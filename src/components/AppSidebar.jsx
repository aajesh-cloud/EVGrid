import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, MapPin, CalendarCheck, Zap, CreditCard, Car, Bell, Gauge,
  Building2, Plug, IndianRupee, Wrench, ClipboardList, ShieldCheck, Users,
  BarChart3, FileClock, LogOut, X, PlugZap, Activity, Settings,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { getRoles, labelize } from "@/lib/evgrid";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const SECTIONS = [
  {
    label: "My charging",
    roles: ["ev_user"],
    items: [
      { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
      { label: "Find stations", to: "/discover", icon: MapPin },
      { label: "Bookings", to: "/bookings", icon: CalendarCheck },
      { label: "Charging sessions", to: "/sessions", icon: Zap },
      { label: "Energy monitoring", to: "/energy", icon: Activity },
      { label: "Payments", to: "/payments", icon: CreditCard },
      { label: "My vehicles", to: "/vehicles", icon: Car },
      { label: "Notifications", to: "/notifications", icon: Bell },
      { label: "Settings", to: "/settings", icon: Settings },
    ],
  },
  {
    label: "Operations",
    roles: ["operator"],
    items: [
      { label: "Operator overview", to: "/operator", icon: Gauge, end: true },
      { label: "Stations", to: "/operator/stations", icon: Building2 },
      { label: "Charging points", to: "/operator/points", icon: Plug },
      { label: "Tariffs", to: "/operator/tariffs", icon: IndianRupee },
      { label: "Reports & analytics", to: "/reports", icon: BarChart3 },
    ],
  },
  {
    label: "Maintenance",
    roles: ["technician"],
    items: [
      { label: "Technician workspace", to: "/technician", icon: Wrench, end: true },
      { label: "Maintenance records", to: "/maintenance", icon: ClipboardList },
    ],
  },
  {
    label: "Administration",
    roles: ["admin"],
    items: [
      { label: "Platform overview", to: "/admin", icon: ShieldCheck, end: true },
      { label: "App users", to: "/admin/users", icon: Users },
      { label: "Operators", to: "/admin/operators", icon: Building2 },
      { label: "Audit log", to: "/admin/audit", icon: FileClock },
      { label: "System documentation", to: "/admin/docs", icon: ClipboardList },
    ],
  },
];

export default function AppSidebar({ mobileOpen, onClose }) {
  const { user, logout } = useAuth();
  const roles = getRoles(user);
  const sections = SECTIONS.filter((s) => s.roles.some((r) => roles.includes(r)));

  const body = (
    <div className="flex h-full flex-col bg-[#06120E] text-emerald-50">
      <div className="flex items-center justify-between px-5 pb-5 pt-6">
        <NavLink to="/dashboard" onClick={onClose} className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-400 text-emerald-950 shadow-[0_0_24px_rgba(52,211,153,0.35)]">
            <PlugZap className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <span className="font-heading text-lg font-extrabold tracking-tight">
            EV<span className="text-emerald-400">Grid</span>
          </span>
        </NavLink>
        <button onClick={onClose} className="rounded-lg p-1.5 text-emerald-200/70 hover:bg-white/10 lg:hidden" aria-label="Close menu">
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="no-scrollbar flex-1 space-y-6 overflow-y-auto px-3 pb-4">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300/50">{section.label}</p>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn(
                        "group flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium transition-all duration-200",
                        isActive
                          ? "bg-emerald-400/15 text-white shadow-[inset_0_0_0_1px_rgba(52,211,153,0.22)]"
                          : "text-emerald-100/65 hover:bg-white/5 hover:text-white"
                      )
                    }
                  >
                    <item.icon className="h-[17px] w-[17px] shrink-0" strokeWidth={1.9} />
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-400/15 text-sm font-semibold text-emerald-300">
            {(user?.full_name || user?.email || "E").slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-white">{user?.full_name || "EVGrid member"}</p>
            <p className="truncate text-[11px] text-emerald-200/60">
              {labelize(user?.app_role || user?.role || "ev_user")}
            </p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => logout()}
            className="h-8 w-8 text-emerald-200/70 hover:bg-white/10 hover:text-white"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] lg:block">{body}</aside>
      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden",
          mobileOpen ? "pointer-events-auto" : "pointer-events-none"
        )}
      >
        <div
          onClick={onClose}
          className={cn(
            "absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300",
            mobileOpen ? "opacity-100" : "opacity-0"
          )}
        />
        <div
          className={cn(
            "absolute inset-y-0 left-0 w-[272px] transition-transform duration-300",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {body}
        </div>
      </div>
    </>
  );
}