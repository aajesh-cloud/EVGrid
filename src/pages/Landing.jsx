import React from "react";
import { Link } from "react-router-dom";
import {
  Zap, MapPin, CalendarCheck, CreditCard, Wrench, BarChart3, ShieldCheck,
  PlugZap, ArrowRight, BatteryCharging, Gauge, Users, Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Image } from "@/components/ui/image";
import { useAuth } from "@/lib/AuthContext";
import { inr } from "@/lib/evgrid";

const HERO_IMAGE = "/images/ev-charging1.webp";
const NETWORK_IMAGE = "/images/ev-charging2.jpg";

const FEATURES = [
  { icon: MapPin, title: "Network discovery", copy: "Search live stations by city, connector and charging power with real availability counts." },
  { icon: CalendarCheck, title: "Conflict-free booking", copy: "Slot booking validated on the server so two drivers can never reserve the same point." },
  { icon: Zap, title: "Live charging sessions", copy: "Start and end sessions, track energy delivered, duration and cost per kilowatt-hour." },
  { icon: CreditCard, title: "Payments & invoices", copy: "Automated invoice generation with a mock gateway for safe end-to-end demonstrations." },
  { icon: Wrench, title: "Maintenance workflow", copy: "Report faults, assign technicians, and track every job to resolution with a full history." },
  { icon: BarChart3, title: "Operational analytics", copy: "Energy, revenue, utilisation and booking trends computed straight from platform records." },
];

const ROLES = [
  { icon: BatteryCharging, title: "EV owners", copy: "Find chargers, book slots, track energy and pay invoices." },
  { icon: Gauge, title: "Operators", copy: "Manage stations, points and tariffs, and watch revenue." },
  { icon: Wrench, title: "Technicians", copy: "Work the maintenance queue and close out faults." },
  { icon: ShieldCheck, title: "Administrators", copy: "Govern the network, users and audit trail." },
];

