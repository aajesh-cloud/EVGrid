import React from "react";
import { Outlet } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { getRoles, labelize } from "@/lib/evgrid";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function RoleGate({ roles }) {
  const { user } = useAuth();
  const allowed = getRoles(user).some((r) => roles.includes(r));

  if (allowed) return <Outlet />;

  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-amber-700">
        <ShieldAlert className="h-5 w-5" />
      </span>
      <h1 className="mt-4 font-heading text-xl font-bold">Workspace restricted</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This area is limited to {roles.map(labelize).join(" and ")} roles. Your account is signed in as{" "}
        {labelize(user?.app_role || user?.role || "ev_user")}. Ask an administrator for access.
      </p>
      <Button asChild className="mt-5 rounded-xl bg-emerald-800 hover:bg-emerald-900">
        <Link to="/dashboard">Back to my dashboard</Link>
      </Button>
    </div>
  );
}