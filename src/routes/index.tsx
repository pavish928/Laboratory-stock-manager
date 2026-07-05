import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { FlaskConical, Package, AlertTriangle, FileBarChart } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LabStock — Lab Equipment Stock System" },
      { name: "description", content: "Track lab items, stock in/out, low-stock alerts and monthly reports." },
      { property: "og:title", content: "LabStock — Lab Equipment Stock System" },
      { property: "og:description", content: "Track lab items, stock in/out, low-stock alerts and monthly reports." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/40">
      <header className="max-w-6xl mx-auto flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <FlaskConical className="h-5 w-5" />
          </div>
          <span className="font-semibold">LabStock</span>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="ghost"><Link to="/auth">Sign in</Link></Button>
          <Button asChild><Link to="/dashboard">Open app</Link></Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pt-16 pb-24">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> For education labs
          </div>
          <h1 className="text-5xl font-semibold tracking-tight">
            Lab equipment stock, <span className="text-primary">under control.</span>
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Track your item master, issue and return equipment, get alerted before you run out, and export monthly reports — all from one clean dashboard.
          </p>
          <div className="mt-8 flex gap-3">
            <Button asChild size="lg"><Link to="/auth">Get started</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/dashboard">View dashboard</Link></Button>
          </div>
        </div>

        <div className="mt-20 grid gap-4 md:grid-cols-3">
          <Feature icon={Package} title="Item master" desc="Categorized inventory with location, unit and threshold per item." />
          <Feature icon={AlertTriangle} title="Low-stock alerts" desc="Instantly see what's running low and needs restocking." />
          <Feature icon={FileBarChart} title="Monthly reports" desc="Aggregated issued / returned / restocked totals with CSV export." />
        </div>
      </main>
    </div>
  );
}

function Feature({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4"><Icon className="h-5 w-5" /></div>
      <div className="font-semibold">{title}</div>
      <p className="mt-1.5 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}