export default function Landing() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-[#05100C] text-emerald-50">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#05100C]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-400 text-emerald-950">
              <PlugZap className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <span className="font-heading text-lg font-extrabold tracking-tight">
              EV<span className="text-emerald-400">Grid</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-emerald-100/70 md:flex">
            <a href="#platform" className="transition-colors hover:text-white">Platform</a>
            <a href="#network" className="transition-colors hover:text-white">Network</a>
            <a href="#roles" className="transition-colors hover:text-white">Workspaces</a>
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <Button asChild className="bg-emerald-400 text-emerald-950 hover:bg-emerald-300">
                <Link to="/dashboard">Open dashboard <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" className="text-emerald-100 hover:bg-white/10 hover:text-white">
                  <Link to="/login">Sign in</Link>
                </Button>
                <Button asChild className="bg-emerald-400 text-emerald-950 hover:bg-emerald-300">
                  <Link to="/register">Get started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="ev-mesh pointer-events-none absolute inset-0 opacity-60" />
        <div className="pointer-events-none absolute -left-40 top-10 h-96 w-96 rounded-full bg-emerald-500/20 blur-[120px]" />
        <div className="pointer-events-none absolute right-0 top-40 h-80 w-80 rounded-full bg-lime-400/10 blur-[100px]" />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-5 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              EV charging infrastructure OS
            </span>
            <h1 className="mt-6 font-heading text-[42px] font-extrabold leading-[1.05] tracking-tight md:text-[60px]">
              Every charger.
              <br />
              Every kilowatt.
              <br />
              <span className="bg-gradient-to-r from-emerald-300 via-emerald-400 to-lime-300 bg-clip-text text-transparent">
                One grid.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-emerald-100/70">
              EVGrid runs the full charging lifecycle — discovery, slot booking, live sessions, energy
              metering, invoices, maintenance and revenue analytics — from a single operations platform.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="bg-emerald-400 text-emerald-950 hover:bg-emerald-300">
                <Link to="/register">Create your account <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/20 bg-transparent text-emerald-50 hover:bg-white/10">
                <Link to="/login">Open the dashboard</Link>
              </Button>
            </div>
            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-white/10 pt-6">
              {[
                ["10", "live stations"],
                ["24", "charging points"],
                ["4", "role workspaces"],
              ].map(([value, label]) => (
                <div key={label}>
                  <dt className="font-heading text-2xl font-bold text-white">{value}</dt>
                  <dd className="text-[11px] uppercase tracking-[0.14em] text-emerald-200/50">{label}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative">
            <div className="ev-glow overflow-hidden rounded-[28px] border border-white/10">
              <Image src={HERO_IMAGE} alt="EV charging hub at dusk" className="h-[420px] w-full object-cover" />
            </div>
            <div className="absolute -bottom-6 -left-4 w-56 rounded-2xl border border-white/10 bg-[#081813]/95 p-4 shadow-2xl backdrop-blur">
              <p className="text-[10px] uppercase tracking-[0.16em] text-emerald-300/60">Live availability</p>
              <div className="mt-2 flex items-end justify-between">
                <p className="font-heading text-2xl font-bold text-white">15<span className="text-sm font-medium text-emerald-300/60">/24</span></p>
                <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">points free</span>
              </div>
              <div className="mt-3 h-1.5 w-full rounded-full bg-white/10">
                <div className="h-full w-[62%] rounded-full bg-gradient-to-r from-emerald-500 to-lime-300" />
              </div>
            </div>
            <div className="absolute -right-3 top-6 rounded-2xl border border-white/10 bg-[#081813]/95 px-4 py-3 backdrop-blur">
              <p className="text-[10px] uppercase tracking-[0.16em] text-emerald-300/60">Session tariff</p>
              <p className="mt-1 font-heading text-lg font-semibold text-white">{inr(18.5)}<span className="text-[11px] font-normal text-emerald-200/50">/kWh</span></p>
            </div>
          </div>
        </div>
      </section>

      <section id="platform" className="border-t border-white/10 bg-[#06120E] py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-400">The platform</p>
            <h2 className="mt-3 font-heading text-3xl font-bold text-white md:text-4xl">
              One system from discovery to settlement
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-emerald-100/60">
              Every number in EVGrid is computed from live platform records — no mock statistics, no
              placeholder screens.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-400/30 hover:bg-white/[0.06]">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-400/10 text-emerald-300">
                  <f.icon className="h-5 w-5" strokeWidth={1.8} />
                </span>
                <h3 className="mt-4 font-heading text-[15px] font-semibold text-white">{f.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-emerald-100/55">{f.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="network" className="border-t border-white/10 py-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 lg:grid-cols-2 lg:items-center">
          <div className="overflow-hidden rounded-3xl border border-white/10">
            <Image
              src={NETWORK_IMAGE}
              alt="DC fast charging station"
              className="h-[340px] w-full object-cover"
            />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-400">The network</p>
            <h2 className="mt-3 font-heading text-3xl font-bold text-white">Built for real operations</h2>
            <p className="mt-3 text-sm leading-relaxed text-emerald-100/60">
              Stations across Mumbai, Bengaluru, Delhi NCR, Pune, Hyderabad, Chennai and Ahmedabad with
              AC and DC infrastructure. Operators publish tariffs; drivers see exactly what a session will cost.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-emerald-100/75">
              {[
                "Per-point live status: available, occupied, reserved, offline",
                "Session metering with average power and delivery duration",
                "Mock payment gateway clearly labelled as simulated",
                "Fault reporting routed to the maintenance queue",
              ].map((line) => (
                <li key={line} className="flex gap-2.5">
                  <Activity className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="roles" className="border-t border-white/10 bg-[#06120E] py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-400">Workspaces</p>
              <h2 className="mt-3 font-heading text-3xl font-bold text-white">Four roles, one source of truth</h2>
            </div>
            <p className="max-w-sm text-sm text-emerald-100/55">
              Permissions are enforced in the application and in the data layer, so each role only sees what it should.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ROLES.map((r) => (
              <div key={r.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <r.icon className="h-5 w-5 text-emerald-300" strokeWidth={1.8} />
                <h3 className="mt-4 font-heading text-[15px] font-semibold text-white">{r.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-emerald-100/55">{r.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 py-20">
        <div className="mx-auto max-w-4xl px-5 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-emerald-400 text-emerald-950">
            <Zap className="h-6 w-6" />
          </span>
          <h2 className="mt-6 font-heading text-3xl font-bold text-white md:text-4xl">Plug into the grid</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-emerald-100/60">
            Create an account to book your first slot, or sign in to explore the operator, technician and
            administrator workspaces.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="bg-emerald-400 text-emerald-950 hover:bg-emerald-300">
              <Link to="/register">Create account</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/20 bg-transparent text-emerald-50 hover:bg-white/10">
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 text-xs text-emerald-200/40 sm:flex-row">
          <p>© {new Date().getFullYear()} EVGrid. Electric vehicle charging & energy management.</p>
          <p className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Demonstration platform · simulated charging data</p>
        </div>
      </footer>
    </div>
  );
}