import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

function monthKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }

function ReportsPage() {
  const now = new Date();
  const [month, setMonth] = useState(monthKey(now));

  const { data: movements = [] } = useQuery({
    queryKey: ["movements", "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stock_movements").select("*, items(name, unit, category)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const months = useMemo(() => {
    const set = new Set<string>([monthKey(now)]);
    movements.forEach((m: any) => set.add(monthKey(new Date(m.created_at))));
    return Array.from(set).sort().reverse();
  }, [movements]);

  const filtered = movements.filter((m: any) => monthKey(new Date(m.created_at)) === month);

  const summary = useMemo(() => {
    const s: Record<string, { issued: number; returned: number; restocked: number }> = {};
    for (const m of filtered as any[]) {
      const name = m.items?.name ?? "—";
      s[name] ??= { issued: 0, returned: 0, restocked: 0 };
      if (m.movement_type === "issue") s[name].issued += m.quantity;
      else if (m.movement_type === "return") s[name].returned += m.quantity;
      else if (m.movement_type === "restock") s[name].restocked += m.quantity;
    }
    return Object.entries(s).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  function exportCsv() {
    const header = ["Date", "Item", "Category", "Type", "Quantity", "Unit", "Issued to", "Notes"];
    const rows = filtered.map((m: any) => [
      new Date(m.created_at).toISOString(),
      m.items?.name ?? "",
      m.items?.category ?? "",
      m.movement_type,
      m.quantity,
      m.items?.unit ?? "",
      m.issued_to ?? "",
      (m.notes ?? "").replace(/\n/g, " "),
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `stock-movements-${month}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Monthly stock report</h1>
          <p className="text-muted-foreground text-sm mt-1">Aggregated issued, returned and restocked totals per item.</p>
        </div>
        <div className="flex gap-2">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>{months.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Movements" value={filtered.length} />
        <StatCard label="Items touched" value={summary.length} />
        <StatCard label="Units issued" value={filtered.filter((m: any) => m.movement_type === "issue").reduce((s: number, m: any) => s + m.quantity, 0)} />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Item</th>
                <th className="text-right px-4 py-3">Issued</th>
                <th className="text-right px-4 py-3">Returned</th>
                <th className="text-right px-4 py-3">Restocked</th>
                <th className="text-right px-4 py-3">Net change</th>
              </tr>
            </thead>
            <tbody>
              {summary.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No movements in this month.</td></tr>
              )}
              {summary.map(([name, s]) => {
                const net = s.returned + s.restocked - s.issued;
                return (
                  <tr key={name} className="border-t">
                    <td className="px-4 py-3 font-medium">{name}</td>
                    <td className="px-4 py-3 text-right">{s.issued}</td>
                    <td className="px-4 py-3 text-right">{s.returned}</td>
                    <td className="px-4 py-3 text-right">{s.restocked}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${net < 0 ? "text-destructive" : net > 0 ? "text-emerald-600" : ""}`}>{net > 0 ? `+${net}` : net}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-5">
      <div className="text-xs uppercase text-muted-foreground tracking-wide">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </Card>
  );
}
