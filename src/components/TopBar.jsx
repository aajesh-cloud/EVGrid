import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Bell, Menu, PlugZap, User } from "lucide-react";
import { notificationsApi } from "@/api";
import { useAuth } from "@/lib/AuthContext";
import { getRoles, labelize } from "@/lib/evgrid";

const TITLES = {
  "/dashboard": "Dashboard",
  "/discover": "Find a charging station",
  "/bookings": "My bookings",
  "/sessions": "Charging sessions",
  "/energy": "Energy monitoring",
  "/payments": "Payments & invoices",
  "/vehicles": "My vehicles",
  "/notifications": "Notifications",
  "/profile": "Profile",
  "/settings": "Settings",
  "/operator": "Operator overview",
  "/operator/stations": "Station management",
  "/operator/points": "Charging points",
  "/operator/tariffs": "Tariffs",
  "/technician": "Technician workspace",
  "/maintenance": "Maintenance",
  "/admin": "Platform overview",
  "/admin/users": "App users",
  "/admin/operators": "Operators",
  "/admin/audit": "Audit log",
  "/admin/docs": "System documentation",
  "/reports": "Reports & analytics",
};

export default function TopBar({ onMenu }) {
  const { user } = useAuth();
  const location = useLocation();
  const [unread, setUnread] = useState(0);
  const roles = getRoles(user);

  useEffect(() => {
    let active = true;
    notificationsApi
      .count({ is_read: false })
      .then((count) => { if (active) setUnread(Number(count) || 0); })
      // A missing backend must not break the shell — the bell simply shows no badge.
      .catch(() => { if (active) setUnread(0); });
    return () => { active = false; };
  }, [location.pathname]);

  const title = TITLES[location.pathname] || "EVGrid";

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between gap-3 px-4 md:px-8">
        <div className="flex items-center gap-3">
          <button
            onClick={onMenu}
            className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-card text-foreground lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4" />
          </button>
          <Link to="/dashboard" className="flex items-center gap-2 lg:hidden">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-800 text-emerald-100">
              <PlugZap className="h-4 w-4" />
            </span>
          </Link>
          <div>
            <p className="hidden text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground sm:block">
              {roles.includes("admin") ? "Administrator workspace" : "EVGrid network"}
            </p>
            <h2 className="font-heading text-[15px] font-semibold text-foreground">{title}</h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/notifications"
            className="relative grid h-9 w-9 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unread > 0 ? (
              <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            ) : null}
          </Link>
          <Link
            to="/profile"
            className="flex items-center gap-2 rounded-xl border border-border bg-card py-1 pl-1 pr-3 transition-colors hover:border-emerald-300"
          >
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-800 text-[11px] font-semibold text-emerald-50">
              {(user?.full_name || user?.email || "E").slice(0, 1).toUpperCase()}
            </span>
            <span className="hidden text-left sm:block">
              <span className="block text-[12px] font-semibold leading-tight text-foreground">
                {user?.full_name || "Member"}
              </span>
              <span className="block text-[10px] leading-tight text-muted-foreground">
                {labelize(user?.app_role || user?.role || "ev_user")}
              </span>
            </span>
            <User className="h-3.5 w-3.5 text-muted-foreground sm:hidden" />
          </Link>
        </div>
      </div>
    </header>
  );
}