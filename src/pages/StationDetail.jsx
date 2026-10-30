import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  MapPin, Star, Zap, Plug, Heart, ArrowLeft, Loader2, CheckCircle2, IndianRupee,
} from "lucide-react";
import { stationsApi, chargingPointsApi, tariffsApi, reviewsApi, favoritesApi, getApiErrorMessage } from "@/api";
import { ErrorBlock } from "@/components/ev/DataState";
import { useAuth } from "@/lib/AuthContext";
import { Image } from "@/components/ui/image";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import StatusBadge from "@/components/ev/StatusBadge";
import BookingDialog from "@/components/ev/BookingDialog";
import { useToast } from "@/components/ui/use-toast";
import { fmtDate, inr } from "@/lib/evgrid";
import { cn } from "@/lib/utils";

export default function StationDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [station, setStation] = useState(null);
  const [points, setPoints] = useState([]);
  const [tariffs, setTariffs] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [favorite, setFavorite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);

  const load = async () => {
    setError(null);
    try {
      const record = await stationsApi.get(id);
      setStation(record);
      if (!record) return;
      const [pointsPage, tariffsPage, reviewsPage, favsPage] = await Promise.all([
        chargingPointsApi.filter({ station_id: id }, { sort: "code", limit: 40 }),
        tariffsApi.filter({ station_id: id, is_active: true }, { limit: 10 }),
        reviewsApi.filter({ station_id: id }, { sort: "-created_date", limit: 20 }),
        favoritesApi.filter({ station_id: id }, { limit: 1 }),
      ]);
      setPoints(pointsPage.items || []);
      setTariffs(tariffsPage.items || []);
      setReviews(reviewsPage.items || []);
      setFavorite((favsPage.items || [])[0] || null);
    } catch (err) {
      if (err?.status === 404) setStation(null);
      else setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const toggleFavorite = async () => {
    try {
      if (favorite) {
        await favoritesApi.delete(favorite.id);
        setFavorite(null);
        toast({ title: "Removed from favourites" });
      } else {
        const created = await favoritesApi.create({ station_id: station.id, station_name: station.name, city: station.city });
        setFavorite(created);
        toast({ title: "Saved to favourites" });
      }
    } catch (err) {
      toast({ title: "Could not update favourites", description: getApiErrorMessage(err), variant: "destructive" });
    }
  };

  const submitReview = async () => {
    if (!comment.trim()) return;
    setPosting(true);
    try {
      const created = await reviewsApi.create({
        station_id: station.id,
        station_name: station.name,
        rating,
        comment: comment.trim(),
        user_name: user?.full_name || "EV driver",
      });
      const next = [created, ...reviews];
      setReviews(next);
      setComment("");
      const avg = next.reduce((sum, r) => sum + Number(r.rating || 0), 0) / next.length;
      const updated = await stationsApi.update(station.id, {
        rating: Math.round(avg * 10) / 10,
        review_count: next.length,
      });
      setStation(updated);
      toast({ title: "Review published", description: "Thanks for sharing your experience." });
    } catch (err) {
      toast({ title: "Could not publish review", description: getApiErrorMessage(err), variant: "destructive" });
    } finally {
      setPosting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-emerald-700" /></div>;
  }
  if (error) {
    return (
      <div className="space-y-6">
        <Link to="/discover" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to stations
        </Link>
        <ErrorBlock error={error} onRetry={load} />
      </div>
    );
  }
  if (!station) {
    return (
      <div className="py-24 text-center">
        <p className="font-heading text-lg font-semibold">Station not found</p>
        <Button asChild variant="outline" className="mt-4 rounded-xl"><Link to="/discover">Back to discovery</Link></Button>
      </div>
    );
  }

  const available = points.filter((p) => p.status === "available").length;

  return (
    <div className="space-y-6">
      <Link to="/discover" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to stations
      </Link>

      <div className="overflow-hidden rounded-3xl border border-border/70 bg-card">
        <div className="relative h-56 w-full bg-emerald-950 md:h-72">
          {station.image_url ? (
            <Image src={station.image_url} alt={station.name} className="h-56 w-full md:h-72" />
          ) : <div className="ev-mesh h-full w-full" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 p-5">
            <div>
              <div className="flex items-center gap-2">
                <StatusBadge status={station.status} className="border-white/20 bg-black/40 text-white" />
                <span className="rounded-full bg-black/40 px-2 py-0.5 text-[11px] text-white backdrop-blur">{station.connector_types?.join(" · ")}</span>
              </div>
              <h1 className="mt-2 font-heading text-2xl font-bold text-white md:text-3xl">{station.name}</h1>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-white/80">
                <MapPin className="h-4 w-4" /> {station.address}, {station.city}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={toggleFavorite} className="rounded-xl border-white/30 bg-black/30 text-white hover:bg-black/50">
                <Heart className={cn("mr-1.5 h-4 w-4", favorite && "fill-rose-400 text-rose-400")} />
                {favorite ? "Saved" : "Save"}
              </Button>
              <Button onClick={() => setDialogOpen(true)} className="rounded-xl bg-emerald-400 text-emerald-950 hover:bg-emerald-300">
                <Zap className="mr-1.5 h-4 w-4" /> Book a slot
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="rounded-2xl border border-border/70 bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-[15px] font-semibold">Charging points</h2>
              <span className="text-xs font-medium text-emerald-700">{available} of {points.length} available</span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {points.map((p) => (
                <div key={p.id} className="rounded-xl border border-border/70 p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-heading text-sm font-semibold">{p.code}</p>
                    <StatusBadge status={p.status} />
                  </div>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Plug className="h-3 w-3" /> {p.connector_type}</span>
                    <span className="inline-flex items-center gap-1"><Zap className="h-3 w-3" /> {p.power_kw} kW {p.current_type}</span>
                  </p>
                </div>
              ))}
              {points.length === 0 ? <p className="text-sm text-muted-foreground">No charging points published yet.</p> : null}
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-5">
            <h2 className="font-heading text-[15px] font-semibold">Reviews ({reviews.length})</h2>
            <div className="mt-4 space-y-3">
              {reviews.length === 0 ? <p className="text-sm text-muted-foreground">No reviews yet — be the first to rate this station.</p> : null}
              {reviews.map((r) => (
                <div key={r.id} className="rounded-xl border border-border/60 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{r.user_name || "EV driver"}</p>
                    <span className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star key={i} className={cn("h-3.5 w-3.5", i <= r.rating ? "fill-amber-400 text-amber-400" : "text-slate-300")} />
                      ))}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-muted-foreground">{r.comment}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground/70">{fmtDate(r.created_date)}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-xl border border-border/70 bg-background/60 p-3">
              <p className="text-sm font-medium">Rate this station</p>
              <div className="mt-2 flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <button key={i} type="button" onClick={() => setRating(i)} aria-label={`${i} stars`}>
                    <Star className={cn("h-5 w-5 transition-colors", i <= rating ? "fill-amber-400 text-amber-400" : "text-slate-300 hover:text-amber-300")} />
                  </button>
                ))}
              </div>
              <Textarea className="mt-2" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="How was the charger, the location and the wait time?" />
              <Button size="sm" onClick={submitReview} disabled={posting || !comment.trim()} className="mt-2 rounded-lg bg-emerald-800 hover:bg-emerald-900">
                {posting ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null} Publish review
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-border/70 bg-card p-5">
            <h2 className="font-heading text-[15px] font-semibold">Tariffs</h2>
            <div className="mt-3 space-y-3">
              {tariffs.length === 0 ? <p className="text-sm text-muted-foreground">Standard rate applies.</p> : null}
              {tariffs.map((t) => (
                <div key={t.id} className="rounded-xl border border-border/60 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="font-heading text-sm font-semibold text-emerald-800">{inr(t.price_per_kwh)}<span className="text-[10px] font-normal text-muted-foreground">/kWh</span></p>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Session fee {inr(t.session_fee)} · idle {inr(t.idle_fee_per_min)}/min · from {fmtDate(t.valid_from)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-5">
            <h2 className="font-heading text-[15px] font-semibold">Station details</h2>
            <dl className="mt-3 space-y-2.5 text-sm">
              <div className="flex items-center justify-between"><dt className="text-muted-foreground">Operator</dt><dd className="font-medium">{station.operator_name || "EVGrid"}</dd></div>
              <div className="flex items-center justify-between"><dt className="text-muted-foreground">Rating</dt><dd className="flex items-center gap-1 font-medium"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{Number(station.rating || 0).toFixed(1)} ({station.review_count || 0})</dd></div>
              <div className="flex items-center justify-between"><dt className="text-muted-foreground">Max power</dt><dd className="font-medium">{station.max_power_kw} kW</dd></div>
              <div className="flex items-center justify-between"><dt className="text-muted-foreground">Hours</dt><dd className="font-medium">{station.open_24h ? "Open 24 hours" : station.opening_hours || "See operator"}</dd></div>
              <div className="flex items-center justify-between"><dt className="text-muted-foreground">Points</dt><dd className="font-medium">{points.length}</dd></div>
            </dl>
            {station.amenities?.length ? (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {station.amenities.map((a) => (
                  <span key={a} className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">
                    <CheckCircle2 className="h-3 w-3" /> {a}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="mt-4 rounded-xl bg-emerald-50 p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-emerald-800"><IndianRupee className="h-3 w-3" /> From {inr(station.price_per_kwh)} per kWh</p>
              <p className="mt-1 text-[11px] text-emerald-900/70">Billing is calculated on energy delivered during the session.</p>
            </div>
          </div>
        </div>
      </div>

      <BookingDialog open={dialogOpen} onOpenChange={setDialogOpen} station={station} points={points} onBooked={() => load()} />
    </div>
  );
}