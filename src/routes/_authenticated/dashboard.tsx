import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Package, AlertTriangle, ArrowLeftRight, Layers } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const items = useQuery({
    queryKey: ["items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("items").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const recentMovements = useQuery({
    queryKey: ["movements", "recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("*, items(name, unit)")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
    },
  });

  const list = items.data ?? [];
  const totalItems = list.length;
  const totalUnits = list.reduce((s, i) => s + i.quantity, 0);
  const lowStock = list.filter((i) => i.quantity <= i.low_stock_threshold);
  const categories = new Set(list.map((i) => i.category)).size;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Overview of lab inventory and recent activity.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total items" value={totalItems} icon={Package} />
        <Stat label="Total units in stock" value={totalUnits} icon={Layers} />
        <Stat label="Low stock alerts" value={lowStock.length} icon={AlertTriangle} accent={lowStock.length > 0} />
        <Stat label="Categories" value={categories} icon={ArrowLeftRight} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Low stock</h2>
            <Link to="/items" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          {lowStock.length === 0 ? (
            <p className="text-sm text-muted-foreground">All items are above their threshold. 🎉</p>
          ) : (
            <ul className="divide-y">
              {lowStock.slice(0, 8).map((i) => (
                <li key={i.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <div className="text-sm font-medium">{i.name}</div>
                    <div className="text-xs text-muted-foreground">{i.category} · threshold {i.low_stock_threshold}</div>
                  </div>
                  <div className="text-sm font-semibold text-destructive">{i.quantity} {i.unit}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Recent movements</h2>
            <Link to="/movements" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          {recentMovements.data?.length === 0 ? (
            <p className="text-sm text-muted-foreground">No movements yet.</p>
          ) : (
            <ul className="divide-y">
              {recentMovements.data?.map((m: any) => (
                <li key={m.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <div className="text-sm font-medium">{m.items?.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {m.movement_type} · {new Date(m.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-sm font-semibold">{m.quantity} {m.items?.unit}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon, accent }: { label: string; value: number; icon: any; accent?: boolean }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className={`mt-2 text-2xl font-semibold ${accent ? "text-destructive" : ""}`}>{value}</div>
        </div>
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${accent ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}
